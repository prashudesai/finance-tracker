import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { useMemo, useState, type CSSProperties } from 'react';
import { nextMonth, previousMonth } from '../../domain/calendar';
import { retirementMonth, type RetirementKind } from '../../domain/retirementMonth';
import type { TrackerData } from '../../data/repository';
import { formatDay, formatMoney, formatMonth } from '../../ui/format';
import ui from '../../ui/ui.module.css';
import styles from './RetirementMonthCard.module.css';

const LABELS: Record<RetirementKind, string> = { pf: 'PF', ppf: 'PPF', nps: 'NPS' };
const COLORS: Record<RetirementKind, string> = {
  pf: 'var(--cat-amber)',
  ppf: 'var(--cat-gold)',
  nps: 'var(--cat-blue)',
};

const compared = (total: number, previous: number) => {
  if (Math.abs(total - previous) < 1) return previous === 0 ? null : 'Same as last month';
  return previous === 0 ? 'Nothing last month' : `Last month ${formatMoney(previous)}`;
};

/**
 * What went into PF, PPF and NPS in a month: the total first, a bar of how it split, then each
 * type with who put in what, the employer's part of PF, and anything scheduled still to come.
 */
export function RetirementMonthCard({ data, today }: { data: TrackerData; today: string }) {
  const current = today.slice(0, 7);
  const [month, setMonth] = useState(current);
  const first = useMemo(
    () =>
      data.holdings
        .filter((holding) => holding.kind !== 'investment')
        .reduce((earliest, holding) => {
          const start = holding.date.slice(0, 7);
          return start < earliest ? start : earliest;
        }, current),
    [data.holdings, current],
  );
  const summary = useMemo(
    () => retirementMonth(data.holdings, data.contributions, month),
    [data.holdings, data.contributions, month],
  );
  if (summary.types.length === 0) return null;

  const before = month > first ? previousMonth(month) : null;
  const after = month < current ? nextMonth(month) : null;
  const expected = summary.types.flatMap((type) => type.expected);
  const expectedTotal = expected.reduce((sum, row) => sum + row.amount, 0);
  const caption = [
    summary.employer > 0 ? `${formatMoney(summary.employer)} from employers` : null,
    compared(summary.total, summary.previousTotal),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <section aria-label="Put in this month" className={`${ui.card} ${styles.card}`}>
      <div className={styles.head}>
        <span className={styles.label}>
          Put in {month === current ? 'this month' : 'that month'}
        </span>
        <span className={styles.months}>
          <button
            aria-label={before ? `Previous month, ${formatMonth(before)}` : 'No earlier month'}
            className={styles.arrow}
            disabled={!before}
            onClick={() => before && setMonth(before)}
            type="button"
          >
            <ChevronLeft aria-hidden="true" size={16} />
          </button>
          <span className={styles.month}>{formatMonth(month)}</span>
          <button
            aria-label={after ? `Next month, ${formatMonth(after)}` : 'No later month'}
            className={styles.arrow}
            disabled={!after}
            onClick={() => after && setMonth(after)}
            type="button"
          >
            <ChevronRight aria-hidden="true" size={16} />
          </button>
        </span>
      </div>
      <div className={styles.totalLine}>
        <span className={styles.total}>{formatMoney(summary.total)}</span>
        {caption ? <span className={styles.caption}>{caption}</span> : null}
      </div>
      {expectedTotal > 0 ? (
        <div className={styles.due}>
          <Clock aria-hidden="true" size={14} />
          {formatMoney(expectedTotal)} still to come
        </div>
      ) : null}

      {summary.total > 0 ? (
        <div aria-hidden="true" className={styles.bar}>
          {summary.types
            .filter((type) => type.total > 0)
            .map((type) => (
              <span key={type.kind} style={{ flex: type.total, background: COLORS[type.kind] }} />
            ))}
        </div>
      ) : null}

      {summary.total === 0 && expected.length === 0 ? (
        <p className={styles.empty}>
          Nothing recorded {month === current ? 'yet ' : ''}for {formatMonth(month)}.
        </p>
      ) : (
        <ul className={styles.rows}>
          {summary.types.map((type) => {
            const people = type.byMember
              .map(({ member, amount }) => {
                const waiting = type.expected.find((row) => row.member === member);
                const who = member || 'Unassigned';
                if (amount === 0 && waiting) return `${who} due ${formatDay(waiting.date)}`;
                if (amount === 0) return `${who} ${month === current ? 'nothing yet' : 'nothing'}`;
                return type.byMember.length === 1 ? who : `${who} ${formatMoney(amount)}`;
              })
              .join(' · ');
            const detail =
              type.employer > 0
                ? `Employee ${formatMoney(type.total - type.employer)} · Employer ${formatMoney(type.employer)}`
                : people;
            return (
              <li
                className={styles.row}
                key={type.kind}
                style={{ '--type': COLORS[type.kind] } as CSSProperties}
              >
                <span aria-hidden="true" className={styles.swatch} />
                <div className={styles.main}>
                  <div className={styles.name}>{LABELS[type.kind]}</div>
                  <div className={styles.detail}>{detail}</div>
                  {type.employer > 0 && type.byMember.length > 1 ? (
                    <div className={styles.detail}>{people}</div>
                  ) : null}
                </div>
                <div className={styles.side}>
                  <div className={styles.amount}>{formatMoney(type.total)}</div>
                  {type.expected.length > 0 ? (
                    <div className={styles.waiting}>
                      <Clock aria-hidden="true" size={12} />
                      {type.expected.length} due
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className={styles.year}>
        <span>This financial year</span>
        <strong>{formatMoney(summary.yearTotal)}</strong>
      </div>
    </section>
  );
}
