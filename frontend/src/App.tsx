import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useEffect } from 'react';
import { RoleRoute } from './auth/components/RoleRoute';
import { useIdleLogout } from './auth/hooks/useIdleLogout';
import LoginPage from './auth/pages/LoginPage';
import SignupPage from './auth/pages/SignupPage';
import { useAuthStore } from './auth/store/authStore';
import { ToastContainer } from './components/ToastContainer';
import AdminDashboard from './pages/AdminDashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';
import QuestDetailPage from './pages/QuestDetailPage';

function homePathForUser(role: string | undefined): string {
  return role === 'admin' ? '/admin' : '/employee';
}

export default function App() {
  const { user, accessToken, hydrate, isHydrated, logout } = useAuthStore();
  useIdleLogout();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!isHydrated) {
    return <div className="empty">세션을 확인하는 중…</div>;
  }

  const roleLabel = user?.role === 'admin' ? '관리자' : '사원';
  const dashboardPath = user ? homePathForUser(user.role) : '/employee';

  return (
    <>
      <ToastContainer />
      <header className="app-header">
        <h1>🎮 On-Quest</h1>
        {accessToken && user ? (
          <nav>
            <NavLink to={dashboardPath} className={({ isActive }) => (isActive ? 'active' : '')} end>
              대시보드
            </NavLink>
            <span className="user-chip">{user.name} ({roleLabel})</span>
            <button type="button" className="ghost" onClick={logout}>
              로그아웃
            </button>
          </nav>
        ) : (
          <nav>
            <NavLink to="/login" className={({ isActive }) => (isActive ? 'active' : '')}>
              로그인
            </NavLink>
            <NavLink to="/signup" className={({ isActive }) => (isActive ? 'active' : '')}>
              회원가입
            </NavLink>
          </nav>
        )}
      </header>
      <main className="app-shell">
        <Routes>
          <Route
            path="/"
            element={(
              <Navigate
                to={accessToken ? homePathForUser(user?.role) : '/login'}
                replace
              />
            )}
          />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/employee"
            element={(
              <RoleRoute allowedRole="employee">
                <EmployeeDashboard />
              </RoleRoute>
            )}
          />
          <Route
            path="/employee/quests/:id"
            element={(
              <RoleRoute allowedRole="employee">
                <QuestDetailPage mode="employee" listPath="/employee" />
              </RoleRoute>
            )}
          />
          <Route
            path="/admin"
            element={(
              <RoleRoute allowedRole="admin">
                <AdminDashboard />
              </RoleRoute>
            )}
          />
          <Route
            path="/admin/quests/:id"
            element={(
              <RoleRoute allowedRole="admin">
                <QuestDetailPage mode="admin" listPath="/admin" />
              </RoleRoute>
            )}
          />
          <Route
            path="*"
            element={(
              <Navigate
                to={accessToken ? homePathForUser(user?.role) : '/login'}
                replace
              />
            )}
          />
        </Routes>
      </main>
    </>
  );
}
