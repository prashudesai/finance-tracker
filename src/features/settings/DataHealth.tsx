import { CircleCheck } from 'lucide-react';
import { useNavigate } from 'react-router';
import type { AttentionTarget } from '../../domain/analytics';
import { dataHealth, STALE_DAYS, type HealthIssue } from '../../domain/health';
import { useTracker } from '../../store/tracker';
import { formatDay, formatMoney, formatShortMonthYear, localDate } from '../../ui/format';
import ui from '../../ui/ui.module.css';

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

const listOf = (items: string[], shown = 3) =>
  items.length > shown
    ? `${items.slice(0, shown).join(', ')} and ${items.length - shown} more`
    : items.join(', ');

/** Plain words for an issue, and where it gets put right. */
function describe(issue: HealthIssue): {
  title: string;
  detail: string;
  path?: string;
  state?: AttentionTarget;
} {
  switch (issue.kind) {
    case 'missingBalances':
      return {
        title: `${plural(issue.months.length, 'month')} without a bank balance`,
        detail: `${listOf(issue.months.map(formatShortMonthYear))}. Without both balances, unrecorded spending can't be worked out for the month before.`,
        path: '/cash-flow',
        state: { review: issue.months.at(-1) ?? '' },
      };
    case 'moreThanExpected':
      return {
        title: `The bank held more than expected in ${plural(issue.months.length, 'month')}`,
        detail: `${listOf(issue.months.map((row) => `${formatShortMonthYear(row.month)}, ${formatMoney(row.amount)} more`))}. Some income, a refund or interest may not be recorded.`,
        path: '/cash-flow',
        state: { review: issue.months[0]?.month ?? '' },
      };
    case 'staleValues':
      return {
        title: `${plural(issue.names.length, 'investment')} without a value in over ${Math.round(STALE_DAYS / 7)} weeks`,
        detail: `${listOf(issue.names)}. The oldest was last updated on ${formatDay(issue.oldest)} ${issue.oldest.slice(0, 4)}, so net worth and returns may be out of date.`,
        path: '/investments',
      };
    case 'loanErrors':
      return {
        title: `${plural(issue.loans.length, "loan's", "loans'")} history doesn't add up`,
        detail: issue.loans.map((loan) => `${loan.name}: ${loan.error}`).join(' '),
        path: '/debts',
      };
    case 'orphans':
      return {
        title: `${plural(issue.records.length, 'record')} left from deleted investments or loans`,
        detail: "They don't show on any screen, but they'd still go into exports and backups.",
      };
  }
}

/** The data health check: what would make figures wrong, and a way to each fix. */
export function DataHealth({ onClose }: { onClose: () => void }) {
  const household = useTracker((state) => state.data);
  const commit = useTracker((state) => state.commit);
  const canEdit = useTracker((state) => state.canEdit);
  const navigate = useNavigate();
  const issues = dataHealth(household, localDate());

  if (issues.length === 0) {
    return (
      <p className={ui.notice} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <CircleCheck aria-hidden="true" size={18} /> All good. Nothing in your records needs a look.
      </p>
    );
  }
  return (
    <div className={ui.page}>
      <p className={ui.caption} style={{ margin: 0 }}>
        These would make some figures wrong or out of date. Each one says where to put it right.
      </p>
      <ul className={ui.list}>
        {issues.map((issue) => {
          const { title, detail, path, state } = describe(issue);
          return (
            <li className={ui.row} key={issue.kind} style={{ alignItems: 'flex-start' }}>
              <div className={ui.rowMain}>
                <div className={ui.rowTitle}>{title}</div>
                <div className={ui.rowDetail}>{detail}</div>
              </div>
              {path ? (
                <button
                  aria-label={`Fix: ${title}`}
                  className={ui.textLink}
                  onClick={() => {
                    onClose();
                    void navigate(path, { state });
                  }}
                  style={{ background: 'none', border: 0, cursor: 'pointer' }}
                  type="button"
                >
                  Fix ›
                </button>
              ) : issue.kind === 'orphans' && canEdit ? (
                <button
                  aria-label={`Remove: ${title}`}
                  className={ui.textLink}
                  onClick={() => {
                    if (!window.confirm(`Remove ${plural(issue.records.length, 'record')}?`))
                      return;
                    commit(
                      issue.records.map(({ collection, id }) => ({
                        type: 'delete',
                        collection,
                        id,
                      })),
                    );
                  }}
                  style={{ background: 'none', border: 0, cursor: 'pointer' }}
                  type="button"
                >
                  Remove
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** A short line for the Settings tile. */
export function useHealthSummary() {
  const household = useTracker((state) => state.data);
  const count = dataHealth(household, localDate()).length;
  return count === 0
    ? 'All good · checks that figures add up'
    : `${plural(count, 'thing')} to check`;
}
