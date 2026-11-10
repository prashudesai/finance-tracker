import { ArrowDown, ArrowUp, LayoutGrid } from 'lucide-react';
import { Fragment, useState, type ReactNode } from 'react';
import { Modal } from '../../ui/Modal';
import ui from '../../ui/ui.module.css';
import styles from './Dashboard.module.css';
import homeStyles from './Home.module.css';

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
 * Home's sections in the order each person chooses, with any hidden, kept on this device. On
 * phones they follow the chosen order; wide screens keep their two columns and hide the ones
 * switched off. Prompts such as the monthly recap come after the first two of your own figures.
 */
export function HomeSections({
  greeting,
  intro,
  sections,
  prompts,
  phone,
}: {
  /** The page's heading, with Arrange Home beside it. */
  greeting: ReactNode;
  /** Shown under the heading before any section, such as quick setup. */
  intro: ReactNode;
  sections: Record<HomeSection, ReactNode>;
  prompts: ReactNode;
  phone: boolean;
}) {
  const [layout, setLayout] = useState(savedLayout);
  const [arranging, setArranging] = useState(false);
  const shown = (key: HomeSection) => !layout.hidden.includes(key);
  const pick = (key: HomeSection) => (shown(key) ? sections[key] : null);

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
  const content = phone ? (
    visible.map((key, index) => (
      <Fragment key={key}>
        {sections[key]}
        {index === Math.min(1, visible.length - 1) ? prompts : null}
      </Fragment>
    ))
  ) : (
    <>
      {/* One column on phones; on wide screens, net worth beside this month. */}
      <div className={homeStyles.layout}>
        {shown('netWorth') ? <div className={homeStyles.column}>{sections.netWorth}</div> : null}
        <div className={homeStyles.column}>
          {pick('month')}
          {pick('insights')}
          {pick('comingUp')}
          {pick('recent')}
        </div>
      </div>
      {/* Prompts come after your own figures, never before them. */}
      {prompts}
      {pick('goals')}
      {/* Side by side on wide screens, half and half. */}
      {shown('income') || shown('portfolio') ? (
        <div className={styles.pair}>
          {pick('income')}
          {pick('portfolio')}
        </div>
      ) : null}
      {pick('debts')}
    </>
  );

  return (
    <>
      <div className={styles.greetingRow}>
        {greeting}
        <button
          aria-label="Arrange Home"
          className={ui.iconButton}
          data-tip="Arrange Home"
          onClick={() => setArranging(true)}
          type="button"
        >
          <LayoutGrid aria-hidden="true" size={18} />
        </button>
      </div>
      {intro}
      {content}
      {arranging ? (
        <Modal onClose={() => setArranging(false)} title="Arrange Home">
          <p className={ui.caption}>
            Choose what Home shows{phone ? ' and in what order' : ''}. Kept on this device.
            {phone
              ? ''
              : ' On wide screens Home keeps its two columns; the order applies on phones.'}
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
