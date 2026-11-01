import { monthClose } from '../../domain/cashflow';
import {
  applyOccurrences,
  pendingOccurrences,
  type OccurrenceRequest,
} from '../../domain/recurring';
import { summarizeLoans, totalMonthlyEmi, totalOutstanding } from '../../domain/summary';
import { recordId, type RecordWrite, type TrackerData } from '../../data/repository';
import { useTracker } from '../../store/tracker';
import { formatMoney, formatMonth, localDate } from '../../ui/format';
import ui from '../../ui/ui.module.css';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className={ui.statLabel}>{label}</div>
      <div className={ui.statValue}>{value}</div>
    </div>
  );
}

/** The records a recurring run added, as writes. Loans are derived, so they never change. */
function newRecordWrites(before: TrackerData, after: ReturnType<typeof applyOccurrences>['data']) {
  const known = new Set([...before.income, ...before.expenses].map((row) => row.id));
  const writes: RecordWrite[] = [];
  for (const row of after.income) {
    if (!known.has(row.id))
      writes.push({ type: 'set', collection: 'income', id: row.id, value: row });
  }
  for (const row of after.expenses) {
    if (!known.has(row.id))
      writes.push({ type: 'set', collection: 'expenses', id: row.id, value: row });
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
      <h1>{formatMonth(month)}</h1>
      <section className={ui.card} aria-label="This month">
        <div className={ui.grid}>
          <Stat label="Income" value={formatMoney(close.income)} />
          <Stat label="Expenses" value={formatMoney(close.expenses)} />
          <Stat label="Net" value={formatMoney(close.income - close.expenses)} />
          <Stat label="Loans outstanding" value={formatMoney(totalOutstanding(loans))} />
          <Stat label="Monthly EMIs" value={formatMoney(totalMonthlyEmi(loans))} />
        </div>
      </section>

      <section className={ui.card}>
        <h2>Recurring items due</h2>
        {pending.length === 0 ? (
          <p className={ui.empty}>Nothing is due.</p>
        ) : (
          <ul className={ui.list}>
            {pending.map(({ ruleId, month: dueMonth, date, amount, missed }) => (
              <li className={ui.row} key={`${ruleId}-${dueMonth}`}>
                <div className={ui.rowMain}>
                  <div>{ruleName(ruleId)}</div>
                  <div className={ui.rowDetail}>
                    {missed ? 'Missed' : 'Due'} {date}
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
