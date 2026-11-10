import { useCountUp } from './useCountUp';

/** A headline figure that counts up when shown and rolls to its new value after a change. */
export function CountUp({ value, format }: { value: number; format: (value: number) => string }) {
  const shown = useCountUp(value);
  return <>{format(Math.round(shown))}</>;
}
