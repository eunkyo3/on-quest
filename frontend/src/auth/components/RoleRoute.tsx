import type { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { homePathForRole } from '../../types/role';

/** @deprecated types/role 의 homePathForRole 사용 권장 (호환용 재노출) */
export const homeForRole = homePathForRole;

export function RoleRoute({
  allowedRoles,
  children,
}: {
  allowedRoles: string[];
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

  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to={homePathForRole(user?.role)} replace />;
  }

  return children;
}
