import { useState } from 'react';
import { closeMonth, monthReviewStatus, monthSignature } from '../../domain/analytics';
import { nextMonth } from '../../domain/calendar';
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
}: {
  month: string;
  open: boolean;
  onToggle: (open: boolean) => void;
}) {
  const data = useTracker((state) => state.data);
  const commit = useTracker((state) => state.commit);
  const canEdit = useTracker((state) => state.canEdit);
  const [settingBalance, setSettingBalance] = useState<string | null>(null);
  const close = closeMonth(data, month);
  const status = monthReviewStatus(data, month);
  // A closing balance only exists once the next month has started.
  const unset = close.opening === null ? month : close.closing === null ? nextMonth(month) : null;
  const missingBalance = unset && unset <= localDate().slice(0, 7) ? unset : null;
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

  return (
    <details
      className={`${ui.card} ${ui.fold}`}
      id="month-review"
      onToggle={(event) => onToggle(event.currentTarget.open)}
      open={open}
    >
      <summary className={ui.split}>
        <span>Month review</span>
        <span className={ui.caption}>{summary}</span>
      </summary>
      <div className={ui.page}>
        <ul className={ui.list}>
          {[
            ['Opening balance', close.opening],
            ['Income', close.income],
            ['Recorded expenses', close.expenses],
            ['Next month opening', close.closing],
            ['House expense', close.unrecorded],
          ].map(([label, value]) => (
            <li className={ui.row} key={String(label)}>
              <span className={ui.rowMain}>{label}</span>
              <span className={ui.amount}>
                {value === null ? 'Not set' : formatMoney(Number(value))}
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
          {missingBalance && canEdit ? (
            <button
              className={ui.button}
              onClick={() => setSettingBalance(missingBalance)}
              type="button"
            >
              Set {formatMonth(missingBalance)} opening balance
            </button>
          ) : null}
          <button
            className={missingBalance ? ui.quiet : ui.button}
            disabled={!close.complete || status.reviewed}
            onClick={() =>
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
              ])
            }
            type="button"
          >
            Mark month reviewed
          </button>
        </div>
      </div>
      {settingBalance ? (
        <Modal onClose={() => setSettingBalance(null)} title="Set bank balance">
          <BalanceForm month={settingBalance} onDone={() => setSettingBalance(null)} />
        </Modal>
      ) : null}
    </details>
  );
}
