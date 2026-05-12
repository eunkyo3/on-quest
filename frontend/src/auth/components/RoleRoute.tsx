import type { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

type AppRole = 'admin' | 'employee';

function homeForRole(role: string | undefined): string {
  return role === 'admin' ? '/admin' : '/employee';
}

export function RoleRoute({
  allowedRole,
  children,
}: {
  allowedRole: AppRole;
  children: ReactElement;
}) {
  const { accessToken, user, isHydrated } = useAuthStore();
  const location = useLocation();

  if (!isHydrated) {
    return <div className="empty">세션을 확인하는 중…</div>;
  }

  if (!accessToken) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (user?.role !== allowedRole) {
    return <Navigate to={homeForRole(user?.role)} replace />;
  }

  return children;
}
