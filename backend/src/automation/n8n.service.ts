import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';

/**
 * n8n HMAC 검증과 동일한 문자열을 만들기 위한 정규 JSON 직렬화(키 정렬).
 *
 * JSON.stringify 와 동일하게 undefined/함수/심볼 을 처리한다:
 *   - 객체 값이면 해당 키를 생략, 배열 요소면 null 로 직렬화.
 * 이렇게 하지 않으면 `{"k":undefined}` 같은 '유효하지 않은 JSON' 이 서명 대상이 되고,
 * n8n 이 본문을 JSON 파싱하는 순간 깨져 서명 불일치(알림 누락)가 발생한다.
 */
export function stableStringify(value: unknown): string {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
    return 'null'; // 배열 요소 컨텍스트용 — 객체 키는 아래에서 생략된다.
  }
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => {
      const v = obj[k];
      return v !== undefined && typeof v !== 'function' && typeof v !== 'symbol';
    })
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

/**
 * 웹훅 이벤트 타입.
 * n8n 쪽 Switch 노드가 이 값으로 분기해서 Slack 메시지 템플릿을 선택한다.
 */
export type N8nEventType =
  | 'quest.created'
  | 'quest.proof_uploaded'
  | 'quest.reviewed'
  | 'quest.declined'
  | 'quest.reopened'
  | 'quest.deadline_soon'
  | 'quest.deadline_overdue';

export interface N8nWebhookPayload<T = Record<string, unknown>> {
  event: N8nEventType;
  timestamp: string;
  data: T;
}

/**
 * NestJS → n8n 연동 서비스.
 *
 * ⚠ 보안 설계 (요구사항명세서 §보안)
 *   1) 모든 페이로드를 HMAC-SHA256 로 서명 → `X-OnQuest-Signature` 헤더 전달.
 *   2) 타임스탬프를 헤더에 실어 n8n 쪽에서 재전송 공격 방어(±5분).
 *   3) 공유 비밀키(N8N_WEBHOOK_SECRET)는 환경 변수로만 주입.
 *
 * ⚠ 성능 요구사항 (요구사항명세서 §성능)
 *   - Slack 알림은 **3초 이내** 실시간 전달되어야 한다.
 *   - 따라서 웹훅은 fire-and-forget 패턴으로 비동기 호출하고,
 *     메인 트랜잭션 성공 후 호출하여 사용자 응답을 블로킹하지 않는다.
 */
@Injectable()
export class N8nService {
  private readonly logger = new Logger(N8nService.name);
  private readonly http: AxiosInstance;
  private readonly webhookUrl: string;
  private readonly secret: string;

  constructor(private readonly config: ConfigService) {
    this.webhookUrl = this.config.get<string>('N8N_WEBHOOK_URL') ?? '';
    this.secret = this.config.get<string>('N8N_WEBHOOK_SECRET') ?? '';

    this.http = axios.create({
      timeout: 2500, // 3초 SLA 여유를 위해 2.5s
      headers: { 'Content-Type': 'application/json' },
    });

    if (!this.webhookUrl) {
      this.logger.warn('N8N_WEBHOOK_URL 미설정 — Slack 알림이 발송되지 않습니다.');
    }
  }

  /**
   * 웹훅 트리거 (fire-and-forget).
   * 실패해도 예외를 상위로 전파하지 않아 비즈니스 로직을 막지 않는다.
   */
  triggerWebhook<T extends Record<string, unknown>>(
    event: N8nEventType,
    data: T,
  ): void {
    if (!this.webhookUrl) return;

    const payload: N8nWebhookPayload<T> = {
      event,
      timestamp: new Date().toISOString(),
      data,
    };
    const body = stableStringify(payload);
    const signature = this.sign(body);

    this.http
      .post(this.webhookUrl, body, {
        headers: {
          'X-OnQuest-Signature': signature,
          'X-OnQuest-Timestamp': payload.timestamp,
          'X-OnQuest-Event': event,
        },
      })
      .then(() => {
        this.logger.debug(`n8n webhook dispatched: ${event}`);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`n8n webhook failed (${event}): ${msg}`);
      });
  }

  /** HMAC-SHA256 서명 */
  private sign(body: string): string {
    if (!this.secret) return '';
    return crypto.createHmac('sha256', this.secret).update(body).digest('hex');
  }
}
