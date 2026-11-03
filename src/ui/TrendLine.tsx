import ui from './ui.module.css';

const WIDTH = 64;
const HEIGHT = 30;
const PAD = 3;

/** A small line with no axis. Its direction shows the trend, with colour as a second cue. */
export function TrendLine({ values }: { values: number[] }) {
  const low = Math.min(...values);
  const span = Math.max(...values) - low || 1;
  const x = (index: number) => PAD + (index / (values.length - 1)) * (WIDTH - PAD * 2);
  const y = (value: number) => HEIGHT - PAD - ((value - low) / span) * (HEIGHT - PAD * 2);
  const last = values.at(-1) ?? 0;
  const color = last < (values[0] ?? 0) ? 'var(--debt)' : 'var(--accent)';
  return (
    <svg
      aria-hidden="true"
      className={ui.trendLine}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH}
    >
      <polyline
        fill="none"
        points={values.map((value, index) => `${x(index)},${y(value)}`).join(' ')}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <circle cx={x(values.length - 1)} cy={y(last)} fill={color} r="2.5" />
    </svg>
  );
}
