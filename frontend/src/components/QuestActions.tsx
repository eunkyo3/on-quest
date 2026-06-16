import { useEffect, useRef, useState } from 'react';
import { questApi } from '../api/questApi';
import { useQuestStore } from '../store/questStore';
import { useToastStore } from '../store/toastStore';
import {
  ALLOWED_PROOF_ACCEPT,
  QuestStatus,
  type Quest,
} from '../types/quest';
import { ProofPreviewModal } from './ProofPreviewModal';

interface Props {
  quest: Quest;
  mode: 'employee' | 'admin';
  /** 액션 성공 후 갱신된 퀘스트를 상위로 전달(상세 페이지 로컬 상태 동기화용) */
  onUpdated?: (quest: Quest) => void;
}

function hasProofFile(q: Quest): boolean {
  return Boolean(q.proofFileName?.trim());
}

/**
 * 퀘스트 한 건에 대한 역할별 상호작용 영역.
 * - 사원: 착수 / 거부 / 증빙 제출(재제출) / 피드백·거부사유 확인
 * - 관리자: 검토(승인·반려) / 증빙 확인
 * 테이블의 펼친 행과 상세 페이지에서 공통으로 사용한다.
 */
export function QuestActions({ quest, mode, onUpdated }: Props) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(quest.feedback ?? '');
  const [draftNote, setDraftNote] = useState(quest.submissionNote ?? '');
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [proofModalUrl, setProofModalUrl] = useState<string | null>(null);
  const [proofModalOpen, setProofModalOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadProof, reviewQuest, startQuest, declineQuest } = useQuestStore();
  const proofAttached = hasProofFile(quest);

  useEffect(() => {
    setDraftNote(quest.submissionNote ?? '');
    setDraftFile(null);
    setDeclineOpen(false);
    setDeclineReason('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [quest.id, quest.updatedAt, quest.submissionNote]);

  // 미리보기 모달 URL은 ref로 추적해 '언마운트 시에만' 해제한다.
  // (previewUrl 변경 때마다 모달 URL이 잘못 해제돼 열린 이미지가 사라지던 버그 방지)
  const proofModalUrlRef = useRef<string | null>(null);
  useEffect(() => {
    proofModalUrlRef.current = proofModalUrl;
  }, [proofModalUrl]);
  useEffect(
    () => () => {
      if (proofModalUrlRef.current) URL.revokeObjectURL(proofModalUrlRef.current);
    },
    [],
  );

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

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    setDraftFile(file);
  };

  const handleSubmitProof = async () => {
    if (!draftFile) {
      useToastStore.getState().push('증빙 파일을 선택한 뒤 제출해 주세요.', 'error');
      return;
    }
    const isResubmit =
      quest.status === QuestStatus.REJECTED || quest.status === QuestStatus.SUBMITTED;
    const msg = isResubmit
      ? '선택한 증빙 파일과 추가 설명(입력한 경우)으로 다시 제출합니다. 정말 제출할까요?'
      : '선택한 증빙 파일과 추가 설명(입력한 경우)으로 제출합니다. 정말 제출할까요?';
    if (!window.confirm(msg)) return;

    setBusy(true);
    try {
      const updated = await uploadProof(quest.id, draftFile, draftNote);
      onUpdated?.(updated);
    } finally {
      setBusy(false);
    }
  };

  const handleStart = async () => {
    setBusy(true);
    try {
      const updated = await startQuest(quest.id);
      onUpdated?.(updated);
    } finally {
      setBusy(false);
    }
  };

  const handleDecline = async () => {
    if (!declineReason.trim()) {
      useToastStore.getState().push('거부 사유를 입력해 주세요.', 'error');
      return;
    }
    if (!window.confirm('이 퀘스트의 수행을 거부합니다. 계속할까요?')) return;
    setBusy(true);
    try {
      const updated = await declineQuest(quest.id, { reason: declineReason.trim() });
      setDeclineOpen(false);
      onUpdated?.(updated);
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
      const updated = await reviewQuest(quest.id, {
        status,
        feedback: feedback.trim() || undefined,
      });
      onUpdated?.(updated);
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
      const mime = blob.type || quest.proofMimeType || '';
      if (!mime.startsWith('image/')) {
        window.alert(
          '이미지 파일만 미리보기할 수 있습니다. 다른 형식은 다운로드 버튼을 이용해 주세요.',
        );
        return;
      }
      if (proofModalUrl) URL.revokeObjectURL(proofModalUrl);
      const url = URL.createObjectURL(blob);
      setProofModalUrl(url);
      setProofModalOpen(true);
    } catch (err) {
      useToastStore.getState().push(
        err instanceof Error ? err.message : '미리보기 실패',
        'error',
      );
    }
  };

  const closeProofModal = () => {
    setProofModalOpen(false);
    if (proofModalUrl) {
      URL.revokeObjectURL(proofModalUrl);
      setProofModalUrl(null);
    }
  };

  const canSubmitProof =
    quest.status === QuestStatus.IN_PROGRESS ||
    quest.status === QuestStatus.SUBMITTED ||
    quest.status === QuestStatus.REJECTED;

  const canDecline =
    mode === 'employee' &&
    (quest.status === QuestStatus.PENDING ||
      quest.status === QuestStatus.IN_PROGRESS);

  const submitLabel = quest.status === QuestStatus.REJECTED ? '재제출' : '제출';

  return (
    <>
      <ProofPreviewModal
        open={proofModalOpen}
        imageUrl={proofModalUrl}
        fileName={quest.proofFileName}
        onClose={closeProofModal}
      />

      {quest.proofFileName && (
        <div className="meta quest-proof-actions">
          증빙:&nbsp;
          <button type="button" className="ghost" onClick={() => void handlePreviewProof()}>
            미리보기
          </button>
          <button type="button" className="ghost" onClick={() => void handleDownloadProof()}>
            {quest.proofFileName}
          </button>
        </div>
      )}

      {quest.feedback && mode === 'employee' && (
        <div className="feedback">검토 피드백: {quest.feedback}</div>
      )}

      {quest.status === QuestStatus.DECLINED && quest.declineReason && (
        <div className="feedback feedback-muted">
          {mode === 'admin' ? '사원 거부 사유' : '내가 입력한 거부 사유'}: {quest.declineReason}
        </div>
      )}

      {mode === 'employee' && quest.status === QuestStatus.PENDING && (
        <div className="quest-actions" style={{ marginTop: '0.75rem' }}>
          <button type="button" onClick={() => void handleStart()} disabled={busy}>
            {busy ? '처리 중…' : '착수하기'}
          </button>
        </div>
      )}

      {canDecline && (
        <div style={{ marginTop: '0.75rem' }}>
          {declineOpen ? (
            <div>
              <label htmlFor={`decline-${quest.id}`}>거부 사유 (필수)</label>
              <textarea
                id={`decline-${quest.id}`}
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="이 퀘스트를 수행하기 어려운 이유를 적어주세요."
                maxLength={2000}
                rows={3}
                style={{ marginTop: '0.35rem' }}
              />
              <div className="quest-actions" style={{ marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="danger"
                  onClick={() => void handleDecline()}
                  disabled={busy}
                >
                  {busy ? '처리 중…' : '거부 확정'}
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    setDeclineOpen(false);
                    setDeclineReason('');
                  }}
                  disabled={busy}
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="ghost"
              onClick={() => setDeclineOpen(true)}
              disabled={busy}
            >
              퀘스트 거부
            </button>
          )}
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
              관리자 검토 대기 중입니다. 아직 확인 전이므로 새 파일·설명으로 수정하여 다시 제출할 수 있습니다.
            </p>
          )}
        </div>
      )}

      {mode === 'admin' && quest.status === QuestStatus.SUBMITTED && (
        <div style={{ marginTop: '0.5rem' }}>
          {quest.submissionNote && (
            <div className="feedback feedback-muted" style={{ whiteSpace: 'pre-wrap' }}>
              사원 설명: {quest.submissionNote}
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
    </>
  );
}
