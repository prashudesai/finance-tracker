import { ChevronRight, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { insights, type Insight } from '../../domain/insights';
import { useView } from '../../store/tracker';
import { localDate } from '../../ui/format';
import { Modal } from '../../ui/Modal';
import ui from '../../ui/ui.module.css';
import { describeInsight } from './insightText';
import { RecapView } from './MonthRecap';
import styles from './Insights.module.css';

const SHOWN = 3;

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
  const data = useView();
  const today = localDate();
  const list = useMemo(() => insights(data, today), [data, today]);
  const [all, setAll] = useState(false);
  const [recap, setRecap] = useState(false);
  if (list.length === 0) return null;

  return (
    <section aria-labelledby="insights-title" className={ui.card}>
      <div className={styles.head}>
        <span aria-hidden="true" className={styles.sparkle}>
          <Sparkles size={18} />
        </span>
        <div>
          <h2 id="insights-title">Insights</h2>
          <p className={ui.caption}>Worked out on your phone, from your records only.</p>
        </div>
      </div>
      <ul className={styles.list}>
        {list.slice(0, SHOWN).map((insight) => (
          <InsightRow insight={insight} key={insight.id} />
        ))}
      </ul>
      <div className={ui.actions}>
        {list.length > SHOWN ? (
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
    </section>
  );
}
