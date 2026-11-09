import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { FlowNode, MoneyFlow } from '../../domain/moneyFlow';
import { formatMoney, formatMonth } from '../../ui/format';
import ui from '../../ui/ui.module.css';
import styles from './MoneyFlowChart.module.css';

const COLORS = {
  spent: 'var(--series-expense)',
  unrecorded: 'var(--debt)',
  emis: 'var(--loss)',
  invested: 'var(--scenario-base)',
  left: 'var(--accent)',
  income: 'var(--series-income)',
  bank: 'var(--muted)',
} as const;

const OUTCOME_COLORS: Partial<Record<string, string>> = COLORS;

const colorOf = (node: FlowNode) =>
  node.key === 'in-bank'
    ? COLORS.bank
    : node.key.startsWith('in-')
      ? COLORS.income
      : node.key.startsWith('cat-')
        ? COLORS.spent
        : (OUTCOME_COLORS[node.key] ?? COLORS.left);

const NODE = 10;
const GAP = 8;
/** Room a two-line label needs, so short bands don't stack their labels on each other. */
const LABEL = 30;
const WIDE = 620;

interface Placed extends FlowNode {
  y: number;
  h: number;
  /** Where its label sits, pushed down when bands above are too thin to hold theirs. */
  labelY: number;
}

/** Stacks nodes down a column of `height`, each in proportion, with gaps between. */
function stack(nodes: FlowNode[], total: number, height: number, top = 0): Placed[] {
  const space = Math.max(0, height - GAP * (nodes.length - 1));
  let y = top;
  let lastLabel = -Infinity;
  return nodes.map((node) => {
    const h = Math.max(2, (node.amount / total) * space);
    const labelY = Math.max(y + h / 2, lastLabel + LABEL);
    lastLabel = labelY;
    const placed = { ...node, y, h, labelY };
    y += h + GAP;
    return placed;
  });
}

/** A band from one node's slice to another's, curving between them. */
function band(xa: number, ya: number, ha: number, xb: number, yb: number, hb: number) {
  const mid = (xa + xb) / 2;
  return `M${xa},${ya} C${mid},${ya} ${mid},${yb} ${xb},${yb} L${xb},${yb + hb} C${mid},${yb + hb} ${mid},${ya + ha} ${xa},${ya + ha} Z`;
}

/** Shortens a label to fit `room` pixels, at about 6.6px a character. */
const fit = (text: string, room: number) => {
  const most = Math.max(4, Math.floor(room / 6.6));
  return text.length > most ? `${text.slice(0, most - 1).trimEnd()}…` : text;
};

const share = (amount: number, total: number) =>
  total > 0 ? `${Math.round((amount / total) * 100)}%` : '';

/**
 * Where a month's money went, as a flow: income sources merge into one total, which splits into
 * spending, unrecorded spending, loan EMIs, investing and what's left. Wide screens also split
 * spending into its categories; on a phone, tapping Spending lists them.
 */
/** The month summary's own words, for the table screen readers get. */
const TABLE_LABELS: Partial<Record<string, string>> = {
  spent: 'Spent',
  unrecorded: 'Unrecorded spending',
  emis: 'Loan EMIs',
  invested: 'Invested from income',
  left: 'Balance',
};

export function MoneyFlowChart({
  flow,
  month,
  bare = false,
  balanceNote,
  collapsed = false,
}: {
  flow: MoneyFlow;
  month: string;
  /** Inside another card, such as the month summary, with no card or title of its own. */
  bare?: boolean;
  /** How the balance is worked out, shown when its band is tapped. */
  balanceNote?: ReactNode;
  /** Closed: only the table screen readers get, with every figure. */
  collapsed?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const ids = useId().replace(/:/g, '');
  const [width, setWidth] = useState(340);
  const [chosen, setChosen] = useState<string | null>(null);

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const measure = () => setWidth(Math.max(300, Math.round(element.clientWidth)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  if (flow.total <= 0 || flow.outcomes.length === 0) return null;

  const wide = width >= WIDE;
  // Exact amounts everywhere, so the chart matches the figures beside it to the rupee.
  const compact = formatMoney;
  const showCategories = wide && flow.categories.length > 1;
  const height = wide ? 300 : 212;
  const top = 22;

  // Column positions: labels outside the first and last columns.
  const xs = wide
    ? showCategories
      ? [190, width * 0.38, width * 0.6, width - 190]
      : [190, width * 0.47, width - 230]
    : // Phones name each source inside its band, so the flow gets the full width.
      [0, width * 0.47, width - 126];
  const [xSource = 0, xIncome = 0, xOut = 0, xCat = 0] = xs;

  const sources = stack(flow.sources, flow.total, height, top);
  const outcomes = stack(flow.outcomes, flow.total, height, top);
  const spending = outcomes.find((node) => node.key === 'spent');
  const spentTotal = spending?.amount ?? 0;
  const categories =
    showCategories && spending
      ? stack(
          flow.categories,
          spentTotal,
          Math.min(height, Math.max(spending.h * 2.2, 140)),
          Math.max(top, spending.y - 10),
        )
      : [];
  const bottom = Math.max(
    top + height,
    ...[...sources, ...outcomes, ...categories].map((node) => node.labelY + 18),
  );

  // Bands out of the income column fade from income green into where the money went.
  const paths: { d: string; color: string; key: string; fade?: [number, number] }[] = [];
  // Sources into the one income column.
  let into = top;
  for (const node of sources) {
    const h = (node.amount / flow.total) * height;
    paths.push({
      key: `${node.key}-income`,
      d: band(xSource + NODE, node.y, node.h, xIncome, into, h),
      color: colorOf(node),
    });
    into += h;
  }
  // The income column out to each outcome.
  let from = top;
  for (const node of outcomes) {
    const h = (node.amount / flow.total) * height;
    paths.push({
      key: `income-${node.key}`,
      d: band(xIncome + NODE + 2, from, h, xOut, node.y, node.h),
      color: colorOf(node),
      fade: [xIncome + NODE + 2, xOut],
    });
    from += h;
  }
  // Spending out to its categories.
  if (spending) {
    let start = spending.y;
    for (const node of categories) {
      const h = (node.amount / spentTotal) * spending.h;
      paths.push({
        key: `spent-${node.key}`,
        d: band(xOut + NODE, start, h, xCat, node.y, node.h),
        color: colorOf(node),
      });
      start += h;
    }
  }

  const picked = [...flow.outcomes, ...flow.sources, ...flow.categories].find(
    (node) => node.key === chosen,
  );
  const choose = (key: string) => setChosen((now) => (now === key ? null : key));
  const node = (
    placed: Placed,
    x: number,
    side: 'left' | 'right' | 'inside',
    interactive: boolean,
  ) => {
    const color = colorOf(placed);
    const label = side === 'left' ? 'end' : 'start';
    const tx = side === 'left' ? x - 8 : x + NODE + 8;
    const room = side === 'left' ? x - 12 : side === 'inside' ? xIncome - tx - 8 : width - tx - 4;
    const percent = share(placed.amount, flow.total);
    return (
      <g
        aria-label={`${placed.label}, ${formatMoney(placed.amount)}, ${percent} of what came in`}
        className={interactive ? styles.node : undefined}
        key={placed.key}
        {...(interactive
          ? {
              onClick: () => choose(placed.key),
              onKeyDown: (event: React.KeyboardEvent) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  choose(placed.key);
                }
              },
              role: 'button',
              tabIndex: 0,
              'aria-pressed': chosen === placed.key,
            }
          : {})}
      >
        <rect height={placed.h} rx="3" style={{ fill: color }} width={NODE} x={x} y={placed.y} />
        {/* A wider, invisible target, so thin bands are easy to tap. */}
        {interactive ? (
          <rect
            className={styles.hit}
            height={Math.max(placed.h, 28)}
            width={side === 'left' ? 90 : side === 'inside' ? xIncome - x : 130}
            x={side === 'left' ? x - 80 : x - 4}
            y={placed.y + placed.h / 2 - Math.max(placed.h, 28) / 2}
          />
        ) : null}
        <text className={styles.label} textAnchor={label} x={tx} y={placed.labelY - 2}>
          {fit(placed.label, room)}
        </text>
        <text className={styles.amount} textAnchor={label} x={tx} y={placed.labelY + 13}>
          {compact(placed.amount)}
          {side === 'right' ? ` · ${percent}` : ''}
        </text>
      </g>
    );
  };

  const table = (
    <table className={ui.visuallyHidden}>
      <caption>Where the money went</caption>
      <tbody>
        {[...flow.sources, ...flow.outcomes, ...flow.categories].map((row) => (
          <tr key={row.key}>
            <th scope="row">
              {row.key.startsWith('in-')
                ? `From ${row.label}`
                : row.key.startsWith('cat-')
                  ? `Spending on ${row.label}`
                  : (TABLE_LABELS[row.key] ?? row.label)}
            </th>
            <td>{formatMoney(row.amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  const body = (
    <>
      <div className={styles.box} ref={box}>
        <svg
          className={styles.chart}
          height={bottom + 4}
          role="group"
          aria-label="Money flow"
          viewBox={`0 0 ${width} ${bottom + 4}`}
          width={width}
        >
          <defs>
            {paths.map((path) =>
              path.fade ? (
                <linearGradient
                  gradientUnits="userSpaceOnUse"
                  id={`${ids}${path.key}`}
                  key={path.key}
                  x1={path.fade[0]}
                  x2={path.fade[1]}
                  y1="0"
                  y2="0"
                >
                  <stop offset="0" style={{ stopColor: COLORS.income }} />
                  <stop offset="1" style={{ stopColor: path.color }} />
                </linearGradient>
              ) : null,
            )}
          </defs>
          {paths.map((path) => (
            <path
              className={chosen && !path.key.includes(chosen) ? styles.bandFaded : styles.band}
              d={path.d}
              key={path.key}
              style={{ fill: path.fade ? `url(#${ids}${path.key})` : path.color }}
            />
          ))}
          <rect
            height={height}
            rx="4"
            style={{ fill: COLORS.income }}
            width={NODE + 2}
            x={xIncome}
            y={top}
          />
          <text className={styles.label} textAnchor="middle" x={xIncome + NODE / 2 + 1} y={top - 8}>
            {flow.sources.some((row) => row.key === 'in-bank') ? 'In' : 'Income'}{' '}
            {compact(flow.total)}
          </text>
          {sources.map((placed) => node(placed, xSource, wide ? 'left' : 'inside', true))}
          {outcomes.map((placed) =>
            showCategories && placed.key === 'spent' ? (
              <g key={placed.key}>
                <rect
                  height={placed.h}
                  rx="3"
                  style={{ fill: colorOf(placed) }}
                  width={NODE}
                  x={xOut}
                  y={placed.y}
                />
                <text
                  className={styles.label}
                  textAnchor="middle"
                  x={xOut + NODE / 2}
                  y={Math.max(12, placed.y - 8)}
                >
                  Spending {compact(placed.amount)}
                </text>
              </g>
            ) : (
              node(placed, xOut, 'right', true)
            ),
          )}
          {categories.map((placed) => node(placed, xCat, 'right', true))}
        </svg>
      </div>
      {picked ? (
        <div aria-live="polite" className={styles.detail}>
          <div className={styles.detailRow}>
            <strong>{picked.label}</strong>
            <strong>{formatMoney(picked.amount)}</strong>
          </div>
          <span className={ui.caption}>
            {share(picked.amount, flow.total)} of the {formatMoney(flow.total)} that came in
          </span>
          {picked.key === 'left' && balanceNote ? balanceNote : null}
          {picked.key === 'spent' && !showCategories && flow.categories.length > 0 ? (
            <ul className={styles.categories}>
              {flow.categories.map((row) => (
                <li key={row.key}>
                  <span>{row.label}</span>
                  <span>{formatMoney(row.amount)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {table}
    </>
  );
  if (collapsed) return table;
  if (bare) return <div className={styles.bare}>{body}</div>;
  return (
    <section aria-labelledby="money-flow" className={ui.card}>
      <div>
        <h2 className={ui.cardTitle} id="money-flow">
          Where {formatMonth(month).split(' ')[0]}'s money went
        </h2>
        <p className={ui.caption} style={{ margin: '4px 0 0' }}>
          {formatMoney(flow.sources.reduce((sum, row) => sum + row.amount, 0))} in
          {wide ? '' : ' · tap a band for details'}
        </p>
      </div>
      {body}
    </section>
  );
}
