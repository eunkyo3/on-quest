import { useEffect, useState } from 'react';
import { questApi } from '../api/questApi';
import type { AssignableEmployee } from '../types/quest';
import { useQuestStore } from '../store/questStore';

interface FormErrors {
  title?: string;
  description?: string;
  deadline?: string;
  assigneeId?: string;
}

/**
 * 관리자용 퀘스트 생성 폼.
 * 담당자는 동일 회사코드 사원 목록에서 선택합니다.
 */
export function CreateQuestForm() {
  const { createQuest } = useQuestStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [employees, setEmployees] = useState<AssignableEmployee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [employeesError, setEmployeesError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setEmployeesLoading(true);
      setEmployeesError(null);
      try {
        const list = await questApi.assignableEmployees();
        if (!cancelled) setEmployees(list);
      } catch {
        if (!cancelled) {
          setEmployees([]);
          setEmployeesError('사원 목록을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.');
        }
      } finally {
        if (!cancelled) setEmployeesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

    if (!assigneeId.trim()) err.assigneeId = '담당 사원을 목록에서 선택하세요.';

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
        assigneeId: assigneeId.trim(),
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
            <label htmlFor="assignee">담당 사원</label>
            {employeesLoading ? (
              <div className="text-muted" style={{ padding: '0.5rem 0' }}>사원 목록 불러오는 중…</div>
            ) : (
              <select
                id="assignee"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                disabled={employees.length === 0}
              >
                <option value="">담당 사원을 선택하세요</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.slackMemberId}>
                    {emp.name} · {emp.email}
                  </option>
                ))}
              </select>
            )}
            {employeesError && <div className="field-error">{employeesError}</div>}
            {!employeesLoading && !employeesError && employees.length === 0 && (
              <div className="field-error">같은 회사코드로 등록된 사원이 없습니다.</div>
            )}
            {errors.assigneeId && <div className="field-error">{errors.assigneeId}</div>}
          </div>
        </div>

        <button type="submit" disabled={submitting || employeesLoading || employees.length === 0}>
          {submitting ? '생성 중…' : '퀘스트 생성'}
        </button>
      </form>
    </section>
  );
}
