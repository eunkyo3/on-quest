const MINUTE_FORMAT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
};

/** API/DB ISO 문자열을 분 단위까지만 표시 (초·밀리초 숨김) */
export function formatDateTimeToMinute(iso: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    ...MINUTE_FORMAT,
    timeZone: 'Asia/Seoul',
  }).format(new Date(iso));
}
