/**
 * 간단한 CSV 파서 — RFC 4180 기본 규칙 지원.
 * 따옴표로 감싼 필드(내부 콤마·줄바꿈·"" 이스케이프)와 CRLF/LF 를 처리한다.
 */
export function parseCsv(text: string): string[][] {
  // 선두 BOM(U+FEFF) 제거
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  // 마지막 필드/행
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // 완전히 빈 행 제거
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** 헤더 별칭 — 한/영 헤더 모두 허용 */
const HEADER_ALIAS: Record<string, string> = {
  title: 'title',
  제목: 'title',
  description: 'description',
  설명: 'description',
  deadline: 'deadline',
  마감: 'deadline',
  마감기한: 'deadline',
  assigneeemail: 'assigneeEmail',
  email: 'assigneeEmail',
  이메일: 'assigneeEmail',
  담당자이메일: 'assigneeEmail',
};

export interface CsvQuestRow {
  line: number;
  title: string;
  description: string;
  deadline: string;
  assigneeEmail: string;
  error: string | null;
}

/**
 * 퀘스트 일괄 발행 CSV 를 행 단위로 검증해 반환한다.
 * 필수 헤더: title, description, deadline, assigneeEmail (한글 별칭 허용)
 */
export function parseQuestCsv(text: string): { rows: CsvQuestRow[]; headerError: string | null } {
  const table = parseCsv(text);
  if (table.length === 0) {
    return { rows: [], headerError: 'CSV 내용이 비어 있습니다.' };
  }

  const header = table[0].map(
    (h) => HEADER_ALIAS[h.trim().toLowerCase().replace(/\s/g, '')] ?? '',
  );
  const idx = {
    title: header.indexOf('title'),
    description: header.indexOf('description'),
    deadline: header.indexOf('deadline'),
    assigneeEmail: header.indexOf('assigneeEmail'),
  };
  const missing = Object.entries(idx)
    .filter(([, v]) => v < 0)
    .map(([k]) => k);
  if (missing.length > 0) {
    return {
      rows: [],
      headerError: `필수 헤더가 없습니다: ${missing.join(', ')} (title, description, deadline, assigneeEmail)`,
    };
  }

  const rows: CsvQuestRow[] = table.slice(1).map((cells, i) => {
    const title = (cells[idx.title] ?? '').trim();
    const description = (cells[idx.description] ?? '').trim();
    const deadlineRaw = (cells[idx.deadline] ?? '').trim();
    const assigneeEmail = (cells[idx.assigneeEmail] ?? '').trim();

    let error: string | null = null;
    const deadlineDate = new Date(deadlineRaw);
    if (title.length < 2) error = '제목은 2자 이상이어야 합니다.';
    else if (!description) error = '설명이 비어 있습니다.';
    else if (!deadlineRaw || Number.isNaN(deadlineDate.getTime()))
      error = '마감 날짜를 해석할 수 없습니다. (예: 2026-06-30 18:00)';
    else if (deadlineDate.getTime() <= Date.now())
      error = '마감 기한은 현재 시각 이후여야 합니다.';
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(assigneeEmail))
      error = '담당자 이메일 형식이 올바르지 않습니다.';

    return {
      line: i + 2, // 헤더 다음 행부터 = 파일 기준 행 번호
      title,
      description,
      deadline: error ? deadlineRaw : deadlineDate.toISOString(),
      assigneeEmail,
      error,
    };
  });

  return { rows, headerError: null };
}
