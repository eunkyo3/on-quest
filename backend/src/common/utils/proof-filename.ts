import { extForMime } from './proof-mime';

function sanitizeSegment(value: string, maxLen = 40): string {
  const t = value
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_');
  if (!t) return 'unknown';
  return t.length > maxLen ? t.slice(0, maxLen) : t;
}

/**
 * 증빙 저장 파일명: 사원명_퀘스트명_YYYYMMDD.ext
 * 확장자는 클라이언트가 보낸 originalname 이 아니라 검증된 MIME 에서 파생한다
 * (예: PNG 업로드를 x.html 로 위장하는 것을 차단).
 */
export function buildProofFileName(
  employeeName: string,
  questTitle: string,
  mimeType: string,
): string {
  const ext = extForMime(mimeType);
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${sanitizeSegment(employeeName)}_${sanitizeSegment(questTitle)}_${date}${ext}`;
}
