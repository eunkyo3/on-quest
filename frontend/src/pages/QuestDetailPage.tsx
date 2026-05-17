import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { questApi } from '../api/questApi';
import { QuestItem } from '../components/QuestItem';
import { useQuestStore } from '../store/questStore';
import { useToastStore } from '../store/toastStore';
import { QuestStatus, type Quest } from '../types/quest';
import { formatDateTimeToMinute } from '../utils/formatDateTime';

interface Props {
  mode: 'employee' | 'admin';
  listPath: string;
}

export default function QuestDetailPage({ mode, listPath }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { updateQuest, deleteQuest, upsertQuest } = useQuestStore();
  const [quest, setQuest] = useState<Quest | null>(null);
  const [loading, setLoading] = useState(true);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const q = await questApi.getOne(id);
        if (!cancelled) {
          setQuest(q);
          setEditTitle(q.title);
          setEditDescription(q.description);
          setEditDeadline(q.deadline.slice(0, 16));
        }
      } catch (e) {
        useToastStore.getState().push(
          e instanceof Error ? e.message : '불러오기 실패',
          'error',
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleSaveEdit = async () => {
    if (!quest) return;
    setSaving(true);
    try {
      const updated = await updateQuest(quest.id, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        deadline: new Date(editDeadline).toISOString(),
      });
      setQuest(updated);
      upsertQuest(updated);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!quest) return;
    if (!window.confirm('이 퀘스트를 삭제할까요?')) return;
    try {
      await deleteQuest(quest.id);
      navigate(listPath);
    } catch {
      /* toast handled */
    }
  };

  if (loading) return <div className="empty">불러오는 중…</div>;
  if (!quest) {
    return (
      <div>
        <p className="feedback">퀘스트를 찾을 수 없습니다.</p>
        <Link to={listPath}>← 목록</Link>
      </div>
    );
  }

  const canEdit = mode === 'admin' && quest.status === QuestStatus.PENDING;

  return (
    <div className="grid" style={{ gap: '1rem' }}>
      <p>
        <Link to={listPath}>← 목록</Link>
      </p>

      {canEdit && (
        <section className="card">
          <h2 className="section-title">퀘스트 수정 (대기 상태)</h2>
          <label htmlFor="edit-title">제목</label>
          <input
            id="edit-title"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
          />
          <label htmlFor="edit-desc" style={{ marginTop: '0.75rem' }}>
            설명
          </label>
          <textarea
            id="edit-desc"
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            rows={4}
          />
          <label htmlFor="edit-deadline" style={{ marginTop: '0.75rem' }}>
            마감
          </label>
          <input
            id="edit-deadline"
            type="datetime-local"
            value={editDeadline}
            onChange={(e) => setEditDeadline(e.target.value)}
          />
          <div className="quest-actions" style={{ marginTop: '1rem' }}>
            <button type="button" onClick={() => void handleSaveEdit()} disabled={saving}>
              {saving ? '저장 중…' : '저장'}
            </button>
            <button type="button" className="danger" onClick={() => void handleDelete()}>
              삭제
            </button>
          </div>
        </section>
      )}

      <section className="card text-muted" style={{ fontSize: '0.9rem' }}>
        생성 {formatDateTimeToMinute(quest.createdAt)} · 수정{' '}
        {formatDateTimeToMinute(quest.updatedAt)}
      </section>

      <QuestItem quest={quest} mode={mode} detailBasePath={listPath} />
    </div>
  );
}
