import { AlertTriangle, CalendarClock, Copy, Plus, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  budgetId,
  budgetProgress,
  budgetTotal,
  fyMonths,
  lineYearly,
  nextYearBudget,
  starterBudget,
  withKids,
  type LineStatus,
} from '../../domain/budget';
import { financialYearLabel, financialYearStart } from '../../domain/calendar';
import { optionLists } from '../../domain/options';
import { BUDGET_GROUPS, budgetSchema, type Budget, type BudgetLine } from '../../schema/records';
import { useSettings, useSpendingHousehold, useTracker } from '../../store/tracker';
import { Field } from '../../ui/Field';
import { formatMoney, formatMonth, formatShortMonth, localDate } from '../../ui/format';
import { Modal } from '../../ui/Modal';
import ui from '../../ui/ui.module.css';
import { BudgetLineForm } from './BudgetLineForm';
import { GROUP_LABELS, MONTH_NAMES, scheduleText } from './budgetText';
import styles from './Budget.module.css';

const share = (part: number, whole: number) =>
  whole > 0 ? `${Math.min(100, Math.max(0, (part / whole) * 100))}%` : '0%';

function LineStatusChip({ status, dueMonth }: { status: LineStatus; dueMonth?: string }) {
  if (status.line.amount === 0) return <span className={ui.badgeMuted}>Add amount</span>;
  if (status.over > 0) return <span className={ui.badge}>{formatMoney(status.over)} over</span>;
  if (dueMonth) return <span className={ui.badge}>Due {formatShortMonth(dueMonth)}</span>;
  if (status.paid && status.paid.of > 0) {
    return (
      <span className={status.paid.done === status.paid.of ? ui.badgeDone : ui.badgeMuted}>
        Paid {status.paid.done} of {status.paid.of}
      </span>
    );
  }
  return null;
}

/**
 * Planning › Future › Yearly budget: the financial year's plan, what each month needs, how
 * spending is going against it, and what income leaves to invest. Only the plan is saved.
 */
export function BudgetPage() {
  const data = useSpendingHousehold();
  const settings = useSettings();
  const commit = useTracker((state) => state.commit);
  const today = localDate();
  const thisYear = financialYearStart(today);
  const [fy, setFy] = useState(thisYear);
  const [editing, setEditing] = useState<BudgetLine | 'new' | null>(null);
  const [month, setMonth] = useState<number | null>(null);
  const [rise, setRise] = useState('6');
  const [kidsRise, setKidsRise] = useState('10');
  const [error, setError] = useState<string | null>(null);

  const categories = optionLists(settings).expenseCategories;
  const saved = data.budgets.find((row) => row.fy === fy);
  const budget = useMemo(
    () => saved ?? starterBudget(fy, data, today, categories),
    [saved, fy, data, today, settings],
  );
  const progress = useMemo(() => budgetProgress(budget, data, today), [budget, data, today]);
  const months = fyMonths(fy);
  const years = [...new Set([thisYear, thisYear + 1, ...data.budgets.map((row) => row.fy)])].sort();
  const current = fy === thisYear;
  const next = data.budgets.find((row) => row.fy === fy + 1);

  const save = (value: Budget) => {
    const parsed = budgetSchema.safeParse({ ...value, id: budgetId(value.fy) });
    if (!parsed.success) {
      setError("The plan couldn't be saved. Check each line has a name and an amount.");
      return false;
    }
    setError(null);
    commit([{ type: 'set', collection: 'budgets', id: parsed.data.id, value: parsed.data }]);
    return true;
  };
  const saveLine = (line: BudgetLine) => {
    const exists = budget.lines.some((row) => row.id === line.id);
    const lines = exists
      ? budget.lines.map((row) => (row.id === line.id ? line : row))
      : [...budget.lines, line];
    if (save({ ...budget, lines })) setEditing(null);
  };
  const removeLine = (id: string) => {
    const lines = budget.lines.filter((row) => row.id !== id);
    const kids = id.startsWith('kid-') ? Math.max(0, budget.kids - 1) : budget.kids;
    if (save({ ...budget, kids, lines })) setEditing(null);
  };

  const dueSoon = new Map(progress.upcoming.map((row) => [row.line.id, row.month]));
  const biggest = Math.max(...progress.months.map((row) => row.planned), progress.setAside, 1);
  const heavy = progress.months.filter((row) => row.heavy);
  const chosen = month === null ? null : progress.months[month];
  const chosenLines =
    chosen === null || chosen === undefined
      ? []
      : budget.lines
          .map((line) => ({
            line,
            amount:
              line.every === 'month'
                ? line.amount
                : line.months.includes(Number(chosen.month.slice(5, 7)))
                  ? line.amount
                  : 0,
          }))
          .filter((row) => row.amount > 0)
          .sort((a, b) => b.amount - a.amount);
  const pace = progress.spent - progress.due;

  return (
    <>
      <section aria-labelledby="budget-total" className={ui.hero}>
        <div className={styles.heroTop}>
          <span className={ui.eyebrow} id="budget-total">
            Planned for {financialYearLabel(fy)}
          </span>
          <select
            aria-label="Financial year"
            onChange={(event) => {
              setFy(Number(event.target.value));
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
        <p className={ui.heroValue}>{formatMoney(progress.total)}</p>
        <p className={styles.heroLine}>
          Set aside <strong>{formatMoney(progress.setAside)}</strong> a month to cover it.
        </p>
        {current || fy < thisYear ? (
          <>
            <div className={styles.pace}>
              <div
                aria-label={`Spent ${formatMoney(progress.spent)} of ${formatMoney(progress.total)}`}
                className={ui.meter}
                role="img"
              >
                <div
                  className={ui.meterFill}
                  style={{ width: share(progress.spent, progress.total) }}
                />
              </div>
              {current ? (
                <span
                  aria-hidden="true"
                  className={styles.paceMark}
                  style={{ left: share(progress.due, progress.total) }}
                />
              ) : null}
            </div>
            <div className={ui.meterLegend}>
              <span>Spent {formatMoney(progress.spent)}</span>
              {current ? <span>Due by now {formatMoney(progress.due)}</span> : null}
            </div>
            {current && progress.due > 0 ? (
              <p className={`${styles.paceText} ${pace > 0 ? styles.over : ''}`}>
                {pace > 0
                  ? `${formatMoney(pace)} ahead of plan so far.`
                  : pace < 0
                    ? `${formatMoney(-pace)} under plan so far.`
                    : 'Right on plan so far.'}
              </p>
            ) : null}
          </>
        ) : null}
      </section>

      {error ? (
        <p className={ui.notice} role="alert">
          {error}
        </p>
      ) : null}

      {saved ? null : (
        <section className={ui.card}>
          <div className={ui.cardHeader}>
            <h2 className={ui.cardTitle}>
              <Sparkles aria-hidden="true" size={18} /> A plan to start from
            </h2>
          </div>
          <p className={ui.caption}>
            Amounts come from your last twelve months of spending, where a category belongs to one
            line. Change anything below, or keep it as it is.
          </p>
          <div className={ui.actions}>
            <button className={ui.button} onClick={() => save(budget)} type="button">
              Save this plan
            </button>
          </div>
        </section>
      )}

      {progress.upcoming.length > 0 ? (
        <section aria-labelledby="budget-soon" className={ui.card}>
          <h2 className={ui.cardTitle} id="budget-soon">
            <CalendarClock aria-hidden="true" size={18} /> Due soon
          </h2>
          <ul className={styles.upcoming}>
            {progress.upcoming.map((row) => (
              <li key={`${row.line.id}-${row.month}`}>
                <span>
                  {row.line.name}, {formatMonth(row.month)}
                </span>
                <strong>{formatMoney(row.amount)}</strong>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className={ui.columns}>
        <section aria-labelledby="budget-months" className={ui.card}>
          <h2 className={ui.cardTitle} id="budget-months">
            Month by month
          </h2>
          <p className={ui.caption}>
            {heavy.length > 0
              ? `${heavy.length === 1 ? 'One month needs' : `${heavy.length} months need`} more than the ${formatMoney(progress.setAside)} you set aside. Tap a month to see why.`
              : `Every month fits in the ${formatMoney(progress.setAside)} you set aside.`}
          </p>
          <div className={styles.chart}>
            <span
              aria-hidden="true"
              className={styles.setAside}
              style={{ bottom: share(progress.setAside, biggest) }}
            />
            {progress.months.map((row, index) => (
              <button
                aria-label={`${formatMonth(row.month)}: ${formatMoney(row.planned)}${row.heavy ? ', a heavy month' : ''}`}
                aria-pressed={month === index}
                className={`${styles.column} ${row.heavy ? styles.heavy : ''}`}
                key={row.month}
                onClick={() => setMonth(month === index ? null : index)}
                title={`${formatMonth(row.month)}: ${formatMoney(row.planned)}`}
                type="button"
              >
                <span className={styles.bar} style={{ height: share(row.planned, biggest) }} />
              </button>
            ))}
          </div>
          <div aria-hidden="true" className={styles.monthNames}>
            {months.map((key) => (
              <span key={key}>{(MONTH_NAMES[Number(key.slice(5, 7)) - 1] ?? '').slice(0, 1)}</span>
            ))}
          </div>
          {chosen ? (
            <div aria-live="polite" className={styles.monthDetail}>
              <div className={styles.split}>
                <strong>{formatMonth(chosen.month)}</strong>
                <strong>{formatMoney(chosen.planned)}</strong>
              </div>
              {chosen.heavy ? (
                <span className={styles.over}>
                  <AlertTriangle aria-hidden="true" size={14} />{' '}
                  {formatMoney(chosen.planned - progress.setAside)} more than you set aside.
                </span>
              ) : null}
              <ul>
                {chosenLines.map(({ line, amount }) => (
                  <li key={line.id}>
                    <span>{line.name}</span>
                    <span>{formatMoney(amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section aria-labelledby="budget-left" className={ui.card}>
          <h2 className={ui.cardTitle} id="budget-left">
            Left to invest
          </h2>
          <p className={`${ui.heroValue} ${progress.left < 0 ? styles.over : ''}`}>
            {formatMoney(progress.left)}
          </p>
          <div className={styles.monthDetail}>
            <div className={styles.split}>
              <span>Income this year</span>
              <span>{formatMoney(progress.income)}</span>
            </div>
            <div className={styles.split}>
              <span>Planned spending</span>
              <span>−{formatMoney(progress.total)}</span>
            </div>
            <div className={styles.split}>
              <span>EMIs</span>
              <span>−{formatMoney(progress.emis)}</span>
            </div>
          </div>
          <p className={ui.caption}>
            {progress.left < 0
              ? 'The plan and EMIs come to more than the income expected this year.'
              : `About ${formatMoney(progress.left / 12)} a month. Income counts what's recorded so far, then your usual for each month left.`}
          </p>
          {progress.outside > 0 ? (
            <p className={ui.caption}>
              {formatMoney(progress.outside)} spent this year in categories no line counts.
            </p>
          ) : null}
        </section>
      </div>

      <section aria-labelledby="budget-lines" className={ui.card}>
        <div className={ui.cardHeader}>
          <h2 className={ui.cardTitle} id="budget-lines">
            The plan
          </h2>
          <button className={ui.quiet} onClick={() => setEditing('new')} type="button">
            <Plus aria-hidden="true" size={16} /> Add
          </button>
        </div>
        <div className={styles.kids}>
          <span className={ui.label}>Kids in school</span>
          <div aria-label="Kids in school" className={styles.segmentedSmall} role="radiogroup">
            {[0, 1, 2, 3, 4].map((count) => (
              <button
                aria-checked={budget.kids === count}
                className={budget.kids === count ? ui.segmentActive : ui.segment}
                key={count}
                onClick={() => save(withKids(budget, count, categories))}
                role="radio"
                type="button"
              >
                {count}
              </button>
            ))}
          </div>
        </div>
        {BUDGET_GROUPS.map((group) => {
          const rows = progress.lines.filter((row) => row.line.group === group);
          if (rows.length === 0) return null;
          const total = rows.reduce((sum, row) => sum + row.yearly, 0);
          return (
            <div className={styles.group} key={group}>
              <h3 className={styles.groupHead}>
                <span>{GROUP_LABELS[group]}</span>
                <span>{formatMoney(total)}</span>
              </h3>
              {rows.map((row) => {
                const due = dueSoon.get(row.line.id);
                return (
                  <button
                    className={styles.line}
                    key={row.line.id}
                    onClick={() => setEditing(row.line)}
                    type="button"
                  >
                    <span className={styles.lineName}>{row.line.name}</span>
                    <span className={styles.lineAmount}>
                      {formatMoney(row.line.amount)}
                      {row.line.every === 'month' ? ' a month' : ''}
                    </span>
                    <span className={styles.lineDetail}>
                      {scheduleText(row.line)}
                      <LineStatusChip status={row} {...(due ? { dueMonth: due } : {})} />
                    </span>
                    <span className={styles.lineYearly}>
                      {row.line.every === 'month' || row.line.months.length > 1
                        ? `${formatMoney(lineYearly(row.line))} a year`
                        : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </section>

      {saved ? (
        <section aria-labelledby="budget-next" className={ui.card}>
          <h2 className={ui.cardTitle} id="budget-next">
            <Copy aria-hidden="true" size={18} /> Plan {financialYearLabel(fy + 1)}
          </h2>
          {next ? (
            <>
              <p className={ui.caption}>
                {financialYearLabel(fy + 1)} already has a plan of {formatMoney(budgetTotal(next))}.
              </p>
              <div className={ui.actions}>
                <button className={ui.quiet} onClick={() => setFy(fy + 1)} type="button">
                  Open it
                </button>
              </div>
            </>
          ) : (
            <>
              <p className={ui.caption}>Start next year from this plan, with prices up a little.</p>
              <div className={styles.rises}>
                <Field label="Prices up by (%)">
                  <input
                    inputMode="decimal"
                    min="0"
                    onChange={(event) => setRise(event.target.value)}
                    type="number"
                    value={rise}
                  />
                </Field>
                <Field label="School fees up by (%)">
                  <input
                    inputMode="decimal"
                    min="0"
                    onChange={(event) => setKidsRise(event.target.value)}
                    type="number"
                    value={kidsRise}
                  />
                </Field>
              </div>
              <div className={ui.actions}>
                <button
                  className={ui.button}
                  onClick={() => {
                    if (save(nextYearBudget(budget, Number(rise) || 0, Number(kidsRise) || 0))) {
                      setFy(fy + 1);
                      setMonth(null);
                    }
                  }}
                  type="button"
                >
                  Create {financialYearLabel(fy + 1)} plan
                </button>
              </div>
            </>
          )}
        </section>
      ) : null}

      {editing ? (
        <Modal
          fullScreenOnPhone
          onClose={() => setEditing(null)}
          title={editing === 'new' ? 'Add to the plan' : `Edit ${editing.name}`}
        >
          <BudgetLineForm
            categories={categories}
            {...(editing === 'new'
              ? {}
              : { line: editing, onRemove: () => removeLine(editing.id) })}
            onCancel={() => setEditing(null)}
            onSave={saveLine}
          />
        </Modal>
      ) : null}
    </>
  );
}
