import { CalendarHeart, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { previousMonth } from '../../domain/calendar';
import { monthRecap, recapMonths, type MonthRecap as Recap } from '../../domain/recap';
import { useView } from '../../store/tracker';
import { formatDay, formatMoney, formatMonth, localDate } from '../../ui/format';
import { Modal } from '../../ui/Modal';
import { Nudge } from '../../ui/Nudge';
import ui from '../../ui/ui.module.css';
import styles from './Insights.module.css';

const SEEN_KEY = 'recapSeen';
/** The recap of last month is offered in the first days of a new month. */
const OFFER_DAYS = 10;

const percent = (share: number) => `${Math.round(share * 100)}%`;
const monthName = (month: string) => formatMonth(month).split(' ')[0] ?? month;

function seen() {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

function markSeen(month: string) {
  try {
    localStorage.setItem(SEEN_KEY, month);
  } catch {
    // Offered again next visit.
  }
}

/** "▲ 33%" against the month before, or "New" when there was none. */
function Change({
  now,
  before,
  goodWhenUp,
}: {
  now: number;
  before: number | null;
  goodWhenUp: boolean;
}) {
  if (before === null || before === 0) return <span className={styles.chip}>New</span>;
  const change = (now - before) / before;
  if (Math.abs(change) < 0.005) return <span className={styles.chip}>Same</span>;
  const up = change > 0;
  return (
    <span className={styles.chip} data-tone={up === goodWhenUp ? 'good' : 'watch'}>
      {up ? '▲' : '▼'} {percent(Math.abs(change))}
    </span>
  );
}

/** A month still running isn't compared: half a month would always look like less spending. */
function RecapBody({ recap, running }: { recap: Recap; running: boolean }) {
  const widest = Math.max(recap.income, recap.expenses, 1);
  const rateChange =
    !running && recap.savingsRate !== null && recap.previous?.savingsRate != null
      ? Math.round((recap.savingsRate - recap.previous.savingsRate) * 100)
      : null;
  return (
    <div className={styles.recap}>
      <div className={styles.hero}>
        <span className={ui.caption}>{recap.saved >= 0 ? 'You kept' : 'You overspent by'}</span>
        <strong>{formatMoney(Math.abs(recap.saved))}</strong>
        <span className={ui.caption}>
          {recap.savingsRate === null
            ? 'No income recorded'
            : `${percent(Math.max(recap.savingsRate, 0))} of income`}
          {rateChange === null || rateChange === 0
            ? ''
            : ` · ${rateChange > 0 ? 'up' : 'down'} ${Math.abs(rateChange)} points on ${monthName(previousMonth(recap.month))}`}
        </span>
      </div>

      <div className={styles.bars}>
        <div>
          <span>Income</span>
          <i style={{ width: `${(recap.income / widest) * 100}%` }} />
          <b>{formatMoney(recap.income)}</b>
        </div>
        <div data-kind="spend">
          <span>Spending</span>
          <i style={{ width: `${(recap.expenses / widest) * 100}%` }} />
          <b>{formatMoney(recap.expenses)}</b>
        </div>
      </div>

      {recap.categories.length > 0 ? (
        <div>
          <h3 className={styles.sub}>Where it went</h3>
          <ul className={styles.rows}>
            {recap.categories.map((row) => (
              <li key={row.category}>
                <span>{row.category}</span>
                {running ? (
                  <span />
                ) : (
                  <Change before={row.previous} goodWhenUp={false} now={row.amount} />
                )}
                <b>{formatMoney(row.amount)}</b>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {recap.incomeSources.length > 0 ? (
        <div>
          <h3 className={styles.sub}>Where it came from</h3>
          <ul className={styles.rows}>
            {recap.incomeSources.map((row) => (
              <li key={row.source}>
                <span>{row.source}</span>
                <b>{formatMoney(row.amount)}</b>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className={styles.stats}>
        <div>
          <span>EMIs paid</span>
          <b>{formatMoney(recap.emiPaid)}</b>
        </div>
        <div>
          <span>Invested</span>
          <b>{formatMoney(recap.invested)}</b>
        </div>
        {recap.netWorth ? (
          <div>
            <span>Net worth change</span>
            <b>
              {recap.netWorth.end >= recap.netWorth.start ? '+' : '−'}
              {formatMoney(Math.abs(recap.netWorth.end - recap.netWorth.start))}
            </b>
          </div>
        ) : null}
        <div>
          <span>Entries recorded</span>
          <b>{recap.records}</b>
        </div>
      </div>

      {recap.biggest ? (
        <p className={ui.caption}>
          Biggest expense: <strong>{recap.biggest.category}</strong>,{' '}
          {formatMoney(recap.biggest.amount)} on {formatDay(recap.biggest.date)}
          {recap.biggest.note ? ` (${recap.biggest.note})` : ''}.
        </p>
      ) : null}
    </div>
  );
}

/** Any month with records, one at a time, newest first. */
export function RecapView({ onClose, start }: { onClose: () => void; start?: string }) {
  const data = useView();
  const today = localDate();
  const months = useMemo(() => recapMonths(data, today.slice(0, 7)), [data, today]);
  // The latest finished month, unless asked for another. The running month is one tap on.
  const [index, setIndex] = useState(() => {
    const wanted = start ?? months.find((month) => month < today.slice(0, 7));
    return Math.max(0, wanted ? months.indexOf(wanted) : 0);
  });
  const month = months[index];
  const recap = useMemo(
    () => (month ? monthRecap(data, month, today) : null),
    [data, month, today],
  );
  const running = month === today.slice(0, 7);

  return (
    <Modal onClose={onClose} title="Monthly recap">
      {recap && month ? (
        <div className={ui.page}>
          <div className={styles.monthBar}>
            <button
              aria-label="Earlier month"
              className={ui.iconButton}
              disabled={index >= months.length - 1}
              onClick={() => setIndex(index + 1)}
              type="button"
            >
              <ChevronLeft size={18} />
            </button>
            <strong>
              {formatMonth(month)}
              {running ? ' so far' : ''}
            </strong>
            <button
              aria-label="Later month"
              className={ui.iconButton}
              disabled={index === 0}
              onClick={() => setIndex(index - 1)}
              type="button"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <RecapBody recap={recap} running={running} />
          {running ? (
            <p className={ui.caption}>
              The month isn’t over, so it’s compared with the month before once it ends.
            </p>
          ) : null}
        </div>
      ) : (
        <p className={ui.empty}>No months with records yet.</p>
      )}
    </Modal>
  );
}

/** On the dashboard early in a month: last month in a sentence, until seen or set aside. */
export function RecapCard() {
  const data = useView();
  const today = localDate();
  const last = previousMonth(today.slice(0, 7));
  const [dismissed, setDismissed] = useState(() => seen() === last);
  const [open, setOpen] = useState(false);
  const recap = useMemo(() => monthRecap(data, last, today), [data, last, today]);
  const offer = Number(today.slice(8, 10)) <= OFFER_DAYS && recap.records > 0;
  if (!offer || (dismissed && !open)) return null;

  const close = () => {
    markSeen(last);
    setDismissed(true);
  };

  return (
    <Nudge
      action={
        <button
          aria-label="See your recap"
          className={ui.button}
          onClick={() => {
            setOpen(true);
            markSeen(last);
          }}
          type="button"
        >
          See
        </button>
      }
      closeLabel="Dismiss recap"
      detail={
        recap.saved >= 0
          ? `You kept ${formatMoney(recap.saved)}${recap.savingsRate === null ? '' : ` · ${percent(recap.savingsRate)}`}`
          : `You spent ${formatMoney(-recap.saved)} more than you earned`
      }
      icon={CalendarHeart}
      label={`Your ${monthName(last)} in numbers`}
      onClose={close}
      title={`Your ${monthName(last)} in numbers`}
    >
      {open ? (
        <RecapView
          onClose={() => {
            setOpen(false);
            setDismissed(true);
          }}
          start={last}
        />
      ) : null}
    </Nudge>
  );
}
