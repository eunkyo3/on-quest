import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { questApi } from '../api/questApi';
import { QuestActions } from '../components/QuestActions';
import { useQuestStore } from '../store/questStore';
import { useToastStore } from '../store/toastStore';
import {
  QUEST_STATUS_COLOR,
  QUEST_STATUS_LABEL,
  QuestStatus,
  type AssignableEmployee,
  type Quest,
} from '../types/quest';
import { formatDateTimeToMinute } from '../utils/formatDateTime';

interface Props {
  mode: 'employee' | 'admin';
  listPath: string;
}

export default function QuestDetailPage({ mode, listPath }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { updateQuest, deleteQuest, reopenQuest, upsertQuest } = useQuestStore();
  const [quest, setQuest] = useState<Quest | null>(null);
  const [loading, setLoading] = useState(true);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [saving, setSaving] = useState(false);
  const [reassignId, setReassignId] = useState('');
  const [employees, setEmployees] = useState<AssignableEmployee[]>([]);
  const [reopening, setReopening] = useState(false);

  const isDeclinedAdmin = mode === 'admin' && quest?.status === QuestStatus.DECLINED;

  useEffect(() => {
    if (!isDeclinedAdmin) return;
    let cancelled = false;
    void questApi
      .assignableEmployees()
      .then((list) => {
        if (!cancelled) setEmployees(list);
      })
      .catch(() => {
        if (!cancelled) setEmployees([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isDeclinedAdmin]);

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

  const handleReopen = async () => {
    if (!quest) return;
    const reassign = reassignId.trim();
    const msg = reassign
      ? '담당자를 재배정하면서 이 퀘스트를 대기 상태로 재개봉합니다. 계속할까요?'
      : '이 퀘스트를 대기 상태로 재개봉합니다. 계속할까요?';
    if (!window.confirm(msg)) return;
    setReopening(true);
    try {
      const updated = await reopenQuest(
        quest.id,
        reassign ? { assigneeId: reassign } : {},
      );
      setQuest(updated);
      setReassignId('');
    } catch {
      /* toast handled */
    } finally {
      setReopening(false);
    }
  };

  if (loading) return <div className="empty">불러오는 중…</div>;
  if (!quest) {
    return (
      <div>
        <p className="alert-error">퀘스트를 찾을 수 없습니다.</p>
        <Link to={listPath}>← 목록</Link>
      </div>
    );
  }

  const canEdit = mode === 'admin' && quest.status === QuestStatus.PENDING;
  const canDeleteOnly =
    mode === 'admin' && quest.status === QuestStatus.DECLINED;

  return (
    <div className="grid" style={{ gap: '1rem' }}>
      <p>
        <Link to={listPath}>← 목록</Link>
      </p>

      {canDeleteOnly && (
        <section className="card">
          <h2 className="section-title">거부된 퀘스트 처리</h2>
          <p className="text-muted" style={{ marginTop: 0 }}>
            담당 사원이 수행을 거부했습니다. 사유를 확인한 뒤 같은/다른 담당자로 재개봉하거나 삭제할 수 있습니다.
          </p>
          {quest.declineReason && (
            <div className="feedback feedback-muted">거부 사유: {quest.declineReason}</div>
          )}
          <label htmlFor="reassign" style={{ marginTop: '0.75rem' }}>
            담당자 재배정 (선택 — 비우면 기존 담당자 유지)
          </label>
          <select
            id="reassign"
            value={reassignId}
            onChange={(e) => setReassignId(e.target.value)}
          >
            <option value="">기존 담당자 유지 ({quest.assigneeName ?? quest.assigneeId})</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.slackMemberId}>
                {emp.name} · {emp.email}
              </option>
            ))}
          </select>
          <div className="quest-actions" style={{ marginTop: '1rem' }}>
            <button type="button" onClick={() => void handleReopen()} disabled={reopening}>
              {reopening ? '처리 중…' : '재개봉'}
            </button>
            <button type="button" className="danger" onClick={() => void handleDelete()}>
              삭제
            </button>
          </div>
        </section>
      )}

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

      <section className="card quest-detail-card">
        <div className="quest-detail-head">
          <h2 style={{ margin: 0 }}>{quest.title}</h2>
          <span
            className="badge"
            style={{ background: QUEST_STATUS_COLOR[quest.status] }}
          >
            {QUEST_STATUS_LABEL[quest.status]}
          </span>
        </div>
        <div className="meta" style={{ marginTop: '0.5rem' }}>
          <span>ID: <code className="mono">{quest.id}</code></span>
          {mode === 'admin' && (
            <span>
              담당: {quest.assigneeName ?? '—'} (<code className="mono">{quest.assigneeId}</code>)
            </span>
          )}
          <span>마감: {formatDateTimeToMinute(quest.deadline)}</span>
        </div>
        <p className="quest-detail-desc">{quest.description}</p>

        <QuestActions quest={quest} mode={mode} onUpdated={setQuest} />

        <p className="text-muted" style={{ marginTop: '1rem', fontSize: '0.82rem' }}>
          생성 {formatDateTimeToMinute(quest.createdAt)} · 수정{' '}
          {formatDateTimeToMinute(quest.updatedAt)}
        </p>
      </section>
    </div>
  );
}
