import { useState } from 'react';
import {
  closeMonth,
  houseExpenseToSave,
  savedHouseExpenseId,
  investedFromIncome,
  holdingLabel,
  isMonthEnd,
  monthReviewStatus,
  monthSignature,
} from '../../domain/analytics';
import { holdingContributions } from '../../domain/holdings';
import { useTracker } from '../../store/tracker';
import { formatDay, formatMoney, formatMonth, localDate } from '../../ui/format';
import { Modal } from '../../ui/Modal';
import ui from '../../ui/ui.module.css';
import { BalanceForm } from './MonthlyBalances';

export function MonthReview({
  month,
  open,
  onToggle,
  onReviewed,
}: {
  month: string;
  open: boolean;
  onToggle: (open: boolean) => void;
  onReviewed: () => void;
}) {
  const data = useTracker((state) => state.data);
  const commit = useTracker((state) => state.commit);
  const canEdit = useTracker((state) => state.canEdit);
  const [settingBalance, setSettingBalance] = useState(false);
  const close = closeMonth(data, month);
  const invested = investedFromIncome(data).get(month) ?? 0;
  // Reviewing saves the house expense as an entry, or brings a saved one up to date.
  const toSave = houseExpenseToSave(data, month);
  const saved = data.expenses.find((row) => row.id === savedHouseExpenseId(month));
  const entryChanged = (toSave?.amount ?? 0) !== (saved?.amount ?? 0);
  const status = monthReviewStatus(data, month);
  const today = localDate();
  const current = today.slice(0, 7);
  // A month can only be closed on its last day or later.
  const closable = month < current || (month === current && isMonthEnd(today));
  const needsOpening = close.opening === null && month <= current;
  const needsClosing = !needsOpening && close.closing === null && closable;
  const entries = data.holdings.flatMap((holding) =>
    holdingContributions(holding.id, data.contributions)
      .filter((row) => row.automatic && row.date.startsWith(month))
      .map((row) => ({ row, holding })),
  );
  const id = `month_${month}`;

  const summary = !close.complete
    ? 'Balances needed'
    : status.changed
      ? 'Changed since review'
      : status.reviewed
        ? `Reviewed ${status.reviewedAt}`
        : 'Review available';

  // A running month has nothing to review until its last day, unless it needs an opening balance.
  if (month === current && !closable && !needsOpening) return null;

  return (
    <details
      className={`${ui.card} ${ui.fold}`}
      id="month-review"
      onToggle={(event) => onToggle(event.currentTarget.open)}
      open={open}
    >
      <summary className={ui.split}>
        <span>Month review · {formatMonth(month)}</span>
        <span className={ui.caption}>{summary}</span>
      </summary>
      <div className={ui.page}>
        <ul className={ui.list}>
          {[
            ['Opening balance', close.opening],
            ['Income', close.income],
            ['Recorded expenses', close.expenses],
            ['Invested from income', invested],
            ['Closing balance', close.closing],
            ['Unrecorded house expense', close.unrecorded],
          ].map(([label, value]) => (
            <li className={ui.row} key={String(label)}>
              <span className={ui.rowMain}>{label}</span>
              <span className={ui.amount}>
                {value !== null
                  ? formatMoney(Number(value))
                  : label === 'Opening balance'
                    ? 'Not set'
                    : 'At month end'}
              </span>
            </li>
          ))}
        </ul>
        {entries.length > 0 ? (
          <div>
            <div className={ui.groupLabel}>Automatic entries</div>
            <ul className={ui.list}>
              {entries.map(({ row, holding }) => (
                <li className={ui.row} key={row.id}>
                  <div className={ui.rowMain}>
                    <div className={ui.rowTitle}>{holdingLabel(holding)}</div>
                    <div className={ui.rowDetail}>
                      {formatDay(row.date)} · {formatMoney(row.amount)}
                    </div>
                  </div>
                  <label className={ui.check}>
                    <input
                      checked={row.confirmed === true}
                      disabled={!canEdit}
                      onChange={(event) =>
                        commit([
                          {
                            type: 'set',
                            collection: 'contributions',
                            id: row.id,
                            value: { ...row, confirmed: event.target.checked },
                          },
                        ])
                      }
                      type="checkbox"
                    />
                    Matches statement
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className={ui.caption}>
          {toSave && !saved
            ? `Marking ${formatMonth(month)} as reviewed saves its ${formatMoney(toSave.amount)} of unrecorded house expense as an expense on ${formatDay(toSave.date)}.`
            : toSave && saved && entryChanged
              ? `The saved house expense is ${formatMoney(saved.amount)}. Reviewing again updates it to ${formatMoney(toSave.amount)}.`
              : saved && !toSave
                ? `The saved house expense of ${formatMoney(saved.amount)} is no longer needed. Reviewing again removes it.`
                : saved
                  ? `Its ${formatMoney(saved.amount)} of unrecorded house expense is saved as an expense.`
                  : `Marking ${formatMonth(month)} as reviewed doesn't lock it.`}{' '}
          If its figures change later, it asks for review again.
        </p>
        <div className={ui.formActions}>
          {(needsOpening || needsClosing) && canEdit ? (
            <button className={ui.button} onClick={() => setSettingBalance(true)} type="button">
              Set {formatMonth(month)} {needsOpening ? 'opening' : 'closing'} balance
            </button>
          ) : null}
          {canEdit ? (
            <button
              className={needsOpening || needsClosing ? ui.quiet : ui.button}
              disabled={!close.complete || (status.reviewed && !entryChanged)}
              onClick={() => {
                commit([
                  ...(toSave
                    ? [
                        {
                          type: 'set' as const,
                          collection: 'expenses' as const,
                          id: toSave.id,
                          value: toSave,
                        },
                      ]
                    : saved
                      ? [{ type: 'delete' as const, collection: 'expenses' as const, id: saved.id }]
                      : []),
                  {
                    type: 'set',
                    collection: 'monthReviews',
                    id,
                    value: {
                      id,
                      month,
                      signature: monthSignature(data, month),
                      reviewedAt: localDate(),
                    },
                  },
                ]);
                onReviewed();
              }}
              type="button"
            >
              Mark month reviewed
            </button>
          ) : null}
        </div>
      </div>
      {settingBalance ? (
        <Modal
          onClose={() => setSettingBalance(false)}
          title={`${formatMonth(month)} ${needsOpening ? 'opening' : 'closing'} balance`}
        >
          <BalanceForm
            closing={!needsOpening}
            month={month}
            onDone={() => setSettingBalance(false)}
          />
        </Modal>
      ) : null}
    </details>
  );
}
