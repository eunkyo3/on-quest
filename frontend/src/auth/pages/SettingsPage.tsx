import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../../store/toastStore';

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);

  const [name, setName] = useState(user?.name ?? '');
  const [slackMemberId, setSlackMemberId] = useState(user?.slackMemberId ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setSlackMemberId(user.slackMemberId);
    }
  }, [user]);

  if (!user) {
    return <div className="empty">로그인이 필요합니다.</div>;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await updateProfile({
        name: name.trim(),
        slackMemberId: slackMemberId.trim(),
        ...(newPassword
          ? { newPassword, currentPassword }
          : {}),
      });
      useToastStore.getState().push('프로필이 저장되었습니다.', 'success');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      useToastStore.getState().push(
        err instanceof Error ? err.message : '저장에 실패했습니다.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  const dashboardPath = user.role === 'admin' ? '/admin' : '/employee';

  return (
    <div className="grid" style={{ maxWidth: 520 }}>
      <p>
        <Link to={dashboardPath}>← 대시보드</Link>
      </p>
      <h2 className="section-title">⚙️ 설정</h2>
      <form className="card" onSubmit={(e) => void onSubmit(e)}>
        <label htmlFor="settings-email">이메일 (변경 불가)</label>
        <input id="settings-email" type="email" value={user.email} disabled />

        <label htmlFor="settings-company" style={{ marginTop: '1rem' }}>
          회사코드 (변경 불가)
        </label>
        <input id="settings-company" value={user.companyCode} disabled />

        <label htmlFor="settings-role" style={{ marginTop: '1rem' }}>
          역할
        </label>
        <input
          id="settings-role"
          value={user.role === 'admin' ? '관리자' : '사원'}
          disabled
        />

        <label htmlFor="settings-name" style={{ marginTop: '1rem' }}>
          이름
        </label>
        <input
          id="settings-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          required
        />

        <label htmlFor="settings-slack" style={{ marginTop: '1rem' }}>
          Slack 멤버 ID
        </label>
        <input
          id="settings-slack"
          value={slackMemberId}
          onChange={(e) => setSlackMemberId(e.target.value)}
          maxLength={64}
          required
        />

        <h3 style={{ marginTop: '1.5rem', fontSize: '1rem' }}>비밀번호 변경 (선택)</h3>
        <label htmlFor="settings-current-pw">현재 비밀번호</label>
        <input
          id="settings-current-pw"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
        />

        <label htmlFor="settings-new-pw" style={{ marginTop: '0.75rem' }}>
          새 비밀번호 (6자 이상)
        </label>
        <input
          id="settings-new-pw"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          minLength={6}
          autoComplete="new-password"
        />

        <div className="quest-actions" style={{ marginTop: '1.25rem' }}>
          <button type="submit" disabled={busy}>
            {busy ? '저장 중…' : '저장'}
          </button>
        </div>
      </form>
    </div>
  );
}
