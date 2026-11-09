import { useId } from 'react';
import ui from './ui.module.css';

const PAD = 3;

/**
 * A small line with no axis. Its direction shows the trend. Without a colour it's mint going up
 * and amber going down; with one, an `area` adds a soft fade beneath it.
 */
export function TrendLine({
  values,
  color,
  area = false,
  width = 64,
  height = 30,
}: {
  values: number[];
  color?: string;
  area?: boolean;
  width?: number;
  height?: number;
}) {
  const fade = useId();
  const low = Math.min(...values);
  const span = Math.max(...values) - low || 1;
  const x = (index: number) => PAD + (index / (values.length - 1)) * (width - PAD * 2);
  const y = (value: number) => height - PAD - ((value - low) / span) * (height - PAD * 2);
  const last = values.at(-1) ?? 0;
  const stroke = color ?? (last < (values[0] ?? 0) ? 'var(--debt)' : 'var(--accent)');
  const points = values.map((value, index) => `${x(index)},${y(value)}`);
  return (
    <svg
      aria-hidden="true"
      className={ui.trendLine}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
    >
      {area ? (
        <>
          <defs>
            <linearGradient id={fade} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={stroke} stopOpacity="0.32" />
              <stop offset="1" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={`M${x(0)},${height} L${points.join(' L')} L${x(values.length - 1)},${height} Z`}
            fill={`url(#${fade})`}
          />
        </>
      ) : null}
      <polyline
        fill="none"
        points={points.join(' ')}
        stroke={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <circle
        cx={x(values.length - 1)}
        cy={y(last)}
        fill={stroke}
        r={area ? 3.5 : 2.5}
        stroke={area ? 'var(--surface)' : 'none'}
        strokeWidth={area ? 2 : 0}
      />
    </svg>
  );
}
