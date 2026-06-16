import { useRef, useState } from 'react';
import { questApi } from '../api/questApi';
import { useQuestStore } from '../store/questStore';
import { useToastStore } from '../store/toastStore';
import { parseQuestCsv, type CsvQuestRow } from '../utils/parseCsv';
import { formatDateTimeToMinute } from '../utils/formatDateTime';

const TEMPLATE_CSV =
  'title,description,deadline,assigneeEmail\r\n' +
  '팀 소개 페이지 작성,회사 위키에 자기소개 페이지를 작성하세요,2026-12-31 18:00,employee@example.com\r\n';

/**
 * 관리자용 CSV 일괄 발행.
 * 파일 선택 → 클라이언트 검증·미리보기 → 전건 유효할 때만 제출(all-or-nothing).
 */
export function BulkCreateQuests() {
  const { fetchQuests, fetchStats } = useQuestStore();
  const [rows, setRows] = useState<CsvQuestRow[]>([]);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const invalidCount = rows.filter((r) => r.error).length;
  const canSubmit = rows.length > 0 && invalidCount === 0 && !submitting;

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    const parsed = parseQuestCsv(text);
    setHeaderError(parsed.headerError);
    setRows(parsed.rows);
    if (!parsed.headerError && parsed.rows.length === 0) {
      setHeaderError('데이터 행이 없습니다.');
    }
  };

  const reset = () => {
    setRows([]);
    setHeaderError(null);
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadTemplate = () => {
    const blob = new Blob([String.fromCharCode(0xfeff) + TEMPLATE_CSV], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quest-template.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (!window.confirm(`${rows.length}건의 퀘스트를 일괄 발행합니다. 계속할까요?`)) return;
    setSubmitting(true);
    try {
      const result = await questApi.bulkCreate(
        rows.map((r) => ({
          title: r.title,
          description: r.description,
          deadline: r.deadline,
          assigneeEmail: r.assigneeEmail,
        })),
      );
      useToastStore.getState().push(`${result.created}건이 발행되었습니다.`, 'success');
      reset();
      await fetchQuests({ page: 1 });
      await fetchStats();
    } catch (e) {
      const resp = (e as { response?: { data?: { message?: unknown } } }).response;
      const msg = resp?.data?.message;
      useToastStore.getState().push(
        Array.isArray(msg) ? msg.join(', ') : typeof msg === 'string' ? msg : '일괄 발행에 실패했습니다.',
        'error',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="card">
      <p className="text-muted" style={{ margin: '0 0 0.75rem', fontSize: '0.88rem' }}>
        헤더 <code className="mono">title,description,deadline,assigneeEmail</code> 형식의 CSV로
        최대 100건까지 한 번에 발행합니다. 담당자는 같은 회사 사원의 이메일로 지정합니다.
      </p>

      <div className="quest-actions">
        <input
          type="file"
          ref={fileInputRef}
          accept=".csv,text/csv"
          onChange={(e) => void handleFile(e.target.files?.[0])}
          style={{ display: 'none' }}
        />
        <button type="button" className="ghost" onClick={() => fileInputRef.current?.click()}>
          CSV 파일 선택
        </button>
        <button type="button" className="ghost" onClick={downloadTemplate}>
          템플릿 다운로드
        </button>
        {fileName && (
          <button type="button" className="ghost" onClick={reset}>
            초기화
          </button>
        )}
      </div>

      {fileName && (
        <p className="text-muted" style={{ margin: '0.6rem 0 0', fontSize: '0.85rem' }}>
          선택: {fileName} · {rows.length}행
          {invalidCount > 0 && (
            <span className="overdue-text"> · 오류 {invalidCount}건 (수정 후 다시 선택)</span>
          )}
        </p>
      )}
      {headerError && <div className="alert-error">{headerError}</div>}

      {rows.length > 0 && (
        <div className="card table-wrap" style={{ marginTop: '0.75rem' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">행</th>
                <th scope="col">제목</th>
                <th scope="col">마감</th>
                <th scope="col">담당자 이메일</th>
                <th scope="col">검증</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.line}>
                  <td className="mono">{r.line}</td>
                  <td>{r.title || '—'}</td>
                  <td>{r.error ? r.deadline : formatDateTimeToMinute(r.deadline)}</td>
                  <td className="mono">{r.assigneeEmail || '—'}</td>
                  <td>
                    {r.error ? (
                      <span className="overdue-text">{r.error}</span>
                    ) : (
                      <span style={{ color: 'var(--success)' }}>정상</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && (
        <div className="quest-actions" style={{ marginTop: '0.85rem' }}>
          <button type="button" onClick={() => void handleSubmit()} disabled={!canSubmit}>
            {submitting ? '발행 중…' : `${rows.length}건 일괄 발행`}
          </button>
        </div>
      )}
    </section>
  );
}
