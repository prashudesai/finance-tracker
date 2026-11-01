import { ArrowDownLeft, ArrowUpRight, CalendarClock, Landmark } from 'lucide-react';
import { monthClose, monthlyTrend, topCategories } from '../../domain/cashflow';
import {
  applyOccurrences,
  pendingOccurrences,
  type OccurrenceRequest,
} from '../../domain/recurring';
import { summarizeLoans, totalMonthlyEmi, totalOutstanding } from '../../domain/summary';
import { recordId, type RecordWrite, type TrackerData } from '../../data/repository';
import { useTracker } from '../../store/tracker';
import { formatDay, formatMoney, formatMonth, localDate } from '../../ui/format';
import { PageHeader } from '../../ui/PageHeader';
import { Stat } from '../../ui/Stat';
import ui from '../../ui/ui.module.css';
import { TrendChart } from './TrendChart';

const TREND_MONTHS = 6;
const TOP_CATEGORIES = 5;

/** The records a recurring run added, as writes. Loans are derived, so they never change. */
function newRecordWrites(before: TrackerData, after: ReturnType<typeof applyOccurrences>['data']) {
  const known = new Set([...before.income, ...before.expenses].map((row) => row.id));
  const writes: RecordWrite[] = [];
  for (const row of after.income) {
    if (!known.has(row.id)) {
      writes.push({ type: 'set', collection: 'income', id: row.id, value: row });
    }
  }
  for (const row of after.expenses) {
    if (!known.has(row.id)) {
      writes.push({ type: 'set', collection: 'expenses', id: row.id, value: row });
    }
  }
  for (const row of after.occurrences.slice(before.recurringOccurrences.length)) {
    writes.push({
      type: 'set',
      collection: 'recurringOccurrences',
      id: recordId.occurrence(row),
      value: row,
    });
  }
  return writes;
}

export function Dashboard() {
  const data = useTracker((state) => state.data);
  const commit = useTracker((state) => state.commit);
  const report = useTracker((state) => state.report);
  const today = localDate();
  const month = today.slice(0, 7);

  const close = monthClose(data, month);
  const loans = summarizeLoans(data, today);
  const left = close.income - close.expenses;
  const spentShare = close.income > 0 ? Math.min(1, close.expenses / close.income) : 0;
  const categories = topCategories(data.expenses, month, TOP_CATEGORIES);
  const largestCategory = categories[0]?.amount ?? 1;

  const recurring = {
    rules: data.recurringRules,
    occurrences: data.recurringOccurrences,
    income: data.income,
    expenses: data.expenses,
    loans: data.loans,
  };
  const pending = pendingOccurrences(recurring, today);
  const ruleName = (id: string) => data.recurringRules.find((rule) => rule.id === id)?.name ?? id;

  const run = (request: OccurrenceRequest) => {
    const result = applyOccurrences(recurring, [request], today);
    const writes = newRecordWrites(data, result.data);
    if (writes.length > 0) commit(writes);
    if (result.errors.length > 0) report(result.errors.join(' '));
  };

  return (
    <div className={ui.page}>
      <PageHeader eyebrow={formatMonth(month)} title="Dashboard" />

      <section aria-label="This month" className={ui.page}>
        <div className={ui.hero}>
          <div>
            <div className={ui.statLabel}>Left this month</div>
            <p className={ui.heroValue}>{formatMoney(left)}</p>
          </div>
          <div className={ui.meter}>
            <span className={ui.meterExpense} style={{ width: `${spentShare * 100}%` }} />
          </div>
          <div className={ui.meterLegend}>
            <span>{Math.round(spentShare * 100)}% of income spent</span>
            <span>
              {pending.length === 0
                ? 'Nothing due'
                : `${pending.length} recurring ${pending.length === 1 ? 'item' : 'items'} due`}
            </span>
          </div>
        </div>
        <div className={ui.tiles}>
          <Stat icon={ArrowDownLeft} label="Income" value={formatMoney(close.income)} />
          <Stat icon={ArrowUpRight} label="Expenses" value={formatMoney(close.expenses)} />
          <Stat
            icon={Landmark}
            label="Loans outstanding"
            value={formatMoney(totalOutstanding(loans))}
          />
          <Stat
            icon={CalendarClock}
            label="Monthly EMIs"
            value={formatMoney(totalMonthlyEmi(loans))}
          />
        </div>
      </section>

      <div className={ui.columns}>
        <section className={ui.card}>
          <h2>Last {TREND_MONTHS} months</h2>
          <TrendChart months={monthlyTrend(data, month, TREND_MONTHS)} />
        </section>

        <section className={ui.card}>
          <h2>Where the money went</h2>
          {categories.length === 0 ? (
            <p className={ui.empty}>No expenses recorded this month.</p>
          ) : (
            <ul className={ui.list}>
              {categories.map(({ category, amount }) => (
                <li className={ui.row} key={category}>
                  <div className={ui.rowMain}>
                    <div className={ui.meterLegend}>
                      <span className={ui.rowTitle}>{category}</span>
                      <span className={ui.amount}>{formatMoney(amount)}</span>
                    </div>
                    <div className={ui.meter} style={{ height: 6, marginTop: 6 }}>
                      <span
                        className={ui.meterFill}
                        style={{ width: `${(amount / largestCategory) * 100}%` }}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className={ui.card}>
        <h2>Recurring items due</h2>
        {pending.length === 0 ? (
          <p className={ui.empty}>Nothing is due.</p>
        ) : (
          <ul className={ui.list}>
            {pending.map(({ ruleId, month: dueMonth, date, amount, missed }) => (
              <li className={ui.row} key={`${ruleId}-${dueMonth}`}>
                <div className={ui.rowMain}>
                  <div className={ui.rowTitle}>{ruleName(ruleId)}</div>
                  <div className={ui.rowDetail}>
                    {missed ? 'Missed' : 'Due'} {formatDay(date)}
                    {amount === undefined ? '' : ` · ${formatMoney(amount)}`}
                  </div>
                </div>
                <div className={ui.actions}>
                  <button
                    className={ui.button}
                    onClick={() => run({ ruleId, month: dueMonth })}
                    type="button"
                  >
                    Post
                  </button>
                  <button
                    className={ui.quiet}
                    onClick={() => run({ ruleId, month: dueMonth, skip: true })}
                    type="button"
                  >
                    Skip
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
