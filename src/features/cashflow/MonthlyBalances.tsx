import { useMemo, useState } from 'react';
import {
  balanceHistory,
  balanceYears,
  closeMonth,
  type BalanceHistoryRow,
} from '../../domain/analytics';
import { financialYearLabel, financialYearStart, nextMonth } from '../../domain/calendar';
import { recordId } from '../../data/repository';
import { useTracker } from '../../store/tracker';
import { Field } from '../../ui/Field';
import { formatMoney, formatMonth, localDate } from '../../ui/format';
import { Modal } from '../../ui/Modal';
import ui from '../../ui/ui.module.css';
import { SortHeader, useSort, type SortValue } from '../../ui/useSort';

/** With `closing`, the amount is that month's closing balance, which opens the next month. */
export function BalanceForm({
  month,
  closing = false,
  onDone,
}: {
  month: string;
  closing?: boolean;
  onDone: () => void;
}) {
  const commit = useTracker((state) => state.commit);
  const balances = useTracker((state) => state.data.monthlyBalances);
  const startingBalance = (key: string) => balances.find((row) => row.month === key)?.startBalance;
  const target = closing ? nextMonth(month) : month;
  const opening = startingBalance(target);
  const [selected, setSelected] = useState(target);
  const [amount, setAmount] = useState(opening === undefined ? '' : String(opening));
  const value = Number(amount);
  const valid = amount !== '' && Number.isFinite(value) && value >= 0;

  return (
    <form
      className={ui.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid) return;
        if (
          startingBalance(selected) !== undefined &&
          !window.confirm(
            `A bank balance already exists for ${formatMonth(selected)}. Update the same record?`,
          )
        ) {
          return;
        }
        const row = { month: selected, startBalance: value };
        commit([
          {
            type: 'set',
            collection: 'monthlyBalances',
            id: recordId.monthlyBalance(row),
            value: row,
          },
        ]);
        onDone();
      }}
    >
      {closing ? null : (
        <Field label="Month">
          <input
            onChange={(event) => {
              const existing = startingBalance(event.target.value);
              setSelected(event.target.value);
              setAmount(existing === undefined ? '' : String(existing));
            }}
            type="month"
            value={selected}
          />
        </Field>
      )}
      <Field
        error={amount !== '' && !valid ? 'Enter a bank balance of zero or more.' : undefined}
        label={
          closing
            ? `Bank balance at the end of ${formatMonth(month)} (₹)`
            : 'Bank balance at start of selected month (₹)'
        }
      >
        <input
          inputMode="decimal"
          min="0"
          onChange={(event) => setAmount(event.target.value)}
          placeholder="50000"
          type="number"
          value={amount}
        />
      </Field>
      <div className={ui.formActions}>
        <button className={ui.button} disabled={!valid} type="submit">
          {closing ? 'Save closing balance' : 'Save opening balance'}
        </button>
      </div>
      {closing ? (
        <p className={ui.caption}>This also becomes {formatMonth(target)}'s opening balance.</p>
      ) : null}
      <details className={ui.fold}>
        <summary>How is the monthly balance calculated?</summary>
        <div className={ui.caption}>
          <p>
            Calculated balance = opening balance + recorded income − recorded expenses − Stallion
            PMS contributions.
          </p>
          <p>NPS, PPF and PF contributions are tracked separately and aren't deducted here.</p>
          <p>
            Enter a bank balance once, at the start of a month. It's also the previous month's
            closing balance: November 1 opening is October 31 closing. When you first start, older
            months don't need an opening balance. Don't enter the same expenses twice.
          </p>
        </div>
      </details>
    </form>
  );
}

const NEGATIVE_NOTE = 'Negative difference: review balances or missing income.';

type HistoryColumn = keyof BalanceHistoryRow;

const historyValue = (row: BalanceHistoryRow, column: HistoryColumn): SortValue =>
  row[column] ?? Number.NEGATIVE_INFINITY;

const MONEY_COLUMNS: { column: HistoryColumn; label: string }[] = [
  { column: 'opening', label: 'Opening balance' },
  { column: 'income', label: 'Monthly income' },
  { column: 'expenses', label: 'Expenses' },
  { column: 'pms', label: 'Stallion PMS' },
  { column: 'retirement', label: 'NPS + PPF' },
  { column: 'surplus', label: 'Surplus balance' },
];

function BalanceHistory() {
  const data = useTracker((state) => state.data);
  const commit = useTracker((state) => state.commit);
  const today = localDate();
  const [year, setYear] = useState(financialYearStart(today));
  const rows = useMemo(() => balanceHistory(data, year, today), [data, year, today]);
  const { sorted, sort, toggle } = useSort(rows, historyValue);

  return (
    <div className={ui.page}>
      <Field label="Financial year">
        <select onChange={(event) => setYear(Number(event.target.value))} value={year}>
          {balanceYears(data, today).map((option) => (
            <option key={option} value={option}>
              {financialYearLabel(option)}
            </option>
          ))}
        </select>
      </Field>
      <p className={ui.caption}>Completed months only. Current and future months are hidden.</p>
      {sorted.length === 0 ? (
        <p className={ui.empty}>No completed monthly records for this financial year.</p>
      ) : (
        <div className={ui.tableWrap}>
          <table className={`${ui.table} ${ui.stackTable}`}>
            <thead>
              <tr>
                <SortHeader column="month" label="Month" onSort={toggle} sort={sort} />
                {MONEY_COLUMNS.map(({ column, label }) => (
                  <SortHeader
                    column={column}
                    key={column}
                    label={label}
                    numeric
                    onSort={toggle}
                    sort={sort}
                  />
                ))}
                <SortHeader
                  column="houseExpense"
                  label="House expense"
                  numeric
                  onSort={toggle}
                  sort={sort}
                />
                <th scope="col">
                  <span className={ui.visuallyHidden}>Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.month}>
                  <td>
                    <strong>{formatMonth(row.month)}</strong>
                  </td>
                  {MONEY_COLUMNS.map(({ column, label }) => (
                    <td className={ui.numeric} data-label={label} key={column}>
                      {formatMoney(row[column] as number)}
                    </td>
                  ))}
                  <td className={ui.numeric} data-label="House expense">
                    <span>
                      {row.houseExpense === null
                        ? "Awaiting next month's opening balance"
                        : formatMoney(row.houseExpense)}
                      {row.houseExpense !== null && row.houseExpense < 0 ? (
                        <span className={ui.caption} style={{ display: 'block' }}>
                          {NEGATIVE_NOTE}
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td>
                    <button
                      aria-label={`Delete opening balance for ${formatMonth(row.month)}`}
                      className={ui.quiet}
                      onClick={() => {
                        if (window.confirm(`Delete the balance for ${formatMonth(row.month)}?`)) {
                          commit([
                            { type: 'delete', collection: 'monthlyBalances', id: row.month },
                          ]);
                        }
                      }}
                      type="button"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function MonthlyBalances({ month }: { month: string }) {
  const data = useTracker((state) => state.data);
  const [setting, setSetting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const close = closeMonth(data, month);

  return (
    <section className={ui.card}>
      <div className={ui.cardHeader} style={{ flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '1.3rem' }}>Monthly balances</h2>
        <div className={ui.actions}>
          <button className={ui.quiet} onClick={() => setShowHistory(true)} type="button">
            View balance history
          </button>
          <button className={ui.button} onClick={() => setSetting(true)} type="button">
            + Set bank balance
          </button>
        </div>
      </div>
      <div className={ui.metrics}>
        <div className={ui.metric}>
          <div className={ui.label}>Opening balance</div>
          <div className={ui.metricValue}>
            {close.opening === null ? 'Not set' : formatMoney(close.opening)}
          </div>
        </div>
        <div className={ui.metric}>
          <div className={ui.label}>Closing balance</div>
          <div className={ui.metricValue}>
            {close.closing === null ? 'At month end' : formatMoney(close.closing)}
          </div>
          <div className={ui.caption}>Also {formatMonth(nextMonth(month))}'s opening</div>
        </div>
        <div className={ui.metric}>
          <div className={ui.label}>House expense</div>
          <div className={ui.metricValue}>
            {close.unrecorded === null ? 'Pending' : formatMoney(close.unrecorded)}
          </div>
          <div className={ui.caption}>
            {close.unrecorded !== null && close.unrecorded < 0
              ? NEGATIVE_NOTE
              : 'Spending not recorded as expenses'}
          </div>
        </div>
      </div>
      {setting ? (
        <Modal onClose={() => setSetting(false)} title="Set bank balance">
          <BalanceForm month={month} onDone={() => setSetting(false)} />
        </Modal>
      ) : null}
      {showHistory ? (
        <Modal onClose={() => setShowHistory(false)} title="Balance history" wide>
          <BalanceHistory />
        </Modal>
      ) : null}
    </section>
  );
}
