/**
 * 증빙 업로드 허용 MIME 화이트리스트.
 * text/html · image/svg+xml 등 브라우저에서 스크립트로 실행될 수 있는 타입을
 * 차단해, inline 미리보기 시 저장형 XSS 가 발생하지 않게 한다.
 */
export const ALLOWED_PROOF_MIME = new Set<string>([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
]);

/** inline(Content-Disposition: inline) 으로 안전하게 내려줄 수 있는 타입인지 */
export function isInlineSafeMime(mime: string): boolean {
  return ALLOWED_PROOF_MIME.has(mime);
}

/** 허용 MIME → 표준 확장자. 클라이언트 originalname 의 확장자 위조를 방지한다. */
const MIME_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

/** 검증된 MIME 으로부터 신뢰할 수 있는 확장자를 얻는다. 모르면 빈 문자열. */
export function extForMime(mime: string): string {
  return MIME_EXT[mime] ?? '';
}
