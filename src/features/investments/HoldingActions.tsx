import { ArrowDownToLine, History, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { CategoryRow, PositionRow } from '../../domain/analytics';
import type { RecordWrite } from '../../data/repository';
import { returnMeasure } from '../../domain/holdings';
import { useSettings, useTracker } from '../../store/tracker';
import { Field } from '../../ui/Field';
import { formatMoney, formatPercent, localDate, signedMoney } from '../../ui/format';
import { Modal } from '../../ui/Modal';
import { Metric } from '../../ui/Stat';
import ui from '../../ui/ui.module.css';
import { HoldingForm } from './HoldingForm';
import { HoldingHistory } from './HoldingHistory';
import { WithdrawForm } from './WithdrawForm';

type Action = 'value' | 'contribution' | 'withdraw' | 'history' | 'edit';

function AmountForm({
  label,
  button,
  initial,
  onSave,
}: {
  label: string;
  button: string;
  initial?: number;
  onSave: (date: string, amount: number) => void;
}) {
  const [date, setDate] = useState(localDate());
  const [amount, setAmount] = useState(initial === undefined ? '' : String(initial));
  const value = Number(amount);
  const valid = amount !== '' && Number.isFinite(value) && value >= 0 && date !== '';
  return (
    <form
      className={ui.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) onSave(date, value);
      }}
    >
      <Field label="Date">
        <input
          max={localDate()}
          onChange={(event) => setDate(event.target.value)}
          type="date"
          value={date}
        />
      </Field>
      <Field label={label}>
        <input
          inputMode="decimal"
          onChange={(event) => setAmount(event.target.value)}
          type="number"
          value={amount}
        />
      </Field>
      <div className={ui.formActions}>
        <button className={ui.button} disabled={!valid} type="submit">
          {button}
        </button>
      </div>
    </form>
  );
}

function HoldingCard({ row }: { row: PositionRow }) {
  const data = useTracker((state) => state.data);
  const commit = useTracker((state) => state.commit);
  const [action, setAction] = useState<Action | null>(null);
  const { holding, position } = row;
  const settings = useSettings();
  const measure = returnMeasure(holding, settings);
  const close = () => setAction(null);
  const hasWithdrawals = data.withdrawals.some((item) => item.holdingId === holding.id);
  const closed = hasWithdrawals && position.current === 0;

  const remove = () => {
    if (!window.confirm(`Delete ${holding.name} and all its history?`)) return;
    const writes: RecordWrite[] = [
      { type: 'delete', collection: 'holdings', id: holding.id },
      ...data.contributions
        .filter((item) => item.holdingId === holding.id)
        .map((item): RecordWrite => ({ type: 'delete', collection: 'contributions', id: item.id })),
      ...data.valuations
        .filter((item) => item.holdingId === holding.id)
        .map((item): RecordWrite => ({ type: 'delete', collection: 'valuations', id: item.id })),
      ...data.withdrawals
        .filter((item) => item.holdingId === holding.id)
        .map((item): RecordWrite => ({ type: 'delete', collection: 'withdrawals', id: item.id })),
      ...data.interestCredits
        .filter((item) => item.holdingId === holding.id)
        .map((item): RecordWrite => ({
          type: 'delete',
          collection: 'interestCredits',
          id: item.id,
        })),
      ...data.epsUpdates
        .filter((item) => item.holdingId === holding.id)
        .map((item): RecordWrite => ({ type: 'delete', collection: 'epsUpdates', id: item.id })),
    ];
    commit(writes);
  };

  return (
    <li className={ui.loan}>
      <div className={ui.loanTop}>
        <div className={ui.rowMain}>
          <div className={ui.rowTitle}>{holding.name}</div>
          <div className={ui.rowDetail}>
            {holding.member}
            {closed ? ' · Closed' : ''}
            {holding.rate === undefined ? '' : ` · ${holding.rate}% a year`}
            {holding.uan ? ` · UAN ${holding.uan}` : ''}
            {holding.scheme ? ` · ${holding.scheme}` : ''}
            {holding.kind === 'pf'
              ? ` · Employee ${formatMoney(holding.employee ?? 0)} · Employer ${formatMoney(holding.employer ?? 0)}`
              : ''}
          </div>
        </div>
        <div className={ui.iconActions}>
          <button
            aria-label={`Update value of ${holding.name}`}
            className={ui.labelledIcon}
            onClick={() => setAction('value')}
            type="button"
            data-tip="Update value"
          >
            <RefreshCw size={14} />
            <span>Update</span>
          </button>
          <button
            aria-label={`Add contribution to ${holding.name}`}
            className={ui.labelledIcon}
            onClick={() => setAction('contribution')}
            type="button"
            data-tip="Add contribution"
          >
            <Plus size={14} />
            <span>Add</span>
          </button>
          <button
            aria-label={`Withdraw from ${holding.name}`}
            className={ui.labelledIcon}
            onClick={() => setAction('withdraw')}
            type="button"
            data-tip="Withdraw or book profit"
          >
            <ArrowDownToLine size={14} />
            <span>Withdraw</span>
          </button>
          <button
            aria-label={`Contribution history of ${holding.name}`}
            className={ui.labelledIcon}
            onClick={() => setAction('history')}
            type="button"
            data-tip="View history"
          >
            <History size={14} />
            <span>History</span>
          </button>
          <button
            aria-label={`Edit ${holding.name}`}
            className={ui.labelledIcon}
            onClick={() => setAction('edit')}
            type="button"
            data-tip="Edit"
          >
            <Pencil size={14} />
            <span>Edit</span>
          </button>
          <button
            aria-label={`Delete ${holding.name}`}
            className={ui.labelledIcon}
            onClick={remove}
            type="button"
            data-tip="Delete"
          >
            <Trash2 size={14} />
            <span>Delete</span>
          </button>
        </div>
      </div>
      <div className={ui.metrics}>
        <Metric label="Current" value={formatMoney(position.current)} />
        <Metric label="Invested" value={formatMoney(position.invested)} />
        <Metric
          label="Gain / loss"
          tone={position.gain < 0 ? ui.loss : ui.gain}
          value={signedMoney(position.gain)}
        />
        {measure === 'rate' ? (
          <Metric
            label="Interest rate"
            value={holding.rate === undefined ? '—' : `${holding.rate.toFixed(2)}% p.a.`}
          />
        ) : measure === 'absolute' ? (
          <Metric label="Absolute return" value={formatPercent(position.absolute, 2)} />
        ) : (
          <Metric label="XIRR" value={formatPercent(position.xirr, 2)} />
        )}
        {hasWithdrawals ? (
          <Metric
            label="Booked profit"
            tone={position.booked < 0 ? ui.loss : ui.gain}
            value={signedMoney(position.booked)}
          />
        ) : null}
      </div>
      {action === 'value' ? (
        <Modal onClose={close} title={`Update ${holding.name}`}>
          <AmountForm
            button="Save value"
            initial={position.current}
            label="Current value (₹)"
            onSave={(date, value) => {
              const id = crypto.randomUUID();
              commit([
                {
                  type: 'set',
                  collection: 'valuations',
                  id,
                  value: { id, holdingId: holding.id, date, value },
                },
              ]);
              close();
            }}
          />
        </Modal>
      ) : null}
      {action === 'contribution' ? (
        <Modal onClose={close} title={`Add to ${holding.name}`}>
          <AmountForm
            button="Save contribution"
            label="Amount (₹)"
            onSave={(date, amount) => {
              const id = crypto.randomUUID();
              commit([
                {
                  type: 'set',
                  collection: 'contributions',
                  id,
                  value: { id, holdingId: holding.id, date, amount, automatic: false },
                },
              ]);
              close();
            }}
          />
        </Modal>
      ) : null}
      {action === 'withdraw' ? (
        <Modal onClose={close} title={`Withdraw from ${holding.name}`}>
          <WithdrawForm holding={holding} onDone={close} />
        </Modal>
      ) : null}
      {action === 'history' ? (
        <Modal onClose={close} title={`${holding.name} history`}>
          <HoldingHistory holding={holding} />
        </Modal>
      ) : null}
      {action === 'edit' ? (
        <Modal onClose={close} title={`Edit ${holding.name}`}>
          <HoldingForm initial={holding} kind={holding.kind} onDone={close} />
        </Modal>
      ) : null}
    </li>
  );
}

export function CategoryDialog({
  category,
  onClose,
}: {
  category: CategoryRow;
  onClose: () => void;
}) {
  return (
    <Modal onClose={onClose} title={category.name}>
      <ul className={ui.list}>
        {category.rows.map((row) => (
          <HoldingCard key={row.holding.id} row={row} />
        ))}
      </ul>
    </Modal>
  );
}
