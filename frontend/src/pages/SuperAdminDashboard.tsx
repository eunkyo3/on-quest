import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProgressDashboard } from '../components/ProgressDashboard';
import { userApi, type AuditLogRow, type ManagedUser } from '../auth/api/userApi';
import { useAuthStore } from '../auth/store/authStore';
import { useQuestStore } from '../store/questStore';
import { useToastStore } from '../store/toastStore';
import { ROLE_LABEL, ROLES } from '../types/role';
import { formatDateTimeToMinute } from '../utils/formatDateTime';

const AUDIT_ACTION_LABEL: Record<string, string> = {
  'user.role_changed': '역할 변경',
  'user.ownership_transferred': '권한 이양',
  'quest.approved': '퀘스트 승인',
  'quest.rejected': '퀘스트 반려',
  'quest.declined': '퀘스트 거부',
  'quest.reopened': '퀘스트 재개봉',
  'quest.deleted': '퀘스트 삭제',
};

export default function SuperAdminDashboard() {
  const me = useAuthStore((s) => s.user);
  const patchUser = useAuthStore((s) => s.patchUser);
  const navigate = useNavigate();
  const { stats, fetchStats } = useQuestStore();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await userApi.list();
      setUsers(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : '사용자 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    try {
      setLogs(await userApi.auditLogs(50));
    } catch {
      setLogs([]);
    }
  }, []);

  useEffect(() => {
    void fetchStats();
    void loadUsers();
    void loadLogs();
  }, [fetchStats, loadUsers, loadLogs]);

  const counts = useMemo(() => {
    const c = { superadmin: 0, admin: 0, employee: 0 };
    for (const u of users) {
      if (u.role in c) c[u.role as keyof typeof c] += 1;
    }
    return c;
  }, [users]);

  const handleRoleChange = async (
    target: ManagedUser,
    role: 'admin' | 'employee',
  ) => {
    const label = role === ROLES.ADMIN ? '관리자로 지정' : '신입사원으로 변경';
    if (!window.confirm(`${target.name} 님을 ${label}할까요?`)) return;
    setBusyId(target.id);
    try {
      const updated = await userApi.updateRole(target.id, role);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      useToastStore.getState().push(`${target.name} 님의 역할을 변경했습니다.`, 'success');
      void loadLogs();
    } catch (e) {
      useToastStore.getState().push(
        e instanceof Error ? e.message : '역할 변경에 실패했습니다.',
        'error',
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleTransfer = async (target: ManagedUser) => {
    if (
      !window.confirm(
        `${target.name} 님에게 슈퍼관리자 권한을 이양합니다.\n이양 후 나(${me?.name})는 관리자(admin)로 변경되며, 이 화면을 더 이상 사용할 수 없습니다. 계속할까요?`,
      )
    ) {
      return;
    }
    setBusyId(target.id);
    try {
      await userApi.transferOwnership(target.id);
      // 본인은 관리자로 강등됨 → 로컬 사용자 정보 갱신 후 퀘스트 관리 화면으로 이동
      patchUser({ role: ROLES.ADMIN });
      useToastStore.getState().push('슈퍼관리자 권한을 이양했습니다.', 'success');
      navigate('/admin', { replace: true });
    } catch (e) {
      useToastStore.getState().push(
        e instanceof Error ? e.message : '권한 이양에 실패했습니다.',
        'error',
      );
      setBusyId(null);
    }
  };

  return (
    <div className="grid superadmin-shell" style={{ gap: '1.5rem' }}>
      <section className="card role-banner role-banner-superadmin">
        <div>
          <h2 style={{ margin: 0 }}>슈퍼관리자 콘솔</h2>
          <p className="text-muted" style={{ margin: '0.35rem 0 0' }}>
            구성원의 역할을 관리하고 전사 퀘스트 현황과 변경 이력을 확인합니다.
          </p>
        </div>
        <div className="role-banner-counts">
          <div>
            <span className="value">{counts.admin}</span>
            <span className="label">관리자</span>
          </div>
          <div>
            <span className="value">{counts.employee}</span>
            <span className="label">신입사원</span>
          </div>
          <div>
            <span className="value">{users.length}</span>
            <span className="label">전체 구성원</span>
          </div>
        </div>
      </section>

      <ProgressDashboard stats={stats} title="전사 퀘스트 현황" />

      <section>
        <h2 className="section-title">구성원 역할 관리</h2>
        {error && <div className="feedback">{error}</div>}
        {loading ? (
          <div className="empty">불러오는 중…</div>
        ) : users.length === 0 ? (
          <div className="empty">등록된 구성원이 없습니다.</div>
        ) : (
          <div className="card table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">이름</th>
                  <th scope="col">이메일</th>
                  <th scope="col">Slack ID</th>
                  <th scope="col">역할</th>
                  <th scope="col">가입일</th>
                  <th scope="col">역할 변경</th>
                  <th scope="col">권한 이양</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = u.id === me?.id;
                  const isSuper = u.role === ROLES.SUPERADMIN;
                  const busy = busyId === u.id;
                  return (
                    <tr key={u.id}>
                      <td>{u.name}{isSelf && <span className="text-muted"> (나)</span>}</td>
                      <td>{u.email}</td>
                      <td className="mono">{u.slackMemberId}</td>
                      <td>
                        <span className={`role-pill role-pill-${u.role}`}>
                          {ROLE_LABEL[u.role] ?? u.role}
                        </span>
                      </td>
                      <td>{formatDateTimeToMinute(u.createdAt)}</td>
                      <td>
                        {isSuper ? (
                          <span className="text-muted">—</span>
                        ) : u.role === ROLES.EMPLOYEE ? (
                          <button
                            type="button"
                            className="ghost"
                            disabled={busy}
                            onClick={() => void handleRoleChange(u, 'admin')}
                          >
                            관리자로 지정
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="ghost"
                            disabled={busy}
                            onClick={() => void handleRoleChange(u, 'employee')}
                          >
                            신입사원으로 변경
                          </button>
                        )}
                      </td>
                      <td>
                        {isSuper ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <button
                            type="button"
                            className="ghost"
                            disabled={busy}
                            onClick={() => void handleTransfer(u)}
                          >
                            이 사람에게 이양
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="section-title">변경 이력 (감사 로그)</h2>
        {logs.length === 0 ? (
          <div className="empty">기록된 변경 이력이 없습니다.</div>
        ) : (
          <div className="card table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">시각</th>
                  <th scope="col">수행자</th>
                  <th scope="col">동작</th>
                  <th scope="col">상세</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDateTimeToMinute(log.createdAt)}</td>
                    <td>{log.actorName}</td>
                    <td>{AUDIT_ACTION_LABEL[log.action] ?? log.action}</td>
                    <td>{log.detail ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
