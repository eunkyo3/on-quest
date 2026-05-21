/** 한글 등 비ASCII 파일명을 브라우저에서 올바르게 표시 */
export function buildContentDisposition(
  disposition: 'inline' | 'attachment',
  fileName: string,
): string {
  const asciiFallback =
    fileName.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, "'") || 'file';
  const encoded = encodeURIComponent(fileName);
  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
