import { ArrowDownToLine, History, Landmark, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { CategoryRow, PositionRow } from '../../domain/analytics';
import type { RecordWrite } from '../../data/repository';
import { returnMeasure, valueHistory } from '../../domain/holdings';
import { useSettings, useTracker } from '../../store/tracker';
import { Field } from '../../ui/Field';
import { formatMoney, formatPercent, localDate, signedMoney } from '../../ui/format';
import { Modal } from '../../ui/Modal';
import { TrendLine } from '../../ui/TrendLine';
import ui from '../../ui/ui.module.css';
import { CategoryDetail } from './CategoryDetail';
import styles from './CategoryDetail.module.css';
import { HoldingForm } from './HoldingForm';
import { HoldingHistory } from './HoldingHistory';
import { receivedWrites } from './payouts';
import { WithdrawForm } from './WithdrawForm';
import { isAccountNumber } from '../../domain/activity';

type Action = 'value' | 'contribution' | 'withdraw' | 'history' | 'edit' | 'payout';

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

function HoldingCard({
  row,
  color,
  portfolioShare,
  today,
}: {
  row: PositionRow;
  color: string;
  portfolioShare: number | null;
  today: string;
}) {
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
      // Interest already received stays in income, as the money did arrive.
      ...data.payouts
        .filter((item) => item.holdingId === holding.id)
        .map((item): RecordWrite => ({ type: 'delete', collection: 'payouts', id: item.id })),
    ];
    commit(writes);
  };

  const history = valueHistory([holding], data, today, 13).map((point) => point.value);
  const ret =
    measure === 'rate'
      ? holding.rate === undefined
        ? null
        : `${holding.rate.toFixed(2)}% p.a.`
      : measure === 'absolute'
        ? position.absolute === null
          ? null
          : formatPercent(position.absolute, 2)
        : position.xirr === null
          ? null
          : formatPercent(position.xirr, 2);
  const actions = [
    {
      key: 'value',
      label: 'Update',
      tip: 'Update value',
      aria: `Update value of ${holding.name}`,
      Icon: RefreshCw,
    },
    {
      key: 'contribution',
      label: 'Add',
      tip: 'Add contribution',
      aria: `Add contribution to ${holding.name}`,
      Icon: Plus,
    },
    {
      key: 'withdraw',
      label: 'Withdraw',
      tip: 'Withdraw or book profit',
      aria: `Withdraw from ${holding.name}`,
      Icon: ArrowDownToLine,
    },
    ...(holding.kind === 'investment'
      ? ([
          {
            key: 'payout',
            label: 'Interest',
            tip: 'Record interest paid out',
            aria: `Record interest paid out by ${holding.name}`,
            Icon: Landmark,
          },
        ] as const)
      : []),
    {
      key: 'history',
      label: 'History',
      tip: 'View history',
      aria: `Contribution history of ${holding.name}`,
      Icon: History,
    },
    { key: 'edit', label: 'Edit', tip: 'Edit', aria: `Edit ${holding.name}`, Icon: Pencil },
  ] as const;

  const named = !isAccountNumber(holding.name) || !holding.member;
  return (
    <li className={styles.holding} style={{ borderLeftColor: color }}>
      <div className={styles.holdingTop}>
        <div className={styles.holdingName}>
          {/* An account known only by its number is shown by whose it is, with the number below. */}
          <strong>{named ? holding.name : holding.member}</strong>
          <small>
            {named ? holding.member : `A/c ${holding.name}`}
            {closed ? ' · Closed' : ''}
            {holding.uan ? ` · UAN ${holding.uan}` : ''}
            {holding.scheme ? ` · ${holding.scheme}` : ''}
            {holding.kind === 'pf'
              ? ` · Employee ${formatMoney(holding.employee ?? 0)} · Employer ${formatMoney(holding.employer ?? 0)}`
              : ''}
          </small>
        </div>
        {history.length >= 2 ? (
          <span className={styles.holdingTrend}>
            <TrendLine
              area
              color={position.gain < 0 ? 'var(--loss)' : 'var(--accent)'}
              height={30}
              values={history}
              width={72}
            />
          </span>
        ) : null}
        <div className={styles.holdingValue}>
          <strong>{formatMoney(position.current)}</strong>
          <small className={position.gain < 0 ? ui.loss : ui.gain}>
            {signedMoney(position.gain)}
            {position.absolute === null ? '' : ` · ${formatPercent(position.absolute)}`}
          </small>
        </div>
      </div>
      <dl className={styles.facts}>
        <div>
          <dt>Invested</dt>
          <dd>{formatMoney(position.invested)}</dd>
        </div>
        <div>
          <dt>
            {measure === 'rate'
              ? 'Interest rate'
              : measure === 'absolute'
                ? 'Absolute return'
                : 'XIRR'}
          </dt>
          <dd>{ret ?? '—'}</dd>
        </div>
        {measure === 'xirr' ? (
          <>
            <div>
              <dt>Absolute return</dt>
              <dd>{formatPercent(position.absolute, 2)}</dd>
            </div>
            <div>
              <dt>CAGR</dt>
              <dd>{formatPercent(position.cagr, 2)}</dd>
            </div>
          </>
        ) : null}
        {position.paidOut > 0 ? (
          <div>
            <dt>Interest received</dt>
            <dd className={ui.gain}>{formatMoney(position.paidOut)}</dd>
          </div>
        ) : null}
        {hasWithdrawals ? (
          <div>
            <dt>Booked profit</dt>
            <dd className={position.booked < 0 ? ui.loss : ui.gain}>
              {signedMoney(position.booked)}
            </dd>
          </div>
        ) : null}
        {portfolioShare === null ? null : (
          <div>
            <dt>Share here</dt>
            <dd>{formatPercent(portfolioShare)}</dd>
          </div>
        )}
      </dl>
      <div className={styles.actions}>
        {actions.map(({ key, label, tip, aria, Icon }) => (
          <button
            aria-label={aria}
            className={styles.action}
            data-tip={tip}
            key={key}
            onClick={() => setAction(key)}
            type="button"
          >
            <Icon aria-hidden="true" size={14} />
            <span>{label}</span>
          </button>
        ))}
        <button
          aria-label={`Delete ${holding.name}`}
          className={`${styles.action} ${styles.danger}`}
          data-tip="Delete"
          onClick={remove}
          type="button"
        >
          <Trash2 aria-hidden="true" size={14} />
        </button>
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
      {action === 'payout' ? (
        <Modal onClose={close} title={`Interest from ${holding.name}`}>
          <AmountForm
            button="Save interest"
            initial={holding.payout?.amount}
            label="Interest received (₹)"
            onSave={(date, amount) => {
              if (amount > 0) {
                commit(
                  receivedWrites(
                    holding,
                    { id: crypto.randomUUID(), holdingId: holding.id, date, amount },
                    amount,
                  ),
                );
              }
              close();
            }}
          />
          <p className={ui.caption}>It's also added to your income in Money.</p>
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
    <Modal fullScreenOnPhone onClose={onClose} title={category.name} wide>
      <CategoryDetail
        category={category}
        renderHolding={(row, color, share, today) => (
          <HoldingCard
            color={color}
            key={row.holding.id}
            portfolioShare={share}
            row={row}
            today={today}
          />
        )}
      />
    </Modal>
  );
}
