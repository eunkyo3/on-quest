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
  const date = new Date(iso);
  // 잘못된/빈 문자열에 Intl.format 을 호출하면 RangeError 로 렌더가 깨진다.
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ko-KR', {
    ...MINUTE_FORMAT,
    timeZone: 'Asia/Seoul',
  }).format(date);
}
