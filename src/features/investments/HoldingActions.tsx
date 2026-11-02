import { History, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { CategoryRow, PositionRow } from '../../domain/analytics';
import type { RecordWrite } from '../../data/repository';
import { useTracker } from '../../store/tracker';
import { Field } from '../../ui/Field';
import { formatMoney, formatPercent, localDate, signedMoney } from '../../ui/format';
import { Modal } from '../../ui/Modal';
import { Metric } from '../../ui/Stat';
import ui from '../../ui/ui.module.css';
import { HoldingForm } from './HoldingForm';
import { HoldingHistory } from './HoldingHistory';

type Action = 'value' | 'contribution' | 'history' | 'edit';

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
  const close = () => setAction(null);

  const remove = () => {
    const writes: RecordWrite[] = [
      { type: 'delete', collection: 'holdings', id: holding.id },
      ...data.contributions
        .filter((item) => item.holdingId === holding.id)
        .map((item): RecordWrite => ({ type: 'delete', collection: 'contributions', id: item.id })),
      ...data.valuations
        .filter((item) => item.holdingId === holding.id)
        .map((item): RecordWrite => ({ type: 'delete', collection: 'valuations', id: item.id })),
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
            {holding.rate === undefined ? '' : ` · ${holding.rate}% a year`}
            {holding.uan ? ` · UAN ${holding.uan}` : ''}
            {holding.scheme ? ` · ${holding.scheme}` : ''}
            {holding.kind === 'pf'
              ? ` · Employee ${formatMoney(holding.employee ?? 0)} · Employer ${formatMoney(holding.employer ?? 0)}`
              : ''}
          </div>
        </div>
        <div className={ui.actions}>
          <button
            aria-label={`Update value of ${holding.name}`}
            className={ui.smallIcon}
            onClick={() => setAction('value')}
            type="button"
          >
            <RefreshCw size={14} />
          </button>
          <button
            aria-label={`Add contribution to ${holding.name}`}
            className={ui.smallIcon}
            onClick={() => setAction('contribution')}
            type="button"
          >
            <Plus size={14} />
          </button>
          <button
            aria-label={`Contribution history of ${holding.name}`}
            className={ui.smallIcon}
            onClick={() => setAction('history')}
            type="button"
          >
            <History size={14} />
          </button>
          <button
            aria-label={`Edit ${holding.name}`}
            className={ui.smallIcon}
            onClick={() => setAction('edit')}
            type="button"
          >
            <Pencil size={14} />
          </button>
          <button
            aria-label={`Delete ${holding.name}`}
            className={ui.smallIcon}
            onClick={remove}
            type="button"
          >
            <Trash2 size={14} />
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
        <Metric label="XIRR" value={formatPercent(position.xirr, 2)} />
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
