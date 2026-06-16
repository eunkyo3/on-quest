import type { CookieOptions, Request, Response } from 'express';

/** refresh token 을 담는 HttpOnly 쿠키 이름 */
export const REFRESH_COOKIE = 'onquest_refresh';

/**
 * 쿠키 경로는 /api/auth 로 한정해 refresh/logout 요청에만 전송된다.
 * (전역 prefix 'api' + 컨트롤러 'auth')
 */
const COOKIE_PATH = '/api/auth';

const DEFAULT_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

/** '7d' | '12h' | '30m' | '60s' | '1w' → ms (기본 7일). 폴백 용도. */
export function durationToMs(value: string | undefined): number {
  if (!value) return DEFAULT_REFRESH_MS;
  const m = /^(\d+)\s*([smhdw])?$/.exec(value.trim());
  if (!m) return DEFAULT_REFRESH_MS;
  const n = Number(m[1]);
  const unit = m[2] ?? 's';
  const factor = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
    w: 604_800_000,
  }[unit];
  return n * (factor ?? 1000);
}

/**
 * refresh 쿠키 만료를 토큰 자체의 exp 클레임과 정확히 일치시킨다.
 * JWT_REFRESH_EXPIRES_IN 의 문자열 형식과 무관하게 항상 토큰 수명과 동일해진다.
 * 디코드 실패 시에만 durationToMs 폴백을 사용한다. (서명 검증은 불필요 — 만료 시각만 읽음)
 */
function refreshCookieMaxAge(token: string): number {
  try {
    const seg = token.split('.')[1];
    if (seg) {
      const json = Buffer.from(seg, 'base64url').toString('utf8');
      const exp = (JSON.parse(json) as { exp?: number }).exp;
      if (typeof exp === 'number') {
        const ms = exp * 1000 - Date.now();
        if (ms > 0) return ms;
      }
    }
  } catch {
    // fall through to duration fallback
  }
  return durationToMs(process.env.JWT_REFRESH_EXPIRES_IN ?? '7d');
}

function cookieOptions(maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    // HTTPS 종단 시 COOKIE_SECURE=true 로 켠다. 기본은 http 배포를 고려해 false.
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    path: COOKIE_PATH,
    maxAge: maxAgeMs,
  };
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, cookieOptions(refreshCookieMaxAge(token)));
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(0), maxAge: undefined });
}

/** cookie-parser 미사용 — Cookie 헤더를 직접 파싱해 refresh token 을 읽는다. */
export function readRefreshCookie(req: Request): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (name === REFRESH_COOKIE) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}
