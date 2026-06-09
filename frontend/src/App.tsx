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
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import QuestDetailPage from './pages/QuestDetailPage';
import SettingsPage from './auth/pages/SettingsPage';
import { ROLES, ROLE_LABEL, homePathForRole } from './types/role';

export default function App() {
  const { user, accessToken, hydrate, isHydrated, logout } = useAuthStore();
  useIdleLogout();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!isHydrated) {
    return <div className="empty">세션을 확인하는 중…</div>;
  }

  const roleLabel = user ? ROLE_LABEL[user.role] ?? '사용자' : '';
  const navLinkClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : '');

  return (
    <>
      <ToastContainer />
      <header className="app-header">
        <h1>On-Quest</h1>
        {accessToken && user ? (
          <nav>
            {user.role === ROLES.SUPERADMIN && (
              <>
                <NavLink to="/superadmin" className={navLinkClass}>
                  사용자 관리
                </NavLink>
                <NavLink to="/admin" className={navLinkClass}>
                  퀘스트 관리
                </NavLink>
              </>
            )}
            {user.role === ROLES.ADMIN && (
              <NavLink to="/admin" className={navLinkClass}>
                퀘스트 관리
              </NavLink>
            )}
            {user.role === ROLES.EMPLOYEE && (
              <NavLink to="/employee" className={navLinkClass}>
                내 퀘스트
              </NavLink>
            )}
            <NavLink to="/settings" className={navLinkClass}>
              설정
            </NavLink>
            <span className="user-chip">
              {user.name} · {roleLabel}
            </span>
            <button type="button" className="ghost" onClick={logout}>
              로그아웃
            </button>
          </nav>
        ) : (
          <nav>
            <NavLink to="/login" className={navLinkClass}>
              로그인
            </NavLink>
            <NavLink to="/signup" className={navLinkClass}>
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
                to={accessToken ? homePathForRole(user?.role) : '/login'}
                replace
              />
            )}
          />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/employee"
            element={(
              <RoleRoute allowedRoles={['employee']}>
                <EmployeeDashboard />
              </RoleRoute>
            )}
          />
          <Route
            path="/employee/quests/:id"
            element={(
              <RoleRoute allowedRoles={['employee']}>
                <QuestDetailPage mode="employee" listPath="/employee" />
              </RoleRoute>
            )}
          />
          <Route
            path="/admin"
            element={(
              <RoleRoute allowedRoles={['admin', 'superadmin']}>
                <AdminDashboard />
              </RoleRoute>
            )}
          />
          <Route
            path="/admin/quests/:id"
            element={(
              <RoleRoute allowedRoles={['admin', 'superadmin']}>
                <QuestDetailPage mode="admin" listPath="/admin" />
              </RoleRoute>
            )}
          />
          <Route
            path="/superadmin"
            element={(
              <RoleRoute allowedRoles={['superadmin']}>
                <SuperAdminDashboard />
              </RoleRoute>
            )}
          />
          <Route
            path="/settings"
            element={(
              accessToken ? (
                <SettingsPage />
              ) : (
                <Navigate to="/login" replace />
              )
            )}
          />
          <Route
            path="*"
            element={(
              <Navigate
                to={accessToken ? homePathForRole(user?.role) : '/login'}
                replace
              />
            )}
          />
        </Routes>
      </main>
    </>
  );
}
