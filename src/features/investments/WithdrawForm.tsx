import { useState } from 'react';
import { holdingValue, withdrawalLedger } from '../../domain/holdings';
import type { Holding, Valuation, Withdrawal } from '../../schema/records';
import { useTracker } from '../../store/tracker';
import { Field } from '../../ui/Field';
import { formatMoney, formatPercent, localDate } from '../../ui/format';
import ui from '../../ui/ui.module.css';

const DRAFT = 'draft';

/** Money taken out, with the value left after it, read off the statement. */
export function WithdrawForm({ holding, onDone }: { holding: Holding; onDone: () => void }) {
  const data = useTracker((state) => state.data);
  const commit = useTracker((state) => state.commit);
  const today = localDate();
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState('');
  const [after, setAfter] = useState('');
  const [afterEdited, setAfterEdited] = useState(false);

  const taken = Number(amount);
  const before = date >= holding.date ? holdingValue(holding, data, date) : 0;
  const left = afterEdited ? after : amount === '' ? '' : String(Math.max(0, before - taken));
  const remaining = Number(left);
  const error =
    date === '' || date > today
      ? 'Enter a date up to today.'
      : date < holding.date
        ? 'Enter a date on or after this investment started.'
        : amount !== '' && !(taken > 0)
          ? 'Enter an amount above zero.'
          : left !== '' && !(remaining >= 0)
            ? 'Enter the value left, zero or more.'
            : null;
  const ready = !error && amount !== '' && left !== '';

  const withdrawal: Withdrawal = {
    id: DRAFT,
    holdingId: holding.id,
    date,
    amount: taken,
    valuationId: DRAFT,
  };
  const valuation: Valuation = { id: DRAFT, holdingId: holding.id, date, value: remaining };
  const entry = ready
    ? withdrawalLedger(
        holding,
        {
          ...data,
          valuations: [...data.valuations, valuation],
          withdrawals: [...data.withdrawals, withdrawal],
        },
        date,
      ).entries.find((row) => row.id === DRAFT)
    : undefined;
  const invested = entry ? withdrawalLedger(holding, data, date).invested : 0;

  return (
    <form
      className={ui.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready) return;
        const id = crypto.randomUUID();
        const valuationId = crypto.randomUUID();
        commit([
          {
            type: 'set',
            collection: 'valuations',
            id: valuationId,
            value: { ...valuation, id: valuationId },
          },
          {
            type: 'set',
            collection: 'withdrawals',
            id,
            value: { ...withdrawal, id, valuationId },
          },
        ]);
        onDone();
      }}
    >
      <Field label="Date">
        <input
          max={today}
          onChange={(event) => setDate(event.target.value)}
          type="date"
          value={date}
        />
      </Field>
      <Field label="Amount withdrawn (₹)">
        <input
          inputMode="decimal"
          onChange={(event) => setAmount(event.target.value)}
          step="0.01"
          type="number"
          value={amount}
        />
      </Field>
      <Field label="Value left after (₹, from your statement)">
        <input
          inputMode="decimal"
          onChange={(event) => {
            setAfterEdited(true);
            setAfter(event.target.value);
          }}
          step="0.01"
          type="number"
          value={left}
        />
      </Field>
      {error && (amount !== '' || date !== today) ? (
        <p className={`${ui.fieldError} ${ui.formWide}`} role="alert">
          {error}
        </p>
      ) : null}
      {entry ? (
        <div className={ui.formWide}>
          <dl className={ui.detailList}>
            <div>
              <dt>Value before</dt>
              <dd>
                {formatMoney(entry.amount)} + {formatMoney(remaining)} ={' '}
                {formatMoney(entry.amount + remaining)}
              </dd>
            </div>
            <div>
              <dt>Share sold</dt>
              <dd>{formatPercent(entry.amount / (entry.amount + remaining || 1))}</dd>
            </div>
            <div>
              <dt>Cost of what was sold</dt>
              <dd>{formatMoney(entry.cost)}</dd>
            </div>
            <div>
              <dt>Booked profit</dt>
              <dd className={entry.profit < 0 ? ui.loss : ui.gain}>{formatMoney(entry.profit)}</dd>
            </div>
            <div>
              <dt>Still invested</dt>
              <dd>
                {formatMoney(invested)} − {formatMoney(entry.cost)} ={' '}
                {formatMoney(invested - entry.cost)}
              </dd>
            </div>
          </dl>
          <p className={ui.caption}>
            The amount invested goes down by the same share as the value, and the rest of what you
            received is booked profit.
          </p>
        </div>
      ) : null}
      <div className={ui.formActions}>
        <button className={ui.button} disabled={!ready} type="submit">
          Save withdrawal
        </button>
      </div>
    </form>
  );
}
