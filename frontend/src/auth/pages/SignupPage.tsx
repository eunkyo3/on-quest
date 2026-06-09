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
      });
      // 가입 후 역할은 서버가 결정(첫 가입자=슈퍼관리자, 이후=신입사원).
      // 루트로 보내면 App이 역할에 맞는 홈으로 이동시킨다.
      navigate('/', { replace: true });
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
        <p className="auth-description">
          Slack 멤버 ID와 회사코드는 필수입니다. 회사코드의 최초 가입자는 슈퍼관리자가
          되어 구성원의 역할을 관리하고, 이후 가입자는 신입사원으로 등록됩니다.
        </p>
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
