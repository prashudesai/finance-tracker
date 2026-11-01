import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { financialYearLabel, financialYearRange, financialYearStart } from '../../domain/calendar';
import {
  epsLedger,
  holdingContributions,
  holdingPosition,
  interestCreditId,
} from '../../domain/holdings';
import type { Holding } from '../../schema/records';
import { useTracker } from '../../store/tracker';
import { Field } from '../../ui/Field';
import { formatDay, formatMoney, localDate, signedMoney } from '../../ui/format';
import ui from '../../ui/ui.module.css';

type View = 'contributions' | 'interest' | 'eps';

function ContributionHistory({ holdingId }: { holdingId: string }) {
  const contributions = useTracker((state) => state.data.contributions);
  const commit = useTracker((state) => state.commit);
  const rows = holdingContributions(holdingId, contributions).reverse();
  if (rows.length === 0) return <p className={ui.empty}>No contributions recorded yet.</p>;
  return (
    <ul className={ui.list}>
      {rows.map((row) => (
        <li className={ui.row} key={row.id}>
          <div className={ui.rowMain}>
            <div className={ui.rowTitle}>{formatMoney(row.amount)}</div>
            <div className={ui.rowDetail}>
              {formatDay(row.date)} {row.date.slice(0, 4)} ·{' '}
              {row.automatic ? 'Automatic' : 'Manual'}
            </div>
          </div>
          <button
            aria-label={`Remove contribution of ${formatDay(row.date)}`}
            className={ui.smallIcon}
            onClick={() =>
              // A scheduled record stays, marked skipped, so the schedule does not repost it.
              commit([
                row.automatic
                  ? {
                      type: 'set',
                      collection: 'contributions',
                      id: row.id,
                      value: { ...row, skipped: true },
                    }
                  : { type: 'delete', collection: 'contributions', id: row.id },
              ])
            }
            type="button"
          >
            <Trash2 size={14} />
          </button>
        </li>
      ))}
    </ul>
  );
}

function InterestCredits({ holding }: { holding: Holding }) {
  const credits = useTracker((state) => state.data.interestCredits);
  const commit = useTracker((state) => state.commit);
  const report = useTracker((state) => state.report);
  const today = localDate();
  const lastYear = financialYearStart(today) - 1;
  const [year, setYear] = useState(String(lastYear));
  const [date, setDate] = useState(financialYearRange(lastYear).end);
  const [amount, setAmount] = useState('');
  const rows = credits
    .filter((row) => row.holdingId === holding.id)
    .sort((a, b) => b.financialYearStartYear - a.financialYearStartYear);
  const parsedYear = Number(year);
  const valid = Number.isInteger(parsedYear) && Number(amount) > 0 && date !== '';

  return (
    <div className={ui.page}>
      <form
        className={ui.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (!valid) return;
          if (rows.some((row) => row.financialYearStartYear === parsedYear)) {
            report(`Interest for ${financialYearLabel(parsedYear)} is already recorded.`);
            return;
          }
          const id = interestCreditId(holding.id, parsedYear);
          commit([
            {
              type: 'set',
              collection: 'interestCredits',
              id,
              value: {
                id,
                holdingId: holding.id,
                financialYearStartYear: parsedYear,
                creditedDate: date,
                amount: Number(amount),
              },
            },
          ]);
          setAmount('');
        }}
      >
        <Field label="Financial year starting">
          <input onChange={(event) => setYear(event.target.value)} type="number" value={year} />
        </Field>
        <Field label="Credited date">
          <input onChange={(event) => setDate(event.target.value)} type="date" value={date} />
        </Field>
        <Field label="Interest credited (₹)">
          <input
            inputMode="decimal"
            onChange={(event) => setAmount(event.target.value)}
            step="0.01"
            type="number"
            value={amount}
          />
        </Field>
        <div className={ui.formActions}>
          <button className={ui.button} disabled={!valid} type="submit">
            Save interest credit
          </button>
        </div>
      </form>
      {rows.length === 0 ? (
        <p className={ui.empty}>No interest credits recorded yet.</p>
      ) : (
        <ul className={ui.list}>
          {rows.map((row) => (
            <li className={ui.row} key={row.id}>
              <div className={ui.rowMain}>
                <div className={ui.rowTitle}>{financialYearLabel(row.financialYearStartYear)}</div>
                <div className={ui.rowDetail}>Credited {row.creditedDate}</div>
              </div>
              <span className={ui.amount}>{formatMoney(row.amount)}</span>
              <button
                aria-label={`Delete interest for ${financialYearLabel(row.financialYearStartYear)}`}
                className={ui.smallIcon}
                onClick={() =>
                  commit([{ type: 'delete', collection: 'interestCredits', id: row.id }])
                }
                type="button"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EpsHistory({ holding }: { holding: Holding }) {
  const data = useTracker((state) => state.data);
  const commit = useTracker((state) => state.commit);
  const today = localDate();
  const current = holdingPosition(holding, data, today).eps;
  const [balance, setBalance] = useState('');
  const rows = epsLedger(holding, data).reverse();
  const next = Number(balance);
  const valid = balance !== '' && next >= 0 && next !== current;

  return (
    <div className={ui.page}>
      <p className={ui.caption}>Current EPS {formatMoney(current)}. EPS earns no interest.</p>
      <form
        className={ui.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (!valid) return;
          const id = crypto.randomUUID();
          commit([
            {
              type: 'set',
              collection: 'epsUpdates',
              id,
              value: { id, holdingId: holding.id, date: today, amount: next - current },
            },
          ]);
          setBalance('');
        }}
      >
        <Field label="Corrected EPS balance (₹)">
          <input
            inputMode="decimal"
            onChange={(event) => setBalance(event.target.value)}
            step="0.01"
            type="number"
            value={balance}
          />
        </Field>
        <div className={ui.formActions}>
          <button className={ui.button} disabled={!valid} type="submit">
            Save EPS balance
          </button>
        </div>
      </form>
      {rows.length === 0 ? (
        <p className={ui.empty}>No EPS movements recorded yet.</p>
      ) : (
        <ul className={ui.list}>
          {rows.map((row) => (
            <li className={ui.row} key={row.id}>
              <div className={ui.rowMain}>
                <div className={ui.rowTitle}>{signedMoney(row.amount)}</div>
                <div className={ui.rowDetail}>
                  {row.date} ·{' '}
                  {row.kind === 'correction' ? 'Balance correction' : 'Monthly contribution'}
                </div>
              </div>
              <span className={ui.amount}>{formatMoney(row.balance)}</span>
              {row.kind === 'correction' ? (
                <button
                  aria-label={`Delete EPS correction of ${row.date}`}
                  className={ui.smallIcon}
                  onClick={() => commit([{ type: 'delete', collection: 'epsUpdates', id: row.id }])}
                  type="button"
                >
                  <Trash2 size={14} />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function HoldingHistory({ holding }: { holding: Holding }) {
  const [view, setView] = useState<View>('contributions');
  const hasInterest = holding.kind === 'pf' || holding.kind === 'ppf';
  const hasEps = holding.kind === 'pf';
  return (
    <div className={ui.page}>
      {hasInterest ? (
        <select
          aria-label="History type"
          className={ui.fieldSelect}
          onChange={(event) => setView(event.target.value as View)}
          value={view}
        >
          <option value="contributions">Contributions</option>
          <option value="interest">Interest credits</option>
          {hasEps ? <option value="eps">EPS balance</option> : null}
        </select>
      ) : null}
      {view === 'contributions' ? <ContributionHistory holdingId={holding.id} /> : null}
      {view === 'interest' ? <InterestCredits holding={holding} /> : null}
      {view === 'eps' ? <EpsHistory holding={holding} /> : null}
    </div>
  );
}
