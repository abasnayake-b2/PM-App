import { useEffect, useRef } from 'react';

/** Sign out after this much user inactivity (mouse, keyboard, touch, scroll). */
export const IDLE_TIMEOUT_MS = 10 * 60 * 1000;

export const IDLE_TIMEOUT_MINUTES = IDLE_TIMEOUT_MS / 60_000;

const ACTIVITY_EVENTS = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'click',
  'wheel',
] as const;

/**
 * Calls {@code onIdle} once after {@link IDLE_TIMEOUT_MS} with no user input.
 * Background API polls do not count as activity.
 */
export function useIdleLogout(onIdle: () => void) {
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    let timer: number | undefined;
    let lastReset = 0;
    let fired = false;

    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (fired) return;
        fired = true;
        onIdleRef.current();
      }, IDLE_TIMEOUT_MS);
    };

    const onActivity = () => {
      if (fired) return;
      const now = Date.now();
      if (now - lastReset < 1000) return;
      lastReset = now;
      schedule();
    };

    schedule();
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true });
    }

    return () => {
      window.clearTimeout(timer);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity);
      }
    };
  }, []);
}
