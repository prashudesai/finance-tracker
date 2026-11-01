import { useState } from 'react';
import { closeMonth } from '../../domain/analytics';
import { nextMonth } from '../../domain/calendar';
import { recordId } from '../../data/repository';
import { useTracker } from '../../store/tracker';
import { Field } from '../../ui/Field';
import { formatMoney, formatMonth } from '../../ui/format';
import { Modal } from '../../ui/Modal';
import ui from '../../ui/ui.module.css';

function BalanceForm({ month, onDone }: { month: string; onDone: () => void }) {
  const commit = useTracker((state) => state.commit);
  const balances = useTracker((state) => state.data.monthlyBalances);
  const existing = balances.find((row) => row.month === month);
  const [selected, setSelected] = useState(month);
  const [amount, setAmount] = useState(existing ? String(existing.startBalance) : '');
  const value = Number(amount);
  const valid = amount !== '' && Number.isFinite(value);

  return (
    <form
      className={ui.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid) return;
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
      <Field label="Month">
        <input
          onChange={(event) => setSelected(event.target.value)}
          type="month"
          value={selected}
        />
      </Field>
      <Field label="Bank balance at start of month (₹)">
        <input
          inputMode="decimal"
          onChange={(event) => setAmount(event.target.value)}
          type="number"
          value={amount}
        />
      </Field>
      <div className={ui.formActions}>
        <button className={ui.button} disabled={!valid} type="submit">
          Save balance
        </button>
      </div>
    </form>
  );
}

export function MonthlyBalances({ month }: { month: string }) {
  const data = useTracker((state) => state.data);
  const commit = useTracker((state) => state.commit);
  const [setting, setSetting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const close = closeMonth(data, month);
  const rows = [...data.monthlyBalances].sort((a, b) => b.month.localeCompare(a.month));

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
          <div className={ui.label}>Next month's opening</div>
          <div className={ui.metricValue}>
            {close.closing === null ? 'Not set' : formatMoney(close.closing)}
          </div>
          <div className={ui.caption}>{formatMonth(nextMonth(month))}</div>
        </div>
        <div className={ui.metric}>
          <div className={ui.label}>House expense</div>
          <div className={ui.metricValue}>
            {close.unrecorded === null ? 'Pending' : formatMoney(close.unrecorded)}
          </div>
          <div className={ui.caption}>Spending not recorded as expenses</div>
        </div>
      </div>
      {setting ? (
        <Modal onClose={() => setSetting(false)} title="Set bank balance">
          <BalanceForm month={month} onDone={() => setSetting(false)} />
        </Modal>
      ) : null}
      {showHistory ? (
        <Modal onClose={() => setShowHistory(false)} title="Balance history">
          {rows.length === 0 ? (
            <p className={ui.empty}>No balances recorded yet.</p>
          ) : (
            <ul className={ui.list}>
              {rows.map((row) => (
                <li className={ui.row} key={row.month}>
                  <div className={ui.rowMain}>{formatMonth(row.month)}</div>
                  <span className={ui.amount}>{formatMoney(row.startBalance)}</span>
                  <button
                    aria-label={`Delete ${formatMonth(row.month)}`}
                    className={ui.quiet}
                    onClick={() =>
                      commit([{ type: 'delete', collection: 'monthlyBalances', id: row.month }])
                    }
                    type="button"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      ) : null}
    </section>
  );
}
