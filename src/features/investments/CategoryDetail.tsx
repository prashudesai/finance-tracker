import {
  ArrowDownToLine,
  CalendarCheck,
  Landmark,
  Plus,
  RefreshCw,
  Trash2,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import type { CategoryRow, PositionRow } from '../../domain/analytics';
import { holdingActivity, holdingDisplayName, type ActivityKind } from '../../domain/activity';
import { financialYearStart } from '../../domain/calendar';
import {
  duePayouts,
  groupXirr,
  receivedPayouts,
  returnMeasure,
  valueHistory,
} from '../../domain/holdings';
import { cagr } from '../../domain/returns';
import { useSettings, useTracker } from '../../store/tracker';
import { chartColor } from '../../ui/charts';
import { formatDay, formatMoney, formatPercent, localDate, signedMoney } from '../../ui/format';
import ui from '../../ui/ui.module.css';
import styles from './CategoryDetail.module.css';
import { PayoutActions } from './PayoutActions';
import { usePayouts } from './payouts';
import { ValueChart } from './ValueChart';

const EVERY_WORDS = {
  month: 'a month',
  quarter: 'a quarter',
  'half-year': 'every six months',
  year: 'a year',
} as const;

/** A day, with its year when it isn't this year's. */
const dayOf = (date: string) =>
  date.slice(0, 4) === localDate().slice(0, 4)
    ? formatDay(date)
    : `${formatDay(date)} ${date.slice(0, 4)}`;

const OFTEN = {
  month: 'monthly',
  quarter: 'quarterly',
  'half-year': 'half-yearly',
  year: 'yearly',
} as const;

const RANGES = [
  { key: '6M', months: 7 },
  { key: '1Y', months: 13 },
  { key: '3Y', months: 37 },
  { key: 'All', months: 600 },
] as const;
type RangeKey = (typeof RANGES)[number]['key'];

const ACTIVITY: Record<ActivityKind, { label: string; icon: LucideIcon }> = {
  contribution: { label: 'Added', icon: Plus },
  scheduled: { label: 'Monthly contribution', icon: CalendarCheck },
  valued: { label: 'Value updated', icon: RefreshCw },
  withdrew: { label: 'Withdrawn', icon: ArrowDownToLine },
  interest: { label: 'Interest paid out', icon: Landmark },
};

/**
 * One category's own page: its value and gain first, then how it grew against what went in,
 * how it splits across holdings, each holding with its actions, and the latest activity.
 */
export function CategoryDetail({
  category,
  renderHolding,
}: {
  category: CategoryRow;
  renderHolding: (
    row: PositionRow,
    color: string,
    share: number | null,
    today: string,
  ) => ReactNode;
}) {
  const data = useTracker((state) => state.data);
  const settings = useSettings();
  const today = localDate();
  const [range, setRange] = useState<RangeKey>('1Y');
  const holdings = useMemo(() => category.rows.map((row) => row.holding), [category.rows]);
  const history = useMemo(() => valueHistory(holdings, data, today), [holdings, data, today]);
  const months = RANGES.find((row) => row.key === range)?.months ?? 13;
  const points = history.slice(-months);
  const rows = [...category.rows].sort((a, b) => b.position.current - a.position.current);
  const names = new Map(holdings.map((row) => [row.id, holdingDisplayName(row, holdings)]));

  const measures = new Set(holdings.map((row) => returnMeasure(row, settings)));
  const measure = measures.size === 1 ? [...measures][0] : 'absolute';
  const rates = [...new Set(holdings.map((row) => row.rate))];
  const returnText =
    measure === 'xirr'
      ? { label: 'XIRR', value: formatPercent(groupXirr(holdings, data, today), 2) }
      : measure === 'rate'
        ? {
            label: 'Interest rate',
            value:
              rates.length === 1 && rates[0] !== undefined
                ? `${rates[0].toFixed(2)}% p.a.`
                : 'Multiple rates',
          }
        : { label: 'Absolute return', value: formatPercent(category.absolute, 2) };

  const canEdit = useTracker((state) => state.canEdit);
  const { remove } = usePayouts();
  const received = holdings
    .flatMap((row) => receivedPayouts(row.id, data.payouts))
    .filter((row) => row.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date));
  const due = duePayouts(holdings, data.payouts, today);
  const paidOut = received.reduce((sum, row) => sum + row.amount, 0);
  const thisYear = financialYearStart(today);
  const paidThisYear = received
    .filter((row) => financialYearStart(row.date) === thisYear)
    .reduce((sum, row) => sum + row.amount, 0);
  const schedules = holdings.filter((row) => row.payout);
  const since = holdings.map((row) => row.date).sort()[0] ?? today;
  const categoryCagr = cagr(category.invested, category.current, since, today);
  const start = points[0];
  const moved = start ? category.current - start.value : 0;

  const activity = holdingActivity(holdings, data, today);

  return (
    <div className={styles.page}>
      <section aria-label={`${category.name} value`} className={`${ui.hero} ${styles.hero}`}>
        <span className={styles.heroLabel}>Current value</span>
        <strong className={styles.heroValue}>{formatMoney(category.current)}</strong>
        <span className={category.gain < 0 ? styles.heroLoss : styles.heroGain}>
          {signedMoney(category.gain)}
          {category.absolute === null ? '' : ` · ${formatPercent(category.absolute)}`}
          <span className={styles.heroNote}> overall gain</span>
        </span>
        <dl className={styles.heroFacts}>
          <div>
            <dt>Invested</dt>
            <dd>{formatMoney(category.invested)}</dd>
          </div>
          <div>
            <dt>{returnText.label}</dt>
            <dd>{returnText.value}</dd>
          </div>
          {measure === 'xirr' ? (
            <>
              <div>
                <dt>Absolute return</dt>
                <dd>{formatPercent(category.absolute, 2)}</dd>
              </div>
              <div>
                <dt>CAGR</dt>
                <dd>{formatPercent(categoryCagr, 2)}</dd>
              </div>
            </>
          ) : null}
          {category.count > 1 ? (
            <div>
              <dt>Holdings</dt>
              <dd>{category.count}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section aria-label="Growth" className={`${ui.card} ${styles.panel}`}>
        <div className={styles.panelHead}>
          <div>
            <h3>Growth</h3>
            {start && points.length >= 2 && Math.round(moved) !== 0 ? (
              <small className={moved < 0 ? ui.loss : ui.gain}>
                {signedMoney(moved)} over this period
              </small>
            ) : null}
          </div>
          <div aria-label="Chart range" className={styles.ranges} role="group">
            {RANGES.map((row) => (
              <button
                aria-pressed={range === row.key}
                className={styles.range}
                key={row.key}
                onClick={() => setRange(row.key)}
                type="button"
              >
                {row.key}
              </button>
            ))}
          </div>
        </div>
        <ValueChart points={points} />
      </section>

      {rows.length > 1 ? (
        <section aria-label="Split by holding" className={`${ui.card} ${styles.panel}`}>
          <h3>Split by holding</h3>
          <div aria-hidden="true" className={styles.split}>
            {rows.map((row, index) => (
              <span
                key={row.holding.id}
                style={{
                  flexGrow: Math.max(row.position.current, 0),
                  background: chartColor(index),
                }}
              />
            ))}
          </div>
          <ul className={styles.splitLegend}>
            {rows.map((row, index) => (
              <li key={row.holding.id}>
                <i style={{ background: chartColor(index) }} />
                <span>{names.get(row.holding.id) ?? row.holding.name}</span>
                <strong>
                  {formatPercent(
                    category.current > 0 ? row.position.current / category.current : 0,
                  )}
                </strong>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-label="Holdings" className={styles.holdingsSection}>
        <h3 className={styles.sectionTitle}>
          {rows.length === 1 ? 'Holding' : `Holdings · ${rows.length}`}
        </h3>
        <ul className={styles.holdings}>
          {rows.map((row, index) =>
            renderHolding(
              row,
              chartColor(index),
              rows.length > 1 && category.current > 0
                ? row.position.current / category.current
                : null,
              today,
            ),
          )}
        </ul>
      </section>

      {paidOut > 0 || due.length > 0 || schedules.length > 0 ? (
        <section aria-label="Payouts received" className={`${ui.card} ${styles.panel}`}>
          <div className={styles.panelHead}>
            <h3>Payouts received</h3>
            <small className={styles.payoutPlan}>
              {schedules
                .map((row) =>
                  row.payout?.amount
                    ? `${formatMoney(row.payout.amount)} ${EVERY_WORDS[row.payout.every]}`
                    : `Varies · ${OFTEN[row.payout?.every ?? 'month']}`,
                )
                .join(' · ')}
            </small>
          </div>
          <dl className={styles.heroFacts}>
            <div>
              <dt>All time</dt>
              <dd className={ui.gain}>{formatMoney(paidOut)}</dd>
            </div>
            <div>
              <dt>This financial year</dt>
              <dd>{formatMoney(paidThisYear)}</dd>
            </div>
          </dl>
          {due.length > 0 ? (
            <ul className={styles.activity}>
              {due.map((row) => {
                const label = `${names.get(row.holdingId) ?? ''} interest due ${dayOf(row.date)}`;
                return (
                  <li key={row.id}>
                    <span aria-hidden="true" className={styles.activityIcon} data-kind="Due">
                      <Landmark size={14} />
                    </span>
                    <span className={styles.activityText}>
                      <strong>
                        {row.amount > 0 ? `${formatMoney(row.amount)} due` : 'Payout due'}
                      </strong>
                      <small>
                        {rows.length > 1 ? `${names.get(row.holdingId) ?? ''} · ` : ''}
                        {dayOf(row.date)}
                      </small>
                    </span>
                    <PayoutActions fallback={null} label={label} payout={row} />
                  </li>
                );
              })}
            </ul>
          ) : null}
          {received.length > 0 ? (
            <ul className={styles.activity}>
              {received.slice(0, 8).map((row) => (
                <li key={row.id}>
                  <span aria-hidden="true" className={styles.activityIcon}>
                    <Landmark size={14} />
                  </span>
                  <span className={styles.activityText}>
                    <strong>{formatMoney(row.amount)}</strong>
                    <small>
                      {rows.length > 1 ? `${names.get(row.holdingId) ?? ''} · ` : ''}
                      {dayOf(row.date)}
                    </small>
                  </span>
                  {canEdit ? (
                    <button
                      aria-label={`Delete interest of ${formatMoney(row.amount)} on ${dayOf(row.date)}`}
                      className={ui.smallIcon}
                      onClick={() => {
                        if (window.confirm('Delete this payout and its income entry?')) remove(row);
                      }}
                      type="button"
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {activity.length > 0 ? (
        <section aria-label="Recent activity" className={`${ui.card} ${styles.panel}`}>
          <h3>Recent activity</h3>
          <ul className={styles.activity}>
            {activity.map((row) => {
              const { label, icon: Icon } = ACTIVITY[row.kind];
              const holding = rows.length > 1 ? ` · ${names.get(row.holdingId) ?? ''}` : '';
              // A value update says how far it moved; the new value goes underneath.
              const valued = row.kind === 'valued' && row.change !== undefined;
              return (
                <li key={`${row.kind}-${row.id}`}>
                  <span aria-hidden="true" className={styles.activityIcon} data-kind={row.kind}>
                    <Icon size={14} />
                  </span>
                  <span className={styles.activityText}>
                    <strong>
                      {label}
                      {holding}
                    </strong>
                    <small>
                      {dayOf(row.date)}
                      {valued ? ` · now ${formatMoney(row.amount)}` : ''}
                    </small>
                  </span>
                  <span
                    className={styles.activityAmount}
                    data-tone={
                      valued
                        ? row.change === 0
                          ? 'flat'
                          : (row.change ?? 0) > 0
                            ? 'up'
                            : 'down'
                        : undefined
                    }
                  >
                    {valued
                      ? row.change === 0
                        ? 'No change'
                        : signedMoney(row.change ?? 0)
                      : formatMoney(row.amount)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <p className={styles.chartEmpty}>
          <TrendingUp aria-hidden="true" size={14} /> No contributions or value updates yet.
        </p>
      )}
    </div>
  );
}
