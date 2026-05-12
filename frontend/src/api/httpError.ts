import { isAxiosError } from 'axios';

/** NestJS 등 API의 `message`(문자열 또는 문자열 배열)를 사용자에게 보여줄 문장으로 변환 */
export function getApiErrorMessage(e: unknown, fallback: string): string {
  if (isAxiosError(e) && e.response?.data && typeof e.response.data === 'object') {
    const msg = (e.response.data as { message?: string | string[] }).message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}
