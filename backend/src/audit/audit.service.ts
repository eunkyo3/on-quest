import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditActor {
  sub: string;
  name?: string;
  companyCode: string;
}

export interface AuditEntry {
  action: string;
  targetType: string;
  targetId?: string | null;
  detail?: string | null;
}

export interface AuditLogRow {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string | null;
  detail: string | null;
  createdAt: Date;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 감사 로그를 기록한다. 로깅 실패가 본 비즈니스 로직을 막지 않도록
   * 예외를 흡수한다(best-effort).
   */
  async record(actor: AuditActor, entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          companyCode: actor.companyCode,
          actorId: actor.sub,
          actorName: actor.name ?? '알 수 없음',
          action: entry.action,
          targetType: entry.targetType,
          targetId: entry.targetId ?? null,
          detail: entry.detail ?? null,
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`감사 로그 기록 실패 (${entry.action}): ${msg}`);
    }
  }

  /** 슈퍼관리자용: 같은 회사 최근 감사 로그 */
  async list(companyCode: string, limit = 100): Promise<AuditLogRow[]> {
    // 잘못된 limit(NaN 등) 이 Prisma take 로 전달돼 쿼리가 깨지지 않도록 보정한다.
    const take = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 100;
    return this.prisma.auditLog.findMany({
      where: { companyCode },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        actorId: true,
        actorName: true,
        action: true,
        targetType: true,
        targetId: true,
        detail: true,
        createdAt: true,
      },
    });
  }
}
