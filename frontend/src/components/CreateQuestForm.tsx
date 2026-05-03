import { useState } from 'react';
import { useQuestStore } from '../store/questStore';

interface FormErrors {
  title?: string;
  description?: string;
  deadline?: string;
}

/**
 * 관리자용 퀘스트 생성 폼.
 * 요구사항명세서 §관리자 요구 기능 — 제목/설명/마감기한 유효성 검사 포함.
 */
export function CreateQuestForm() {
  const { createQuest } = useQuestStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const validate = (): FormErrors => {
    const err: FormErrors = {};
    if (!title.trim()) err.title = '제목을 입력하세요.';
    else if (title.trim().length < 2) err.title = '제목은 최소 2자 이상이어야 합니다.';
    else if (title.length > 120) err.title = '제목은 120자 이내여야 합니다.';

    if (!description.trim()) err.description = '설명을 입력하세요.';
    else if (description.length > 5000) err.description = '설명은 5,000자 이내여야 합니다.';

    if (!deadline) err.deadline = '마감 기한을 선택하세요.';
    else if (new Date(deadline).getTime() <= Date.now())
      err.deadline = '마감 기한은 현재 시각 이후여야 합니다.';

    return err;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    setErrors(err);
    if (Object.keys(err).length > 0) return;

    setSubmitting(true);
    try {
      await createQuest({
        title: title.trim(),
        description: description.trim(),
        deadline: new Date(deadline).toISOString(),
        assigneeId: assigneeId.trim() || undefined,
      });
      setTitle('');
      setDescription('');
      setDeadline('');
      setAssigneeId('');
      setErrors({});
    } catch (ex) {
      alert(`생성 실패: ${(ex as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="card">
      <h2 className="section-title" style={{ marginTop: 0 }}>🎯 새 퀘스트 생성</h2>
      <form onSubmit={handleSubmit} noValidate>
        <div style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="title">제목</label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 팀 소개 페이지 작성"
            maxLength={120}
          />
          {errors.title && <div className="field-error">{errors.title}</div>}
        </div>

        <div style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="description">설명</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="퀘스트의 목적과 제출 방법을 구체적으로 기입하세요."
          />
          {errors.description && <div className="field-error">{errors.description}</div>}
        </div>

        <div className="grid grid-2" style={{ marginBottom: '0.75rem' }}>
          <div>
            <label htmlFor="deadline">마감 기한</label>
            <input
              id="deadline"
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
            {errors.deadline && <div className="field-error">{errors.deadline}</div>}
          </div>
          <div>
            <label htmlFor="assignee">담당자 ID (선택)</label>
            <input
              id="assignee"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              placeholder="신입 사원 Slack ID"
            />
          </div>
        </div>

        <button type="submit" disabled={submitting}>
          {submitting ? '생성 중…' : '퀘스트 생성'}
        </button>
      </form>
    </section>
  );
}
