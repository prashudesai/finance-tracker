import { RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import styles from '../Shell.module.css';

/** Finger travel is damped, so the indicator lags behind the pull. */
const RESISTANCE = 0.5;
/** How far the indicator must travel before letting go refreshes. */
export const PULL_THRESHOLD = 70;
const MAX_PULL = 110;

export const pullDistance = (fingerTravel: number) =>
  Math.min(MAX_PULL, Math.max(0, fingerTravel * RESISTANCE));

/** Pull down from the top of a page to refresh. Letting go early does nothing. */
export function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const start = useRef<number | null>(null);
  const distance = useRef(0);

  useEffect(() => {
    const update = (value: number) => {
      distance.current = value;
      setPull(value);
    };
    const onStart = (event: TouchEvent) => {
      const blocked = window.scrollY > 0 || document.querySelector('dialog[open]');
      start.current = blocked ? null : (event.touches[0]?.clientY ?? null);
    };
    const onMove = (event: TouchEvent) => {
      if (start.current === null) return;
      update(pullDistance((event.touches[0]?.clientY ?? 0) - start.current));
    };
    const onEnd = () => {
      if (start.current === null) return;
      start.current = null;
      if (distance.current >= PULL_THRESHOLD) {
        setRefreshing(true);
        window.location.reload();
        return;
      }
      update(0);
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  if (pull === 0 && !refreshing) return null;
  const ready = pull >= PULL_THRESHOLD;
  return (
    <div
      aria-live="polite"
      className={styles.pull}
      role="status"
      style={{ transform: `translate(-50%, ${pull}px)`, opacity: Math.min(1, pull / 40) }}
    >
      <RefreshCw
        aria-hidden="true"
        className={refreshing ? styles.spin : undefined}
        size={16}
        style={{ transform: `rotate(${pull * 3}deg)` }}
      />
      {refreshing ? 'Refreshing…' : ready ? 'Release to refresh' : 'Pull to refresh'}
    </div>
  );
}
