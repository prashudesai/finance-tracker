import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { netWorth, netWorthHistory } from '../../domain/analytics';
import type { TrackerData } from '../../data/repository';
import { formatMoney, formatMonth, formatPercent } from '../../ui/format';
import { useCountUp } from '../../ui/useCountUp';
import ui from '../../ui/ui.module.css';
import styles from './NetWorthHero.module.css';

const RANGES = [
  { key: '1M', label: '1M', months: 2, words: 'in 1 month' },
  { key: '6M', label: '6M', months: 7, words: 'in 6 months' },
  { key: '1Y', label: '1Y', months: 13, words: 'in a year' },
  { key: 'All', label: 'All', months: 600, words: '' },
] as const;
type RangeKey = (typeof RANGES)[number]['key'];
const RANGE_KEY = 'netWorthRange';

function savedRange(): RangeKey {
  try {
    const saved = localStorage.getItem(RANGE_KEY);
    return RANGES.some((range) => range.key === saved) ? (saved as RangeKey) : '6M';
  } catch {
    return '6M';
  }
}

const HEIGHT = 74;
const PAD = 5;

/**
 * The dashboard's lead: net worth, how it moved over a chosen range, with a smooth line, and
 * what it's made of. The range is remembered on this device.
 */
export function NetWorthHero({ data, today }: { data: TrackerData; today: string }) {
  const worth = netWorth(data, today);
  const shown = useCountUp(worth.netWorth);
  const [range, setRange] = useState<RangeKey>(savedRange);
  const months = RANGES.find((row) => row.key === range)?.months ?? 7;
  const history = useMemo(() => netWorthHistory(data, today, months), [data, today, months]);
  const values = history.map((row) => row.netWorth);
  const first = values[0] ?? worth.netWorth;
  const change = worth.netWorth - first;
  const base = Math.abs(first);
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const fade = useId();

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const measure = () => setWidth(Math.max(200, Math.round(element.clientWidth)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const choose = (key: RangeKey) => {
    setRange(key);
    try {
      localStorage.setItem(RANGE_KEY, key);
    } catch {
      // Remembered for this visit only.
    }
  };

  const low = Math.min(...values);
  const span = Math.max(...values) - low || 1;
  const x = (index: number) => PAD + (index / Math.max(1, values.length - 1)) * (width - PAD * 2);
  const y = (value: number) => HEIGHT - PAD - ((value - low) / span) * (HEIGHT - PAD * 2);
  // A smooth curve through each month, so the line reads as a trend rather than steps.
  const line = values
    .map((value, index) => {
      if (index === 0) return `M${x(0)},${y(value)}`;
      const px = x(index - 1);
      const py = y(values[index - 1] ?? value);
      const mid = (px + x(index)) / 2;
      return `C${mid},${py} ${mid},${y(value)} ${x(index)},${y(value)}`;
    })
    .join(' ');
  const lastX = x(values.length - 1);
  const lastY = y(values.at(-1) ?? 0);
  const up = change >= 0;
  const since = history[0]?.month;

  return (
    <section aria-label="Net worth" className={`${ui.hero} ${styles.hero}`}>
      <span className={styles.label}>Net worth</span>
      <div className={styles.value}>{formatMoney(Math.round(shown))}</div>
      {values.length >= 2 ? (
        <div className={styles.change} data-down={up ? undefined : true}>
          <span aria-hidden="true">{up ? '▲' : '▼'}</span>
          <span className={ui.visuallyHidden}>{up ? 'Up' : 'Down'}</span>{' '}
          {formatMoney(Math.abs(change))}
          {base > 0 ? ` · ${formatPercent(Math.abs(change) / base)}` : ''}
          <span className={styles.since}>
            {RANGES.find((row) => row.key === range)?.words ||
              (since ? `since ${formatMonth(since)}` : '')}
          </span>
        </div>
      ) : null}
      <div className={styles.chart} ref={box}>
        {values.length >= 2 ? (
          <Link aria-label="Open net worth history" to="/analytics">
            <svg
              aria-hidden="true"
              height={HEIGHT}
              viewBox={`0 0 ${width} ${HEIGHT}`}
              width={width}
            >
              <defs>
                <linearGradient id={fade} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" style={{ stopColor: 'var(--accent)', stopOpacity: 0.38 }} />
                  <stop offset="1" style={{ stopColor: 'var(--accent)', stopOpacity: 0 }} />
                </linearGradient>
              </defs>
              <path
                d={`${line} L${lastX},${HEIGHT} L${x(0)},${HEIGHT} Z`}
                style={{ fill: `url(#${fade})` }}
              />
              <path className={styles.line} d={line} />
              <circle className={styles.dot} cx={lastX} cy={lastY} r="4.5" />
            </svg>
          </Link>
        ) : null}
      </div>
      <div aria-label="Net worth range" className={styles.ranges} role="group">
        {RANGES.map((row) => (
          <button
            aria-pressed={range === row.key}
            className={styles.range}
            key={row.key}
            onClick={() => choose(row.key)}
            type="button"
          >
            {row.label}
          </button>
        ))}
      </div>
    </section>
  );
}
