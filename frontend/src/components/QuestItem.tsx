import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { questApi } from '../api/questApi';
import { useQuestStore } from '../store/questStore';
import { useToastStore } from '../store/toastStore';
import {
  ALLOWED_PROOF_ACCEPT,
  QUEST_STATUS_COLOR,
  QUEST_STATUS_LABEL,
  QuestStatus,
  type Quest,
} from '../types/quest';
import { formatDateTimeToMinute } from '../utils/formatDateTime';

interface Props {
  quest: Quest;
  mode: 'employee' | 'admin';
  detailBasePath: string;
}

function hasProofFile(q: Quest): boolean {
  return Boolean(q.proofFileName?.trim());
}

export function QuestItem({ quest, mode, detailBasePath }: Props) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(quest.feedback ?? '');
  const [draftNote, setDraftNote] = useState(quest.submissionNote ?? '');
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadProof, reviewQuest, startQuest } = useQuestStore();
  const proofAttached = hasProofFile(quest);

  useEffect(() => {
    setDraftNote(quest.submissionNote ?? '');
    setDraftFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [quest.id, quest.updatedAt, quest.submissionNote]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!draftFile?.type.startsWith('image/')) {
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    const url = URL.createObjectURL(draftFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [draftFile]);

  const overdue =
    new Date(quest.deadline).getTime() < Date.now() &&
    quest.status !== QuestStatus.COMPLETED;

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    setDraftFile(file);
  };

  const handleSubmitProof = async () => {
    if (!draftFile) {
      useToastStore.getState().push('증빙 파일을 선택한 뒤 제출해 주세요.', 'error');
      return;
    }
    const isResubmit = quest.status === QuestStatus.REJECTED;
    const msg = isResubmit
      ? '선택한 증빙 파일과 추가 설명(입력한 경우)으로 재제출합니다. 정말 제출할까요?'
      : '선택한 증빙 파일과 추가 설명(입력한 경우)으로 제출합니다. 정말 제출할까요?';
    if (!window.confirm(msg)) return;

    setBusy(true);
    try {
      await uploadProof(quest.id, draftFile, draftNote);
    } finally {
      setBusy(false);
    }
  };

  const handleStart = async () => {
    setBusy(true);
    try {
      await startQuest(quest.id);
    } finally {
      setBusy(false);
    }
  };

  const handleReview = async (status: QuestStatus.COMPLETED | QuestStatus.REJECTED) => {
    if (status === QuestStatus.REJECTED && !feedback.trim()) {
      useToastStore.getState().push('반려 시에는 피드백을 반드시 입력해주세요.', 'error');
      return;
    }
    setBusy(true);
    try {
      await reviewQuest(quest.id, { status, feedback: feedback.trim() || undefined });
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadProof = async () => {
    try {
      await questApi.downloadProof(quest.id, quest.proofFileName);
    } catch (err) {
      useToastStore.getState().push(
        err instanceof Error ? err.message : '다운로드 실패',
        'error',
      );
    }
  };

  const handlePreviewProof = async () => {
    try {
      const blob = await questApi.fetchProofBlob(quest.id);
      const url = URL.createObjectURL(blob);
      if (quest.proofMimeType?.startsWith('image/')) {
        window.open(url, '_blank', 'noopener,noreferrer');
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        if (quest.proofMimeType === 'application/pdf') {
          a.click();
        } else {
          a.download = quest.proofFileName ?? `proof-${quest.id}`;
          a.click();
        }
        window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      }
    } catch (err) {
      useToastStore.getState().push(
        err instanceof Error ? err.message : '미리보기 실패',
        'error',
      );
    }
  };

  const canSubmitProof =
    quest.status === QuestStatus.IN_PROGRESS ||
    quest.status === QuestStatus.SUBMITTED ||
    quest.status === QuestStatus.REJECTED;

  const submitLabel = quest.status === QuestStatus.REJECTED ? '재제출' : '제출';

  return (
    <article className="quest-item">
      <header>
        <div>
          <h3>
            <Link to={`${detailBasePath}/${quest.id}`}>{quest.title}</Link>
          </h3>
          <div className="meta">
            <span>ID: <code>{quest.id}</code></span>
            {mode === 'admin' && (
              <span>
                담당: {quest.assigneeName ?? '—'} (<code>{quest.assigneeId}</code>)
              </span>
            )}
            <span>마감: {formatDateTimeToMinute(quest.deadline)}</span>
            {overdue && <span style={{ color: 'var(--danger)' }}>⚠ 기한 경과</span>}
          </div>
        </div>
        <span
          className="badge"
          style={{ background: QUEST_STATUS_COLOR[quest.status] }}
        >
          {QUEST_STATUS_LABEL[quest.status]}
        </span>
      </header>

      <p>{quest.description}</p>

      {quest.proofFileName && (
        <div className="meta quest-proof-actions">
          📎 증빙:&nbsp;
          <button type="button" className="ghost" onClick={() => void handlePreviewProof()}>
            미리보기
          </button>
          <button type="button" className="ghost" onClick={() => void handleDownloadProof()}>
            {quest.proofFileName}
          </button>
        </div>
      )}

      {quest.feedback && mode === 'employee' && (
        <div className="feedback">💬 피드백: {quest.feedback}</div>
      )}

      {mode === 'employee' && quest.status === QuestStatus.PENDING && (
        <div className="quest-actions" style={{ marginTop: '0.75rem' }}>
          <button type="button" onClick={() => void handleStart()} disabled={busy}>
            {busy ? '처리 중…' : '착수하기'}
          </button>
        </div>
      )}

      {mode === 'employee' && quest.status !== QuestStatus.COMPLETED && canSubmitProof && (
        <div style={{ marginTop: '0.75rem' }}>
          <label htmlFor={`note-${quest.id}`}>추가 설명 (선택)</label>
          <textarea
            id={`note-${quest.id}`}
            value={draftNote}
            onChange={(e) => setDraftNote(e.target.value)}
            placeholder="수행 내용이나 참고 사항을 적어도 됩니다."
            maxLength={5000}
            rows={3}
            style={{ marginTop: '0.35rem' }}
          />
          <div className="meta" style={{ marginTop: '0.35rem' }}>
            {draftNote.length} / 5000자
          </div>

          <input
            type="file"
            ref={fileInputRef}
            accept={ALLOWED_PROOF_ACCEPT}
            onChange={(e) => pickFile(e.target.files?.[0])}
            style={{ display: 'none' }}
          />
          <div
            className={`dropzone${dragOver ? ' dropzone-active' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              pickFile(e.dataTransfer.files?.[0]);
            }}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
            }}
          >
            {draftFile
              ? `선택: ${draftFile.name}`
              : '파일을 드래그하거나 클릭해 선택 (이미지·PDF·문서 등)'}
          </div>
          {previewUrl && (
            <img src={previewUrl} alt="선택한 미리보기" className="proof-thumb" />
          )}

          <div className="quest-actions" style={{ marginTop: '0.75rem' }}>
            <button type="button" onClick={() => void handleSubmitProof()} disabled={busy}>
              {busy ? '처리 중…' : submitLabel}
            </button>
          </div>
          {proofAttached && quest.status === QuestStatus.SUBMITTED && (
            <p className="text-muted" style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
              관리자 검토 대기 중입니다. 파일을 바꾸려면 새 파일을 선택한 뒤 {submitLabel}하세요.
            </p>
          )}
        </div>
      )}

      {mode === 'admin' && quest.status === QuestStatus.SUBMITTED && (
        <div style={{ marginTop: '0.5rem' }}>
          {quest.submissionNote && (
            <div className="feedback" style={{ whiteSpace: 'pre-wrap' }}>
              📝 사원 설명: {quest.submissionNote}
            </div>
          )}
          <label>검토 피드백</label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="반려 시 피드백 필수"
          />
          <div className="quest-actions">
            <button
              type="button"
              className="success"
              onClick={() => void handleReview(QuestStatus.COMPLETED)}
              disabled={busy}
            >
              완료 승인
            </button>
            <button
              type="button"
              className="danger"
              onClick={() => void handleReview(QuestStatus.REJECTED)}
              disabled={busy}
            >
              반려
            </button>
          </div>
        </div>
      )}

      <p className="text-muted" style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
        <Link to={`${detailBasePath}/${quest.id}`}>상세 보기 →</Link>
      </p>
    </article>
  );
}

