import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function SignupPage() {
  const navigate = useNavigate();
  const signup = useAuthStore((s) => s.signup);

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [slackMemberId, setSlackMemberId] = useState('');
  const [companyCode, setCompanyCode] = useState('');
  const [role, setRole] = useState<'employee' | 'admin'>('employee');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signup({
        email,
        name,
        password,
        slackMemberId,
        companyCode,
        role,
      });
      const home = role === 'admin' ? '/admin' : '/employee';
      navigate(home, { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : '회원가입에 실패했습니다.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="card auth-card">
        <h2>회원가입</h2>
        <p className="auth-description">Slack 멤버 ID와 회사코드는 필수입니다.</p>
        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: '0.75rem' }}>
            <label htmlFor="name">이름</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div style={{ marginBottom: '0.75rem' }}>
            <label htmlFor="email">이메일</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div style={{ marginBottom: '0.75rem' }}>
            <label htmlFor="password">비밀번호</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </div>
          <div style={{ marginBottom: '0.75rem' }}>
            <label htmlFor="slackMemberId">Slack 멤버 ID</label>
            <input id="slackMemberId" value={slackMemberId} onChange={(e) => setSlackMemberId(e.target.value)} required placeholder="U123ABC45" />
          </div>
          <div style={{ marginBottom: '0.75rem' }}>
            <label htmlFor="companyCode">회사코드</label>
            <input id="companyCode" value={companyCode} onChange={(e) => setCompanyCode(e.target.value)} required />
          </div>
          <div style={{ marginBottom: '0.75rem' }}>
            <label htmlFor="role">역할</label>
            <select id="role" value={role} onChange={(e) => setRole(e.target.value as 'employee' | 'admin')}>
              <option value="employee">신입 사원</option>
              <option value="admin">관리자</option>
            </select>
          </div>

          {error && <div className="field-error">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? '가입 중…' : '회원가입'}
          </button>
        </form>
        <p className="auth-link">
          이미 계정이 있나요? <Link to="/login">로그인</Link>
        </p>
      </section>
    </main>
  );
}
