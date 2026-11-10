import { useEffect, useRef, useState } from 'react';

const FIRST_MS = 600;
const CHANGE_MS = 450;

const motionAllowed = () =>
  window.matchMedia?.('(prefers-reduced-motion: no-preference)')?.matches === true;

/**
 * A headline figure that counts up from zero when first shown, then rolls from its old value
 * to the new one whenever it changes, such as after a save. Shows the figure straight away
 * when motion is reduced.
 */
export function useCountUp(target: number) {
  const shown = useRef(motionAllowed() ? 0 : target);
  const first = useRef(true);
  const [value, setValue] = useState(shown.current);

  useEffect(() => {
    const from = shown.current;
    const duration = first.current ? FIRST_MS : CHANGE_MS;
    first.current = false;
    if (!motionAllowed() || from === target) {
      shown.current = target;
      setValue(target);
      return;
    }
    const started = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const progress = Math.min(1, (now - started) / duration);
      const next = from + (target - from) * (1 - (1 - progress) ** 3);
      shown.current = next;
      setValue(next);
      if (progress < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return value;
}
