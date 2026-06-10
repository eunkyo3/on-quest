interface Props {
  page: number;
  totalPages: number;
  loading?: boolean;
  onPage: (page: number) => void;
}

/** 이전/다음 페이지 이동 (목록 상·하단 공통) */
export function Pager({ page, totalPages, loading, onPage }: Props) {
  const last = totalPages || 1;
  return (
    <div className="pager">
      <button
        type="button"
        className="ghost"
        disabled={page <= 1 || loading}
        onClick={() => onPage(page - 1)}
      >
        이전
      </button>
      <span className="page-indicator">
        {page} / {last}
      </span>
      <button
        type="button"
        className="ghost"
        disabled={page >= totalPages || loading}
        onClick={() => onPage(page + 1)}
      >
        다음
      </button>
    </div>
  );
}
