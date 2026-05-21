interface Props {
  open: boolean;
  imageUrl: string | null;
  fileName: string | null;
  onClose: () => void;
}

export function ProofPreviewModal({ open, imageUrl, fileName, onClose }: Props) {
  if (!open || !imageUrl) return null;

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-panel modal-panel-image"
        role="dialog"
        aria-modal="true"
        aria-label="증빙 미리보기"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2>{fileName ?? '증빙 미리보기'}</h2>
          <button type="button" className="ghost modal-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </header>
        <div className="modal-body modal-body-image">
          <img src={imageUrl} alt={fileName ?? '증빙'} className="proof-preview-full" />
        </div>
      </div>
    </div>
  );
}
