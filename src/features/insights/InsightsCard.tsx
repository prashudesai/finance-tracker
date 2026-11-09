import { ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { dailyInsights, insights, type Insight } from '../../domain/insights';
import { useSpendingView } from '../../store/tracker';
import { formatDay, localDate } from '../../ui/format';
import { Modal } from '../../ui/Modal';
import ui from '../../ui/ui.module.css';
import { describeInsight } from './insightText';
import { RecapView } from './MonthRecap';
import styles from './Insights.module.css';

function InsightRow({ insight, onOpen }: { insight: Insight; onOpen?: () => void }) {
  const [open, setOpen] = useState(false);
  const { icon: Icon, title, detail, why, path, note } = describeInsight(insight);
  return (
    <li className={styles.insight} data-tone={insight.tone}>
      <span aria-hidden="true" className={styles.icon}>
        <Icon size={18} />
      </span>
      <div className={styles.body}>
        <strong>{title}</strong>
        <span className={styles.detail}>{detail}</span>
        {open ? (
          <dl className={styles.why}>
            {why.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
            {note ? <p>{note}</p> : null}
          </dl>
        ) : null}
        <span className={styles.links}>
          <button
            aria-expanded={open}
            className={ui.textButton}
            onClick={() => setOpen(!open)}
            type="button"
          >
            {open ? 'Hide numbers' : 'Why?'}
          </button>
          <Link className={ui.textButton} onClick={onOpen} to={path}>
            Open <ChevronRight aria-hidden="true" size={14} />
          </Link>
        </span>
      </div>
    </li>
  );
}

/** A word or two naming each kind of insight, for the card's tag. */
const TAGS: Partial<Record<Insight['kind'], string>> = {
  milestone: 'Milestone',
  quiet: 'Quiet month',
  dueSoon: 'Due soon',
  category: 'Spending',
  savings: 'Saving',
  emiLoad: 'EMIs',
  prepay: 'Loans',
  netWorthChange: 'Net worth',
  allocation: 'Mix',
  commitments: 'Bills',
  weekend: 'Weekends',
  invested: 'Investing',
  principal: 'Loans',
  pmsGain: 'PMS',
  goalBehind: 'Goal',
  goalReached: 'Goal',
  goalEta: 'Goal',
  incomeMix: 'Income',
  salaryRaise: 'Raise',
  incomeYoY: 'Income',
  topEarner: 'Income',
  incomeSteadiness: 'Income',
  per100: 'Income',
  biggest: 'Spending',
  cushion: 'Cushion',
  subscriptions: 'Subscriptions',
  staleValues: 'Values',
  savingsRange: 'Saving',
  memberSpend: 'Family',
  ppfRoom: 'PPF',
  streak: 'Streak',
  debtFree: 'Debt-free',
  dailyPace: 'Pace',
  noSpendDays: 'No-spend',
  leftoverToRetirement: 'Retirement',
};

/** A short card: its tag and headline. Tapping it shows the detail and the numbers behind it. */
function InsightCard({ insight, onOpen }: { insight: Insight; onOpen: () => void }) {
  const { icon: Icon, title } = describeInsight(insight);
  return (
    <li>
      <button className={styles.card} data-tone={insight.tone} onClick={onOpen} type="button">
        <span className={styles.tag}>
          <Icon aria-hidden="true" size={14} /> {TAGS[insight.kind] ?? 'Insight'}
        </span>
        <span className={styles.cardTitle}>{title}</span>
      </button>
    </li>
  );
}

/**
 * For you today: the most useful patterns in the records right now, worked out on this device,
 * as short cards that swipe sideways. See all lists every one.
 */
export function InsightsCard() {
  const data = useSpendingView();
  const today = localDate();
  const list = useMemo(() => insights(data, today), [data, today]);
  // Ten a day, picked fresh each morning; See all keeps the full list.
  const today10 = useMemo(() => dailyInsights(list, today), [list, today]);
  const [all, setAll] = useState(false);
  const [recap, setRecap] = useState(false);
  const [open, setOpen] = useState<Insight | null>(null);
  if (list.length === 0) return null;

  return (
    <section aria-labelledby="for-you" className={styles.today}>
      <div className={styles.todayHead}>
        <h2 id="for-you">For you today</h2>
        <span className={styles.todayActions}>
          <button className={ui.textButton} onClick={() => setRecap(true)} type="button">
            Monthly recap
          </button>
          <button className={ui.textButton} onClick={() => setAll(true)} type="button">
            See all {list.length}
          </button>
        </span>
      </div>
      <ul aria-label={`Picked for ${formatDay(today)}`} className={styles.strip}>
        {today10.map((insight) => (
          <InsightCard insight={insight} key={insight.id} onOpen={() => setOpen(insight)} />
        ))}
      </ul>
      {open ? (
        <Modal onClose={() => setOpen(null)} title={TAGS[open.kind] ?? 'Insight'}>
          <ul className={styles.list}>
            <InsightRow insight={open} onOpen={() => setOpen(null)} />
          </ul>
        </Modal>
      ) : null}
      {all ? (
        <Modal onClose={() => setAll(false)} title="Insights">
          <p className={ui.caption}>
            Anything needing action comes first. Worked out on your phone, from your records only.
          </p>
          <ul className={styles.list}>
            {list.map((insight) => (
              <InsightRow insight={insight} key={insight.id} onOpen={() => setAll(false)} />
            ))}
          </ul>
        </Modal>
      ) : null}
      {recap ? <RecapView onClose={() => setRecap(false)} /> : null}
    </section>
  );
}
