import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

function homeForRole(role: string | undefined): '/admin' | '/employee' {
  return role === 'admin' ? '/admin' : '/employee';
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((s) => s.login);

  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fromState = (location.state as { from?: string } | undefined)?.from;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login({
        loginId: loginId.trim(),
        password,
      });
      const u = useAuthStore.getState().user;
      const home = homeForRole(u?.role);
      let target = fromState ?? home;
      if (u?.role === 'employee' && target.startsWith('/admin')) target = home;
      if (u?.role === 'admin' && target.startsWith('/employee')) target = home;
      navigate(target, { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : '로그인에 실패했습니다.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="card auth-card">
        <h2>로그인</h2>
        <p className="auth-description">가입 시 등록한 아이디(이메일)와 비밀번호만 입력하세요.</p>
        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: '0.75rem' }}>
            <label htmlFor="loginId">아이디</label>
            <input
              id="loginId"
              type="email"
              autoComplete="username"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              required
              placeholder="가입 시 사용한 이메일"
            />
          </div>
          <div style={{ marginBottom: '0.75rem' }}>
            <label htmlFor="password">비밀번호</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          {error && <div className="field-error">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? '로그인 중…' : '로그인'}
          </button>
        </form>
        <p className="auth-link">
          계정이 없나요? <Link to="/signup">회원가입</Link>
        </p>
      </section>
    </main>
  );
}
