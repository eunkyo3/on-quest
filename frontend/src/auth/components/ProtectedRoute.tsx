import type { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export function ProtectedRoute({ children }: { children: ReactElement }) {
  const { accessToken, isHydrated } = useAuthStore();
  const location = useLocation();

  if (!isHydrated) {
    return <div className="empty">세션을 확인하는 중…</div>;
  }

  if (!accessToken) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
