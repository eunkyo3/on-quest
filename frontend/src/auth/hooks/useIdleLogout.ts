import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

const DEFAULT_IDLE_TIMEOUT_MS = Number(import.meta.env.VITE_IDLE_TIMEOUT_MS ?? '1800000');

export function useIdleLogout(): void {
  const { accessToken, lastActivityAt, touchActivity, logout } = useAuthStore();

  useEffect(() => {
    if (!accessToken) return;

    const onActivity = () => touchActivity();
    const events: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ];

    events.forEach((eventName) => window.addEventListener(eventName, onActivity));

    const timer = window.setInterval(() => {
      if (Date.now() - lastActivityAt > DEFAULT_IDLE_TIMEOUT_MS) {
        logout();
      }
    }, 10_000);

    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, onActivity));
      window.clearInterval(timer);
    };
  }, [accessToken, lastActivityAt, logout, touchActivity]);
}
