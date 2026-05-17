const MINUTE_FORMAT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
};

/** 사용자·Slack 표시용 — DB 정밀도는 유지하고 분 단위까지만 포맷 */
export function formatDateTimeToMinute(
  date: Date,
  timeZone = process.env.TZ ?? 'Asia/Seoul',
): string {
  return new Intl.DateTimeFormat('ko-KR', { ...MINUTE_FORMAT, timeZone }).format(
    date,
  );
}
