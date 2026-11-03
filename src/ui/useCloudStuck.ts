import { useEffect, useState } from 'react';

/** How long saving or loading may wait, while online, before the app explains why. */
export const SAVE_WAIT_MS = 60_000;
export const LOAD_WAIT_MS = 20_000;

export const CLOUD_STUCK_SAVING =
  "Your changes are saved on this device but haven't reached the cloud yet. If you're online, the app has probably reached today's free usage limit. They'll sync by themselves once it's back, usually within a day.";
export const CLOUD_STUCK_LOADING =
  "Your records are taking a long time to load. If you're online, the app has probably reached today's free usage limit. Your records are safe, and it'll work again within a day.";

/**
 * True once `waiting` has held for `ms` while the device is online. Firestore retries quietly
 * when the free plan's daily limit is reached, so a long wait is the only sign of it.
 */
export function useCloudStuck(waiting: boolean, ms: number) {
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setTimeout(() => setStuck(navigator.onLine), ms);
    return () => {
      window.clearTimeout(timer);
      setStuck(false);
    };
  }, [waiting, ms]);
  return stuck;
}
