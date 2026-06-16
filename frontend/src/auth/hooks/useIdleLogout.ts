import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

const RAW_TIMEOUT = Number(import.meta.env.VITE_IDLE_TIMEOUT_MS ?? '1800000');
// 잘못된 환경값(NaN·0·음수)이면 자동 로그아웃이 조용히 비활성화되지 않도록 기본 30분으로 보정
const IDLE_TIMEOUT_MS =
  Number.isFinite(RAW_TIMEOUT) && RAW_TIMEOUT > 0 ? RAW_TIMEOUT : 1_800_000;

export function useIdleLogout(): void {
  // accessToken/logout 만 구독 — lastActivityAt 변화로 effect 가 재실행되지 않게 한다.
  const accessToken = useAuthStore((s) => s.accessToken);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    if (!accessToken) return;

    const { touchActivity } = useAuthStore.getState();
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

    // 활동 시각은 매 tick 마다 store 에서 최신값을 읽는다 → interval 을 재생성하지 않는다.
    const timer = window.setInterval(() => {
      const { lastActivityAt } = useAuthStore.getState();
      if (Date.now() - lastActivityAt > IDLE_TIMEOUT_MS) {
        logout();
      }
    }, 10_000);

    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, onActivity));
      window.clearInterval(timer);
    };
  }, [accessToken, logout]);
}
