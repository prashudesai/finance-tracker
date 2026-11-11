import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { netWorth, netWorthHistory } from '../../domain/analytics';
import type { TrackerData } from '../../data/repository';
import { formatAmount, formatMoney, formatMonth, formatPercent } from '../../ui/format';
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

/** The chart's height. On a phone it shrinks, never grows, to fit Home's first screen. */
const TALL = 74;
const SHORT = 78;
const FIT_MIN = 36;
const FIT_MAX = 78;
/** The gap left between today's picks and the tab bar on a phone's first screen. */
const FIT_GAP = 14;
const PAD = 5;

/**
 * On a phone, the chart height that makes Home's first screen end just after today's picks,
 * above the tab bar, whatever the phone's height and whatever shows above. Null where it
 * doesn't apply: wide screens, no picks, or picks arranged above net worth.
 */
function fittedHeight(chart: Element) {
  if (window.matchMedia?.('(max-width: 600px)')?.matches !== true) return null;
  const picks = document.querySelector('[aria-labelledby="for-you"] ul');
  const nav = document.querySelector('nav[aria-label="Main"]');
  if (!picks || !nav) return null;
  const chartBox = chart.getBoundingClientRect();
  const current = chart.querySelector('svg')?.getBoundingClientRect().height;
  if (!current) return null;
  const picksBox = picks.getBoundingClientRect();
  if (picksBox.top < chartBox.bottom) return null;
  // In page terms, so it's the same whether or not the page is scrolled.
  const picksBottom = picksBox.bottom + window.scrollY;
  const navTop = nav.getBoundingClientRect().top;
  const next = current + (navTop - FIT_GAP - picksBottom);
  return Math.round(Math.min(FIT_MAX, Math.max(FIT_MIN, next)));
}

/**
 * The dashboard's lead: net worth, how it moved over a chosen range, with a smooth line, and
 * what it's made of. The range is remembered on this device.
 */
export function NetWorthHero({ data, today }: { data: TrackerData; today: string }) {
  // Kept between frames: the figure below counts up, redrawing this card many times a second.
  const worth = useMemo(() => netWorth(data, today), [data, today]);
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
  // The month under a finger or pointer, read out in place of today's figure.
  const [picked, setPicked] = useState<number | null>(null);
  const dragged = useRef(false);
  // On a phone, the chart's height fitted so the first screen ends with today's picks.
  const [fitted, setFitted] = useState<number | null>(null);

  useEffect(() => {
    const fit = () => {
      const chart = box.current;
      if (chart) setFitted(fittedHeight(chart));
    };
    fit();
    window.addEventListener('resize', fit);
    void document.fonts?.ready.then(fit);
    // Sections load and change height after the first paint, so it's fitted again then.
    const main = document.querySelector('main');
    const observer = main ? new ResizeObserver(fit) : null;
    if (main) observer?.observe(main);
    // And once more after the figures have counted up and the picks have settled.
    const later = [300, 1000].map((delay) => window.setTimeout(fit, delay));
    return () => {
      later.forEach((timer) => window.clearTimeout(timer));
      observer?.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, [data]);

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
  const HEIGHT = fitted ?? (width < 520 ? SHORT : TALL);
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
  const point = picked === null ? null : history[picked];
  const pick = (clientX: number, element: Element) => {
    const rect = element.getBoundingClientRect();
    const ratio = (clientX - rect.left - PAD) / Math.max(1, rect.width - PAD * 2);
    setPicked(Math.min(values.length - 1, Math.max(0, Math.round(ratio * (values.length - 1)))));
  };

  return (
    <section aria-label="Net worth" className={`${ui.hero} ${styles.hero}`}>
      {/* The label with the range beside it, so the card stays short on a phone. */}
      <div className={styles.top}>
        <span className={styles.label}>Net worth</span>
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
      </div>
      <div aria-live="polite" className={styles.value}>
        {point ? formatMoney(point.netWorth) : formatMoney(Math.round(shown))}
      </div>
      {point ? (
        <div className={styles.change}>
          <span className={styles.since}>
            End of {formatMonth(point.month)}
            {point.estimated ? ' · estimate' : ''}
          </span>
        </div>
      ) : values.length >= 2 ? (
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
      {point ? null : (
        <div className={styles.split}>
          <Link to="/investments">
            You own <strong>{formatAmount(worth.assets)}</strong>
          </Link>
          <Link to="/debts">
            You owe <strong>{formatAmount(worth.debts)}</strong>
          </Link>
        </div>
      )}
      <div className={styles.chart} ref={box}>
        {values.length >= 2 ? (
          <Link
            aria-label="Open net worth history"
            onClick={(event) => {
              // A drag along the line reads it; only a tap opens the history.
              if (dragged.current) event.preventDefault();
              dragged.current = false;
            }}
            to="/analytics"
          >
            <svg
              aria-hidden="true"
              className={styles.scrub}
              height={HEIGHT}
              onPointerDown={(event) => {
                dragged.current = false;
                if (event.pointerType !== 'mouse') pick(event.clientX, event.currentTarget);
              }}
              onPointerLeave={() => setPicked(null)}
              onPointerMove={(event) => {
                if (event.pointerType !== 'mouse' && event.buttons === 0) return;
                if (event.pointerType !== 'mouse') dragged.current = true;
                pick(event.clientX, event.currentTarget);
              }}
              onPointerUp={(event) => {
                if (event.pointerType !== 'mouse') setPicked(null);
              }}
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
              {picked !== null ? (
                <line
                  className={styles.cursor}
                  x1={x(picked)}
                  x2={x(picked)}
                  y1={PAD}
                  y2={HEIGHT}
                />
              ) : null}
              <circle
                className={styles.dot}
                cx={picked === null ? lastX : x(picked)}
                cy={picked === null ? lastY : y(values[picked] ?? 0)}
                r="4.5"
              />
            </svg>
          </Link>
        ) : null}
      </div>
    </section>
  );
}
