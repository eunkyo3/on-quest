import { useRef, useState } from 'react';
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

export function QuestItem({ quest, mode }: Props) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(quest.feedback ?? '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadProof, reviewQuest } = useQuestStore();

  const deadline = new Date(quest.deadline);
  const overdue = deadline.getTime() < Date.now() && quest.status !== QuestStatus.COMPLETED;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      await uploadProof(quest.id, file);
    } catch (err) {
      alert(`업로드 실패: ${(err as Error).message}`);
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
          <a href={questApi.proofDownloadUrl(quest.id)} target="_blank" rel="noreferrer">
            {quest.proofFileName}
          </a>
        </div>
      )}

      {quest.feedback && mode === 'employee' && (
        <div className="feedback">💬 피드백: {quest.feedback}</div>
      )}

      {mode === 'employee' && quest.status !== QuestStatus.COMPLETED && (
        <div className="quest-actions">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUpload}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            {quest.hasProof ? '증빙 재업로드' : '증빙 업로드'}
          </button>
        </div>
      )}

      {mode === 'admin' && quest.hasProof && quest.status !== QuestStatus.COMPLETED && (
        <div style={{ marginTop: '0.5rem' }}>
          <label>검토 피드백</label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="반려 시 피드백 필수"
          />
          <div className="quest-actions">
            <button
              className="success"
              onClick={() => handleReview(QuestStatus.COMPLETED)}
              disabled={busy}
            >
              완료 승인
            </button>
            <button
              className="danger"
              onClick={() => handleReview(QuestStatus.REJECTED)}
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
