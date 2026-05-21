import { extname } from 'path';

function sanitizeSegment(value: string, maxLen = 40): string {
  const t = value
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_');
  if (!t) return 'unknown';
  return t.length > maxLen ? t.slice(0, maxLen) : t;
}

/** 증빙 저장 파일명: 사원명_퀘스트명_YYYYMMDD.ext */
export function buildProofFileName(
  employeeName: string,
  questTitle: string,
  originalName: string,
): string {
  const ext = extname(originalName) || '';
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${sanitizeSegment(employeeName)}_${sanitizeSegment(questTitle)}_${date}${ext.toLowerCase()}`;
}
