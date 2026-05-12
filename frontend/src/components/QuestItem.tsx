import { useEffect, useRef, useState } from 'react';
import { questApi } from '../api/questApi';
import { useQuestStore } from '../store/questStore';
import {
  QUEST_STATUS_COLOR,
  QUEST_STATUS_LABEL,
  QuestStatus,
  type Quest,
} from '../types/quest';

interface Props {
  quest: Quest;
  mode: 'employee' | 'admin';
}

function hasProofFile(q: Quest): boolean {
  return Boolean(q.proofFileName?.trim());
}

export function QuestItem({ quest, mode }: Props) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(quest.feedback ?? '');
  const [draftNote, setDraftNote] = useState(quest.submissionNote ?? '');
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadProof, reviewQuest } = useQuestStore();
  const proofAttached = hasProofFile(quest);

  useEffect(() => {
    setDraftNote(quest.submissionNote ?? '');
    setDraftFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [quest.id, quest.updatedAt, quest.submissionNote]);

  const deadline = new Date(quest.deadline);
  const overdue = deadline.getTime() < Date.now() && quest.status !== QuestStatus.COMPLETED;

  const handlePickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setDraftFile(file ?? null);
  };

  const handleSubmitProof = async () => {
    if (!draftFile) {
      alert('증빙 파일을 선택한 뒤 제출해 주세요.');
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
    } catch (err) {
      alert(`제출 실패: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleReview = async (status: QuestStatus.COMPLETED | QuestStatus.REJECTED) => {
    if (status === QuestStatus.REJECTED && !feedback.trim()) {
      alert('반려 시에는 피드백을 반드시 입력해주세요.');
      return;
    }
    setBusy(true);
    try {
      await reviewQuest(quest.id, { status, feedback: feedback.trim() || undefined });
    } catch (err) {
      alert(`검토 실패: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadProof = async () => {
    try {
      await questApi.downloadProof(quest.id, quest.proofFileName);
    } catch (err) {
      alert(`다운로드 실패: ${(err as Error).message}`);
    }
  };

  const submitLabel = quest.status === QuestStatus.REJECTED ? '재제출' : '제출';

  return (
    <article className="quest-item">
      <header>
        <div>
          <h3>{quest.title}</h3>
          <div className="meta">
            <span>ID: <code>{quest.id}</code></span>
            <span>마감: {deadline.toLocaleString('ko-KR')}</span>
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
        <div className="meta">
          📎 증빙:&nbsp;
          <button type="button" className="ghost" onClick={handleDownloadProof}>
            {quest.proofFileName}
          </button>
        </div>
      )}

      {quest.feedback && mode === 'employee' && (
        <div className="feedback">💬 피드백: {quest.feedback}</div>
      )}

      {mode === 'employee' && quest.status !== QuestStatus.COMPLETED && (
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
            onChange={handlePickFile}
            style={{ display: 'none' }}
          />
          <div className="quest-actions" style={{ marginTop: '0.75rem' }}>
            <button
              type="button"
              className="ghost"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
            >
              {draftFile ? `선택된 파일: ${draftFile.name}` : '증빙 파일 선택'}
            </button>
            <button type="button" onClick={() => void handleSubmitProof()} disabled={busy}>
              {busy ? '처리 중…' : submitLabel}
            </button>
          </div>
          {proofAttached && quest.status === QuestStatus.IN_PROGRESS && (
            <p className="text-muted" style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
              관리자 검토 대기 중입니다. 파일을 바꾸려면 새 파일을 선택한 뒤 {submitLabel}하세요.
            </p>
          )}
        </div>
      )}

      {mode === 'admin' && proofAttached && quest.status !== QuestStatus.COMPLETED && (
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
    </article>
  );
}
