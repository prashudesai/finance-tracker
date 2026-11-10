import { useEffect, useId, useRef, useState, type PointerEvent } from 'react';
import type { ValuePoint } from '../../domain/holdings';
import { formatCompactMoney, formatMoney, formatShortMonthYear } from '../../ui/format';
import styles from './CategoryDetail.module.css';

const HEIGHT = 180;
const TOP = 12;
const BOTTOM = 22;
const LEFT = 4;
const RIGHT = 4;

/**
 * Value as a filled line and the invested amount as a dashed one, on one scale, so the gap
 * between them is the gain. Hovering or dragging shows that month's figures.
 */
export function ValueChart({ points }: { points: ValuePoint[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(340);
  const [picked, setPicked] = useState<number | null>(null);
  const fade = useId();

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const measure = () => setWidth(Math.max(240, Math.round(element.clientWidth)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const values = points.flatMap((point) => [point.value, point.invested]);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const floor = Math.max(0, low - (high - low) * 0.15);
  const span = high - floor || 1;
  const last = Math.max(1, points.length - 1);
  const x = (index: number) => LEFT + (index / last) * (width - LEFT - RIGHT);
  const y = (value: number) => TOP + (1 - (value - floor) / span) * (HEIGHT - TOP - BOTTOM);
  const path = (key: 'value' | 'invested') =>
    points
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index)},${y(point[key])}`)
      .join(' ');
  const line = path('value');
  const shown = picked ?? points.length - 1;
  const point = points[shown];
  const stride = Math.max(1, Math.ceil(points.length / (width < 500 ? 4 : 7)));

  const pick = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left - LEFT) / Math.max(1, rect.width - LEFT - RIGHT);
    setPicked(Math.min(points.length - 1, Math.max(0, Math.round(ratio * last))));
  };

  if (points.length < 2) {
    return <p className={styles.chartEmpty}>The chart starts once there is a second month.</p>;
  }

  return (
    <div className={styles.chartBox} ref={box}>
      {point ? (
        <div aria-live="polite" className={styles.readout}>
          <span>{formatShortMonthYear(point.month)}</span>
          <span>
            <i className={styles.keyValue} /> Value <strong>{formatMoney(point.value)}</strong>
          </span>
          <span>
            <i className={styles.keyInvested} /> Invested{' '}
            <strong>{formatMoney(point.invested)}</strong>
          </span>
        </div>
      ) : null}
      <svg
        aria-label={`Value from ${formatShortMonthYear(points[0]?.month ?? '')} to ${formatShortMonthYear(points.at(-1)?.month ?? '')}: ${formatMoney(points.at(-1)?.value ?? 0)}`}
        className={styles.chart}
        height={HEIGHT}
        onPointerDown={pick}
        onPointerLeave={() => setPicked(null)}
        onPointerMove={pick}
        role="img"
        viewBox={`0 0 ${width} ${HEIGHT}`}
        width={width}
      >
        <defs>
          <linearGradient id={fade} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--accent)', stopOpacity: 0.32 }} />
            <stop offset="1" style={{ stopColor: 'var(--accent)', stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        {[high, (high + floor) / 2].map((tick) => (
          <g key={tick}>
            <line className={styles.grid} x1={LEFT} x2={width - RIGHT} y1={y(tick)} y2={y(tick)} />
            <text className={styles.tick} x={LEFT + 2} y={y(tick) - 4}>
              {formatCompactMoney(tick)}
            </text>
          </g>
        ))}
        <path
          d={`${line} L${x(last)},${HEIGHT - BOTTOM} L${x(0)},${HEIGHT - BOTTOM} Z`}
          style={{ fill: `url(#${fade})` }}
        />
        <path className={styles.invested} d={path('invested')} />
        <path className={styles.value} d={line} />
        {points.map((row, index) =>
          (index % stride === 0 && last - index >= stride / 2) || index === last ? (
            <text
              className={styles.tick}
              key={row.month}
              textAnchor={index === 0 ? 'start' : index === last ? 'end' : 'middle'}
              x={x(index)}
              y={HEIGHT - 6}
            >
              {formatShortMonthYear(row.month)}
            </text>
          ) : null,
        )}
        {point ? (
          <g>
            <line
              className={styles.cursor}
              x1={x(shown)}
              x2={x(shown)}
              y1={TOP}
              y2={HEIGHT - BOTTOM}
            />
            <circle className={styles.dot} cx={x(shown)} cy={y(point.value)} r="5" />
          </g>
        ) : null}
      </svg>
    </div>
  );
}
