import { closeMonth, monthReviewStatus, monthSignature } from '../../domain/analytics';
import { holdingContributions } from '../../domain/holdings';
import { useTracker } from '../../store/tracker';
import { formatDay, formatMoney, formatMonth, localDate } from '../../ui/format';
import ui from '../../ui/ui.module.css';

export function MonthReview({ month }: { month: string }) {
  const data = useTracker((state) => state.data);
  const commit = useTracker((state) => state.commit);
  const close = closeMonth(data, month);
  const status = monthReviewStatus(data, month);
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
    <details className={`${ui.card} ${ui.fold}`}>
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
          <button
            className={ui.button}
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
    </details>
  );
}
