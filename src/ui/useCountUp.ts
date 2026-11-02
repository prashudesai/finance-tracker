import { useEffect, useRef, useState } from 'react';

const DURATION_MS = 500;

const motionAllowed = () =>
  window.matchMedia?.('(prefers-reduced-motion: no-preference)')?.matches === true;

/** Counts up to `target` when first shown. Later changes apply straight away. */
export function useCountUp(target: number) {
  const played = useRef(false);
  const [value, setValue] = useState(() => (motionAllowed() ? 0 : target));

  useEffect(() => {
    if (played.current || !motionAllowed()) {
      setValue(target);
      return;
    }
    const started = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const progress = Math.min(1, (now - started) / DURATION_MS);
      setValue(target * (1 - (1 - progress) ** 3));
      if (progress < 1) frame = requestAnimationFrame(step);
      else played.current = true;
    });
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return value;
}
