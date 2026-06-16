import { ConfigService } from '@nestjs/config';

/**
 * JWT_SECRET 을 읽되, 미설정이면 부팅을 중단(fail-fast)한다.
 * 과거에는 'change_this_jwt_secret' 기본값으로 폴백했는데, 이는 공개된
 * 서명 키로 누구나 토큰을 위조할 수 있는 심각한 취약점이었다.
 */
/** 저장소에 동봉된 약한 예시 값들 — 이대로 운영하면 토큰 위조가 가능하므로 거부한다. */
const KNOWN_PLACEHOLDERS = new Set([
  'change_this_jwt_secret',
  'super_secret_change_me',
  'super_secret_change_me_in_production',
  'change_me',
]);

export function requireJwtSecret(configService: ConfigService): string {
  const secret = configService.get<string>('JWT_SECRET') ?? process.env.JWT_SECRET;
  if (!secret || secret.trim().length < 16) {
    throw new Error(
      'JWT_SECRET 이 설정되지 않았거나 너무 짧습니다(16자 이상 필요). ' +
        '환경변수 JWT_SECRET 에 충분히 긴 랜덤 문자열을 지정하세요. ' +
        '(예: `openssl rand -base64 48`)',
    );
  }
  if (KNOWN_PLACEHOLDERS.has(secret.trim())) {
    throw new Error(
      'JWT_SECRET 이 저장소 기본 예시 값으로 설정돼 있습니다. ' +
        '반드시 고유한 랜덤 값으로 교체하세요. (예: `openssl rand -base64 48`)',
    );
  }
  return secret;
}
