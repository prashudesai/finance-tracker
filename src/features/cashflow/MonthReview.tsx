import { useState } from 'react';
import { closeMonth, isMonthEnd, monthReviewStatus, monthSignature } from '../../domain/analytics';
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
            ['Closing balance', close.closing],
            ['House expense', close.unrecorded],
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
                    <div className={ui.rowTitle}>{holding.name}</div>
                    <div className={ui.rowDetail}>
                      {formatDay(row.date)} · {formatMoney(row.amount)}
                    </div>
                  </div>
                  <label className={ui.check}>
                    <input
                      checked={row.confirmed === true}
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
          Marking {formatMonth(month)} as reviewed doesn't lock it or change any money. If its
          figures change later, it asks for review again.
        </p>
        <div className={ui.formActions}>
          {(needsOpening || needsClosing) && canEdit ? (
            <button className={ui.button} onClick={() => setSettingBalance(true)} type="button">
              Set {formatMonth(month)} {needsOpening ? 'opening' : 'closing'} balance
            </button>
          ) : null}
          <button
            className={needsOpening || needsClosing ? ui.quiet : ui.button}
            disabled={!close.complete || status.reviewed}
            onClick={() => {
              commit([
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
