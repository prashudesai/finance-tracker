import { PiggyBank } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { budgetActuals, fyMonths, type CategoryActual } from '../../domain/budget';
import { financialYearLabel, financialYearStart } from '../../domain/calendar';
import { useSpendingHousehold } from '../../store/tracker';
import { EmptyState } from '../../ui/EmptyState';
import { formatMoney, formatMonth, localDate } from '../../ui/format';
import ui from '../../ui/ui.module.css';
import { MONTH_NAMES } from './budgetText';
import styles from './Budget.module.css';

const share = (part: number, whole: number) =>
  whole > 0 ? `${Math.min(100, Math.max(0, (part / whole) * 100))}%` : '0%';

/** Over or under, in words, for a difference of spent less planned. */
/** Nothing planned by today and nothing spent: the year's payment is still to come. */
const notDue = (row: CategoryActual) => row.planned === 0 && row.spent === 0;

const versus = (difference: number) =>
  difference > 0
    ? `${formatMoney(difference)} over`
    : difference < 0
      ? `${formatMoney(-difference)} under`
      : 'On plan';

/**
 * Planning › Insights › Budget vs actual: a planned year against what was spent, from expenses,
 * by category and by month. Nothing here is saved.
 */
export function BudgetActualPage() {
  const data = useSpendingHousehold();
  const today = localDate();
  const thisYear = financialYearStart(today);
  const years = data.budgets.map((row) => row.fy).sort((a, b) => b - a);
  const started = years.filter((year) => year <= thisYear);
  const [picked, setPicked] = useState<number | null>(null);
  const fy = picked ?? started[0] ?? years[0] ?? thisYear;
  const budget = data.budgets.find((row) => row.fy === fy);
  const actuals = useMemo(
    () => (budget ? budgetActuals(budget, data, today) : null),
    [budget, data, today],
  );
  const [month, setMonth] = useState<number | null>(null);

  if (!budget || !actuals) {
    return (
      <section className={ui.card}>
        <EmptyState
          action={
            <Link className={ui.quiet} to="/analytics/budget">
              Plan a year
            </Link>
          }
          icon={PiggyBank}
          text="Plan a financial year in Future › Yearly budget, and this page compares it with what you spend."
          title="No yearly budget yet"
        />
      </section>
    );
  }

  const notStarted = (fyMonths(fy)[0] ?? '') > today.slice(0, 7);
  const difference = actuals.spent - actuals.planned;
  const biggest = Math.max(
    ...actuals.months.map((row) => Math.max(row.planned, row.spent ?? 0)),
    1,
  );
  const chosen = month === null ? undefined : actuals.months[month];

  return (
    <>
      <section aria-labelledby="actual-total" className={ui.hero}>
        <div className={styles.heroTop}>
          <span className={ui.eyebrow} id="actual-total">
            {actuals.running ? 'So far in' : 'Spent in'} {financialYearLabel(fy)}
          </span>
          <select
            aria-label="Financial year"
            onChange={(event) => {
              setPicked(Number(event.target.value));
              setMonth(null);
            }}
            value={fy}
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {financialYearLabel(year)}
              </option>
            ))}
          </select>
        </div>
        {notStarted ? (
          <p className={styles.heroLine}>
            This year hasn't started. Its plan is {formatMoney(actuals.total)}.
          </p>
        ) : (
          <>
            <p className={`${ui.heroValue} ${difference > 0 ? styles.over : ''}`}>
              {formatMoney(actuals.spent)}
            </p>
            <p className={styles.heroLine}>
              spent of <strong>{formatMoney(actuals.planned)}</strong> planned
              {actuals.running ? ' by now' : ''}, out of {formatMoney(actuals.total)} for the year.
            </p>
            <div
              aria-label={`Spent ${formatMoney(actuals.spent)} of ${formatMoney(actuals.planned)} planned`}
              className={ui.meter}
              role="img"
            >
              <div
                className={difference > 0 ? ui.meterExpense : ui.meterFill}
                style={{ width: share(actuals.spent, Math.max(actuals.planned, actuals.spent)) }}
              />
            </div>
            <p className={`${styles.paceText} ${difference > 0 ? styles.over : ''}`}>
              {difference === 0 ? 'Right on plan.' : `${versus(difference)} plan.`}
            </p>
            {actuals.outside > 0 ? (
              <p className={ui.caption}>
                Plus {formatMoney(actuals.outside)} on things not in the plan, so{' '}
                {formatMoney(actuals.spent + actuals.outside)} in all.
              </p>
            ) : null}
          </>
        )}
      </section>

      {notStarted ? null : (
        <>
          <section aria-labelledby="actual-months" className={ui.card}>
            <h2 className={ui.cardTitle} id="actual-months">
              Month by month
            </h2>
            <div className={styles.legend}>
              <span>
                <i className={styles.dotPlanned} /> Planned
              </span>
              <span>
                <i className={styles.dotLeft} /> Spent
              </span>
              <span>
                <i className={styles.dotPlan} /> Spent, over plan
              </span>
            </div>
            <div className={styles.chart}>
              {actuals.months.map((row, index) => {
                const over = row.spent !== null && row.spent > row.planned;
                return (
                  <button
                    aria-label={`${formatMonth(row.month)}: planned ${formatMoney(row.planned)}${row.spent === null ? '' : `, spent ${formatMoney(row.spent)}`}`}
                    aria-pressed={month === index}
                    className={styles.column}
                    key={row.month}
                    onClick={() => setMonth(month === index ? null : index)}
                    title={formatMonth(row.month)}
                    type="button"
                  >
                    <span className={styles.pair}>
                      <span
                        className={styles.plannedBar}
                        style={{ height: share(row.planned, biggest) }}
                      />
                      {row.spent === null ? null : (
                        <span
                          className={over ? styles.spentOver : styles.spentBar}
                          style={{ height: share(row.spent, biggest) }}
                        />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            <div aria-hidden="true" className={styles.monthNames}>
              {actuals.months.map((row) => (
                <span key={row.month}>
                  {(MONTH_NAMES[Number(row.month.slice(5, 7)) - 1] ?? '').slice(0, 1)}
                </span>
              ))}
            </div>
            {chosen ? (
              <div aria-live="polite" className={styles.monthDetail}>
                <strong>{formatMonth(chosen.month)}</strong>
                <div className={styles.split}>
                  <span>Planned</span>
                  <span>{formatMoney(chosen.planned)}</span>
                </div>
                {chosen.spent === null ? (
                  <span className={ui.caption}>Still to come.</span>
                ) : (
                  <>
                    <div className={styles.split}>
                      <span>Spent on the plan</span>
                      <span>{formatMoney(chosen.spent)}</span>
                    </div>
                    <div className={styles.split}>
                      <span>Spent on other things</span>
                      <span>{formatMoney(chosen.outside ?? 0)}</span>
                    </div>
                    <span className={chosen.spent > chosen.planned ? styles.over : ui.caption}>
                      {versus(chosen.spent - chosen.planned)} plan.
                    </span>
                  </>
                )}
              </div>
            ) : (
              <p className={ui.caption}>Tap a month to compare it.</p>
            )}
          </section>

          <section aria-labelledby="actual-categories" className={ui.card}>
            <h2 className={ui.cardTitle} id="actual-categories">
              By category
            </h2>
            <p className={ui.caption}>
              {actuals.running
                ? 'What each category has spent against what the plan expected by today.'
                : 'What each category spent against its plan for the year.'}
            </p>
            <ul className={styles.actualList}>
              {actuals.categories
                .filter((row) => row.yearly > 0 || row.spent > 0)
                .map((row) => (
                  <li className={styles.actualRow} key={row.category}>
                    <div className={styles.split}>
                      <strong>{row.category}</strong>
                      <span
                        className={
                          notDue(row) ? ui.badgeMuted : row.difference > 0 ? ui.badge : ui.badgeDone
                        }
                      >
                        {notDue(row) ? 'Not due yet' : versus(row.difference)}
                      </span>
                    </div>
                    <div aria-hidden="true" className={ui.meter}>
                      <div
                        className={row.difference > 0 ? ui.meterExpense : ui.meterFill}
                        style={{ width: share(row.spent, Math.max(row.planned, row.spent)) }}
                      />
                    </div>
                    <span className={styles.lineDetail}>
                      {notDue(row)
                        ? `${formatMoney(row.yearly)} for the year`
                        : `${formatMoney(row.spent)} of ${formatMoney(row.planned)}${row.planned < row.yearly ? ` · ${formatMoney(row.yearly)} for the year` : ''}`}
                    </span>
                    {row.lines.length > 1 || row.lines[0] !== row.category ? (
                      <span className={styles.lineDetail}>For {row.lines.join(', ')}</span>
                    ) : null}
                  </li>
                ))}
            </ul>
          </section>

          {actuals.unplanned.length > 0 ? (
            <section aria-labelledby="actual-unplanned" className={ui.card}>
              <h2 className={ui.cardTitle} id="actual-unplanned">
                Not in the plan
              </h2>
              <p className={ui.caption}>
                Spending in categories no budget line counts. Add a line for any you expect every
                year.
              </p>
              <ul className={styles.upcoming}>
                {actuals.unplanned.map((row) => (
                  <li key={row.category}>
                    <span>{row.category}</span>
                    <strong>{formatMoney(row.spent)}</strong>
                  </li>
                ))}
              </ul>
              <div className={ui.actions}>
                <Link className={ui.quiet} to="/analytics/budget">
                  Edit the plan
                </Link>
              </div>
            </section>
          ) : null}

          {actuals.untracked.length > 0 ? (
            <p className={ui.caption}>
              {actuals.untracked.map((row) => row.name).join(', ')}{' '}
              {actuals.untracked.length === 1 ? "isn't" : "aren't"} compared, as{' '}
              {actuals.untracked.length === 1 ? 'it has' : 'they have'} no category to count
              spending in.
            </p>
          ) : null}
        </>
      )}
    </>
  );
}
