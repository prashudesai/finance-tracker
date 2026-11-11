import { ArrowDown, ArrowUp, BellRing, LayoutGrid } from 'lucide-react';
import { Fragment, useState, type CSSProperties, type ReactNode } from 'react';
import { Modal } from '../../ui/Modal';
import ui from '../../ui/ui.module.css';
import styles from './Dashboard.module.css';

export const HOME_SECTIONS = [
  'netWorth',
  'month',
  'insights',
  'comingUp',
  'recent',
  'goals',
  'income',
  'portfolio',
  'debts',
] as const;
export type HomeSection = (typeof HOME_SECTIONS)[number];

const LABELS: Record<HomeSection, string> = {
  netWorth: 'Net worth',
  month: 'This month so far',
  insights: 'For you today',
  comingUp: 'Coming up',
  recent: 'Recent',
  goals: 'Goals',
  income: 'Income vs expenses',
  portfolio: 'Investment portfolio',
  debts: 'Debt summary',
};

const KEY = 'homeSections';

/**
 * Sections that sit side by side on wide screens when they come one after the other, and the
 * share of 12 columns each takes. Anything else spans the full width.
 */
const PAIRS: [HomeSection, number, HomeSection, number][] = [
  ['netWorth', 7, 'month', 5],
  ['comingUp', 5, 'recent', 7],
  ['income', 6, 'portfolio', 6],
  ['insights', 7, 'goals', 5],
];

function gridSpans(visible: HomeSection[]) {
  const spans = new Map<HomeSection, number>();
  for (let index = 0; index < visible.length; index++) {
    const key = visible[index];
    const next = visible[index + 1];
    if (!key) continue;
    const pair = next
      ? PAIRS.find(([a, , b]) => (a === key && b === next) || (b === key && a === next))
      : undefined;
    if (pair && next) {
      const [a, aSpan, , bSpan] = pair;
      spans.set(key, key === a ? aSpan : bSpan);
      spans.set(next, next === a ? aSpan : bSpan);
      index += 1;
    } else spans.set(key, 12);
  }
  return spans;
}

interface Layout {
  order: HomeSection[];
  hidden: HomeSection[];
}

const DEFAULT: Layout = { order: [...HOME_SECTIONS], hidden: [] };

const isSection = (value: unknown): value is HomeSection =>
  HOME_SECTIONS.includes(value as HomeSection);

/** The saved layout, with any section added since it was saved put at the end. */
function savedLayout(): Layout {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Layout> | null;
    if (!parsed) return DEFAULT;
    const order = (parsed.order ?? []).filter(isSection);
    return {
      order: [...new Set([...order, ...HOME_SECTIONS])],
      hidden: (parsed.hidden ?? []).filter(isSection),
    };
  } catch {
    return DEFAULT;
  }
}

/**
 * Home's sections in the order each person chooses, with any hidden, kept on this device. One
 * column on phones; on wide screens a 12-column grid where neighbours that belong together
 * share a row. Prompts such as the monthly recap come after the first row of your own figures.
 */
export function HomeSections({
  greeting,
  attention,
  intro,
  sections,
  prompts,
}: {
  /** The page's heading, with Arrange Home beside it. */
  greeting: ReactNode;
  /** What needs attention: a bell with the count beside the heading opens the list. */
  attention: { count: number; list: ReactNode };
  /** Shown under the heading before any section, such as quick setup. */
  intro: ReactNode;
  sections: Record<HomeSection, ReactNode>;
  prompts: ReactNode;
}) {
  const [layout, setLayout] = useState(savedLayout);
  const [arranging, setArranging] = useState(false);
  const [alerts, setAlerts] = useState(false);
  const shown = (key: HomeSection) => !layout.hidden.includes(key);

  const save = (next: Layout) => {
    setLayout(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Kept for this visit only.
    }
  };
  const move = (index: number, by: number) => {
    const order = [...layout.order];
    const [item] = order.splice(index, 1);
    if (!item) return;
    order.splice(index + by, 0, item);
    save({ ...layout, order });
  };
  const toggle = (key: HomeSection) =>
    save({
      ...layout,
      hidden: shown(key) ? [...layout.hidden, key] : layout.hidden.filter((item) => item !== key),
    });

  const visible = layout.order.filter(shown);
  const spans = gridSpans(visible);
  // Prompts such as the monthly recap come after the first row of your own figures.
  const firstRow = spans.get(visible[0] ?? 'netWorth') === 12 ? 1 : 2;
  const content = (
    <div className={styles.homeGrid}>
      {visible.map((key, index) => (
        <Fragment key={key}>
          <div className={styles.cell} style={{ '--span': spans.get(key) ?? 12 } as CSSProperties}>
            {sections[key]}
          </div>
          {index === Math.min(firstRow, visible.length) - 1 ? (
            <div className={styles.cell} style={{ '--span': 12 } as CSSProperties}>
              {prompts}
            </div>
          ) : null}
        </Fragment>
      ))}
    </div>
  );

  return (
    <>
      <div className={styles.greetingRow}>
        {greeting}
        <span className={styles.greetingTools}>
          {attention.count > 0 ? (
            <button
              aria-label={`Needs attention, ${attention.count}`}
              className={`${ui.iconButton} ${styles.bell}`}
              data-tip="Needs attention"
              onClick={() => setAlerts(true)}
              type="button"
            >
              <BellRing aria-hidden="true" size={18} />
              <span aria-hidden="true" className={styles.bellCount}>
                {attention.count}
              </span>
            </button>
          ) : null}
          <button
            aria-label="Arrange Home"
            className={ui.iconButton}
            data-tip="Arrange Home"
            onClick={() => setArranging(true)}
            type="button"
          >
            <LayoutGrid aria-hidden="true" size={18} />
          </button>
        </span>
      </div>
      {intro}
      {content}
      {alerts && attention.count > 0 ? (
        <Modal onClose={() => setAlerts(false)} title="Needs attention">
          {attention.list}
        </Modal>
      ) : null}
      {arranging ? (
        <Modal onClose={() => setArranging(false)} title="Arrange Home">
          <p className={ui.caption}>
            Choose what Home shows and in what order. Kept on this device. On wide screens,
            neighbours such as net worth and this month sit side by side.
          </p>
          <ol className={styles.arrangeList}>
            {layout.order.map((key, index) => (
              <li data-hidden={!shown(key) || undefined} key={key}>
                <label className={styles.arrangeName}>
                  <input
                    checked={shown(key)}
                    className={ui.switch}
                    onChange={() => toggle(key)}
                    type="checkbox"
                  />
                  {LABELS[key]}
                </label>
                <span className={styles.arrangeMoves}>
                  <button
                    aria-label={`Move ${LABELS[key]} up`}
                    className={ui.iconButton}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    type="button"
                  >
                    <ArrowUp aria-hidden="true" size={16} />
                  </button>
                  <button
                    aria-label={`Move ${LABELS[key]} down`}
                    className={ui.iconButton}
                    disabled={index === layout.order.length - 1}
                    onClick={() => move(index, 1)}
                    type="button"
                  >
                    <ArrowDown aria-hidden="true" size={16} />
                  </button>
                </span>
              </li>
            ))}
          </ol>
          <div className={ui.formActions}>
            <button className={ui.quiet} onClick={() => save(DEFAULT)} type="button">
              Reset
            </button>
            <button className={ui.button} onClick={() => setArranging(false)} type="button">
              Done
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
