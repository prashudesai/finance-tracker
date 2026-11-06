import { ChevronRight, Sparkles } from 'lucide-react';
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

const OPEN_KEY = 'insightsOpen';

/** Whether the tile was left open on this device. Closed until someone opens it. */
function savedOpen() {
  try {
    return localStorage.getItem(OPEN_KEY) === '1';
  } catch {
    return false;
  }
}

function saveOpen(open: boolean) {
  try {
    localStorage.setItem(OPEN_KEY, open ? '1' : '0');
  } catch {
    // Remembered for this visit only.
  }
}

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

/** The most useful patterns in the records right now, worked out on this device. */
export function InsightsCard() {
  const data = useSpendingView();
  const today = localDate();
  const list = useMemo(() => insights(data, today), [data, today]);
  // Ten a day, picked fresh each morning; See all keeps the full list.
  const today10 = useMemo(() => dailyInsights(list, today), [list, today]);
  const [all, setAll] = useState(false);
  const [recap, setRecap] = useState(false);
  const [open, setOpen] = useState(savedOpen);
  if (list.length === 0) return null;
  const top = today10[0];
  const preview = top ? describeInsight(top).title : '';

  return (
    <details
      aria-label="Insights"
      className={`${ui.card} ${ui.fold}`}
      onToggle={(event) => {
        const now = event.currentTarget.open;
        setOpen(now);
        saveOpen(now);
      }}
      open={open}
    >
      <summary className={styles.summary}>
        <span className={styles.summaryTitle}>
          <Sparkles aria-hidden="true" size={16} /> Today's insights · {today10.length}
        </span>
        {/* The headline, so the tile is useful even closed. Amber when it's a warning. */}
        <span className={styles.preview} data-tone={top?.tone}>
          {preview}
        </span>
      </summary>
      <p className={ui.caption}>
        {today10.length < list.length
          ? `Picked for ${formatDay(today)} from ${list.length}, with anything needing action first. New picks each morning.`
          : 'Anything needing action comes first.'}{' '}
        Worked out on your phone, from your records only.
      </p>
      <ul className={styles.list}>
        {today10.map((insight) => (
          <InsightRow insight={insight} key={insight.id} />
        ))}
      </ul>
      <div className={ui.actions}>
        {list.length > today10.length ? (
          <button className={ui.quiet} onClick={() => setAll(true)} type="button">
            See all {list.length}
          </button>
        ) : null}
        <button className={ui.quiet} onClick={() => setRecap(true)} type="button">
          Monthly recap
        </button>
      </div>
      {all ? (
        <Modal onClose={() => setAll(false)} title="Insights">
          <ul className={styles.list}>
            {list.map((insight) => (
              <InsightRow insight={insight} key={insight.id} onOpen={() => setAll(false)} />
            ))}
          </ul>
        </Modal>
      ) : null}
      {recap ? <RecapView onClose={() => setRecap(false)} /> : null}
    </details>
  );
}
