import {
  Banknote,
  CalendarDays,
  ChevronRight,
  CreditCard,
  LineChart as TrendIcon,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  attentionItems,
  closeMonth,
  fullHouseExpense,
  holdingRows,
  monthlyOverview,
  netWorth,
  netWorthHistory,
  pmsGainChange,
  portfolioCategories,
  type CategoryRow,
} from '../../domain/analytics';
import { financialYearRange, financialYearStart, previousMonth } from '../../domain/calendar';
import { monthlyTrend } from '../../domain/cashflow';
import { pendingOccurrences } from '../../domain/recurring';
import { paidShare, summarizeLoans, totalOutstanding } from '../../domain/summary';
import { useTracker, useView } from '../../store/tracker';
import { chartColor } from '../../ui/charts';
import {
  formatCompactMoney,
  formatMoney,
  formatMonth,
  formatPercent,
  localDate,
  signedMoney,
} from '../../ui/format';
import { PageHeader } from '../../ui/PageHeader';
import { Metric, Stat } from '../../ui/Stat';
import ui from '../../ui/ui.module.css';
import { useIsPhone } from '../../ui/useIsPhone';
import { EmptyState } from '../../ui/EmptyState';
import { TrendLine } from '../../ui/TrendLine';
import { useCountUp } from '../../ui/useCountUp';
import { InstallCard } from '../install/InstallPrompts';
import { GettingStarted } from './GettingStarted';
import { QuickAdd } from './QuickAdd';
import { TrendChart } from './TrendChart';

const DASHBOARD_CATEGORIES = 5;
const TREND_MONTHS = 12;
const MIN_TREND_MONTHS = 3;
const PHONE_TREND_MONTHS = 5;
type SortKey = 'size' | 'gain';

function shortFy(month: string) {
  const start = financialYearStart(month);
  return `FY ${String(start % 100)}–${String((start + 1) % 100)}`;
}

function PortfolioRow({ row, peak, index }: { row: CategoryRow; peak: number; index: number }) {
  const scale = (value: number) => `${(Math.max(0, value) / peak) * 100}%`;
  return (
    <Link className={ui.barRow} state={{ open: row.name }} to="/investments">
      <span className={ui.barName}>
        <i className={ui.dot} style={{ background: chartColor(index) }} />
        <strong>{row.name}</strong>
      </span>
      <span
        className={ui.stack}
        title={`Invested ${formatMoney(row.invested)} · Gain ${formatMoney(row.gain)}`}
      >
        <span
          className={ui.stackInvested}
          style={{ width: scale(Math.min(row.invested, row.current)) }}
        />
        <span className={ui.stackGain} style={{ width: scale(row.gain) }} />
      </span>
      <strong className={ui.barValue}>{formatCompactMoney(row.current)}</strong>
      <span className={`${ui.barGain} ${row.gain < 0 ? ui.loss : ui.gain}`}>
        {signedMoney(row.gain)} · {formatPercent(row.absolute)}
      </span>
    </Link>
  );
}

export function Dashboard() {
  const data = useView();
  const household = useTracker((state) => state.data);
  const syncedAt = useTracker((state) => state.syncedAt);
  const accessRequests = useTracker((state) => state.accessRequests);
  const phone = useIsPhone();
  const today = localDate();
  const month = today.slice(0, 7);
  const [sort, setSort] = useState<SortKey>('size');
  const [fullHouse, setFullHouse] = useState(false);
  const [snapshotMonth, setSnapshotMonth] = useState(previousMonth(month));

  const worth = netWorth(data, today);
  const shownWorth = useCountUp(worth.netWorth);
  const trendValues = useMemo(
    () => netWorthHistory(data, today, TREND_MONTHS).map((row) => row.netWorth),
    [data, today],
  );
  const trendUp = (trendValues.at(-1) ?? 0) >= (trendValues[0] ?? 0);
  const overview = monthlyOverview(data, month, today);
  const snapshot = closeMonth(data, snapshotMonth);
  const pmsChange = pmsGainChange(data, month);
  const loans = summarizeLoans(data, today);
  const outstanding = totalOutstanding(loans);

  const pending = pendingOccurrences(
    {
      rules: data.recurringRules,
      occurrences: data.recurringOccurrences,
      income: data.income,
      expenses: data.expenses,
      loans: data.loans,
    },
    today,
  );
  const attention = [
    ...accessRequests.map(({ email }) => ({
      label: `${email} wants access`,
      path: '/settings',
      state: { panel: 'family' as const },
    })),
    ...attentionItems(
      data,
      household,
      today,
      pending.length,
      syncedAt ? localDate(syncedAt) : null,
    ),
  ];

  const rows = holdingRows(data, today);
  const categories = portfolioCategories(rows).sort((a, b) =>
    sort === 'gain' ? b.gain - a.gain : b.current - a.current,
  );
  const shown = categories.slice(0, DASHBOARD_CATEGORIES);
  const peak = Math.max(...categories.map((row) => Math.max(row.invested, row.current)), 1);
  const portfolioCurrent = rows.reduce((sum, row) => sum + row.position.current, 0);
  const portfolioInvested = rows.reduce((sum, row) => sum + row.position.invested, 0);
  const portfolioGain = portfolioCurrent - portfolioInvested;

  const fyStartMonth = financialYearRange(financialYearStart(month)).start.slice(0, 7);
  const fyMonths =
    (Number(month.slice(0, 4)) - Number(fyStartMonth.slice(0, 4))) * 12 +
    Number(month.slice(5, 7)) -
    Number(fyStartMonth.slice(5, 7)) +
    1;
  // Phones show the last five months of full house expense, as the older app did.
  const showFullHouse = phone || fullHouse;
  const trend = monthlyTrend(data, month, phone ? PHONE_TREND_MONTHS : fyMonths).map((row) =>
    showFullHouse
      ? {
          ...row,
          expenses: fullHouseExpense(data, row.month),
          pending: closeMonth(data, row.month).unrecorded === null,
        }
      : row,
  );
  const snapshotOptions = Array.from({ length: 6 }, (_, index) => {
    let key = month;
    for (let step = 0; step <= index; step++) key = previousMonth(key);
    return key;
  });
  const monthName = formatMonth(month).split(' ')[0];
  const snapshotName = formatMonth(snapshotMonth).split(' ')[0];
  const previousName = formatMonth(overview.previous);
  const firstTrend = trend[0]?.month ?? month;

  const netWorthCard = (
    <section aria-label="Net worth" className={ui.hero}>
      <div className={ui.cardHeader} style={{ justifyContent: 'flex-start' }}>
        <span aria-hidden="true" className={ui.tileIcon}>
          <TrendIcon size={20} />
        </span>
        <div>
          <div className={ui.caption}>Net Worth</div>
          <div className={ui.subtleLine}>Assets after outstanding debts</div>
        </div>
      </div>
      <div className={ui.valueRow}>
        <div className={ui.value}>{formatMoney(Math.round(shownWorth))}</div>
        {trendValues.length >= MIN_TREND_MONTHS ? (
          <Link
            aria-label={`Net worth ${trendUp ? 'up' : 'down'} over the last ${trendValues.length} months. Open history`}
            to="/analytics"
          >
            <TrendLine values={trendValues} />
          </Link>
        ) : null}
      </div>
      <div className={ui.split}>
        <div>
          <div className={ui.label}>Total assets</div>
          <strong>{formatMoney(worth.assets)}</strong>
        </div>
        <div className={ui.alignEnd}>
          <div className={ui.label}>Total debts</div>
          <strong className={ui.debt}>{formatMoney(worth.debts)}</strong>
        </div>
      </div>
      <div className={ui.meter}>
        <span className={ui.meterFill} style={{ width: `${worth.assetShare * 100}%` }} />
        <span className={ui.meterDebt} style={{ flex: 1 }} />
      </div>
      <div className={ui.meterLegend}>
        <span>Assets {formatPercent(worth.assetShare)}</span>
        <span>Debts {formatPercent(worth.debts > 0 ? 1 - worth.assetShare : 0)}</span>
      </div>
    </section>
  );

  const expenseSnapshot = (
    <section aria-label="Expense snapshot" className={ui.card}>
      <div className={ui.cardHeader}>
        <div className={ui.cardHeader}>
          <span aria-hidden="true" className={ui.tileIcon}>
            <CalendarDays size={20} />
          </span>
          <span className={ui.caption}>Expense snapshot</span>
        </div>
        <select
          aria-label="Snapshot month"
          className={ui.fieldSelect}
          onChange={(event) => setSnapshotMonth(event.target.value)}
          value={snapshotMonth}
        >
          {snapshotOptions.map((key) => (
            <option key={key} value={key}>
              {formatMonth(key)}
            </option>
          ))}
        </select>
      </div>
      <div className={ui.row}>
        <strong className={ui.rowMain}>{snapshotName} House Expense</strong>
        <strong className={ui.gain}>
          {snapshot.unrecorded === null ? 'Pending' : formatMoney(snapshot.unrecorded)}
        </strong>
      </div>
      <div className={ui.row}>
        <strong className={ui.rowMain}>{snapshotName} Full Expense</strong>
        <strong className={ui.gain}>
          {snapshot.unrecorded === null
            ? 'Pending'
            : formatMoney(snapshot.unrecorded + snapshot.expenses)}
        </strong>
      </div>
    </section>
  );

  const trendCard = (
    <section className={ui.card}>
      <div className={ui.cardHeader}>
        <div>
          <h2>{showFullHouse ? 'Income vs full house expense' : 'Income vs expenses'}</h2>
          <div className={ui.caption}>
            {phone
              ? `Last ${PHONE_TREND_MONTHS} months · ${formatMonth(firstTrend)} – ${formatMonth(month)}`
              : `${shortFy(month)} · April to ${monthName}`}
          </div>
        </div>
        {phone ? null : (
          <Link className={ui.textLink} to="/analytics">
            View details ›
          </Link>
        )}
      </div>
      {phone ? null : (
        <select
          aria-label="Expense measure"
          className={ui.fieldSelect}
          onChange={(event) => setFullHouse(event.target.value === 'full')}
          value={fullHouse ? 'full' : 'recorded'}
        >
          <option value="recorded">Income vs expenses</option>
          <option value="full">Income vs full house expense</option>
        </select>
      )}
      <TrendChart months={trend} />
      {phone ? (
        <p className={ui.notice}>
          Tap a month to see amounts. Full expense is pending until both bank balances are recorded.
        </p>
      ) : null}
    </section>
  );

  const whatChanged = (
    <details className={`${ui.card} ${ui.fold}`} key={phone ? 'phone' : 'wide'} open={!phone}>
      <summary>What changed in {monthName}</summary>
      <div className={ui.caption}>
        Key recorded changes · {monthName} compared with {previousName}
      </div>
      <div className={ui.metricsTwo}>
        <Metric
          detail="Recorded transfers"
          label="Recorded contributions"
          value={formatMoney(overview.savings)}
        />
        <Metric
          detail="Principal only"
          label="Debt principal repaid"
          value={formatMoney(overview.principalRepaid)}
        />
        <Metric
          detail={`Compared with ${previousName}`}
          label="Recorded spending"
          value={
            overview.spendingChange === null
              ? 'Comparison unavailable'
              : signedMoney(overview.spendingChange)
          }
        />
        <Metric
          detail="Opening and closing valuations"
          label="PMS gain change"
          value={pmsChange === null ? 'Dated snapshots needed' : signedMoney(pmsChange)}
        />
      </div>
      <details className={ui.fold}>
        <summary>How these figures are calculated</summary>
        <p className={ui.caption}>
          Contributions and spending are what you recorded in each month. Debt principal counts only
          the principal part of each repayment. PMS gain change needs a valuation in both months.
          House expense is opening balance plus income, less recorded expenses, PMS transfers and
          next month's opening balance.
        </p>
      </details>
      <Link className={ui.quiet} to="/cash-flow">
        View cash-flow details
      </Link>
    </details>
  );

  return (
    <div className={ui.page}>
      {attention.length > 0 ? (
        <details className={ui.attention}>
          <summary>
            <span>Needs attention · {attention.length}</span>
            <span className={ui.caption}>
              {attention.length} item{attention.length === 1 ? '' : 's'} to review ›
            </span>
          </summary>
          <ul className={ui.list} style={{ marginTop: 10 }}>
            {attention.map(({ label, path, state }) => (
              <li className={ui.row} key={label}>
                <span className={ui.rowMain}>{label}</span>
                <Link
                  aria-label={`Review: ${label}`}
                  className={ui.textLink}
                  state={state}
                  to={path}
                >
                  Review ›
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <PageHeader
        eyebrow="Financial overview"
        subtitle="Your wealth, spending and progress — all in one place."
        title="Dashboard"
      />

      <GettingStarted />
      <InstallCard />

      {phone ? (
        netWorthCard
      ) : (
        <div className={ui.twoColumn}>
          {netWorthCard}
          {expenseSnapshot}
        </div>
      )}

      <div className={ui.sectionLabel}>
        Monthly overview <span>{formatMonth(month)}</span>
      </div>
      <section aria-label="This month" className={ui.statGrid}>
        <Stat
          detail={`Avg ${formatMoney(overview.averageIncome)} · ${shortFy(month)}`}
          icon={TrendingUp}
          label="Monthly Income"
          value={formatMoney(overview.close.income)}
        />
        <Stat
          detail={`Avg ${formatMoney(overview.averageExpenses)} · ${shortFy(month)}`}
          icon={CreditCard}
          label="Monthly Expenses"
          value={formatMoney(overview.close.expenses)}
        />
        <Stat
          detail={`Avg ${formatMoney(overview.averageSavings)} · ${shortFy(month)}`}
          icon={RefreshCw}
          label="Savings contributions"
          tone={ui.gain}
          value={formatMoney(overview.savings)}
        />
        <Stat
          detail={overview.close.opening === null ? 'Opening not set' : 'After recorded activity'}
          icon={Banknote}
          label="Available Balance"
          value={formatMoney(overview.close.available)}
        />
      </section>

      {phone ? (
        <>
          {whatChanged}
          {trendCard}
        </>
      ) : (
        <div className={ui.twoColumn}>
          {trendCard}
          {whatChanged}
        </div>
      )}

      <section className={ui.card}>
        <div className={ui.cardHeader}>
          <div>
            <h2 className={ui.cardTitle}>Investment Portfolio</h2>
            <div className={ui.caption}>Value and returns</div>
          </div>
          <label className={ui.caption}>
            Sort{phone ? ':' : ' by'}{' '}
            <select
              className={ui.fieldSelect}
              onChange={(event) => setSort(event.target.value as SortKey)}
              value={sort}
            >
              <option value="size">Portfolio size</option>
              <option value="gain">Gain</option>
            </select>
          </label>
        </div>
        <div className={ui.metric}>
          <div className={ui.metricsThree}>
            <div>
              <div className={ui.label}>Current value</div>
              <div className={ui.metricValue}>{formatCompactMoney(portfolioCurrent)}</div>
            </div>
            <div>
              <div className={ui.label}>Invested</div>
              <div className={ui.metricValue}>{formatCompactMoney(portfolioInvested)}</div>
            </div>
            <div>
              <div className={ui.label}>Total gain</div>
              <div className={`${ui.metricValue} ${portfolioGain < 0 ? ui.loss : ui.gain}`}>
                {signedMoney(portfolioGain)}
              </div>
              <div className={`${ui.caption} ${portfolioGain < 0 ? ui.loss : ui.gain}`}>
                {formatPercent(portfolioInvested > 0 ? portfolioGain / portfolioInvested : null)}
              </div>
            </div>
          </div>
          <div className={ui.legendRow}>
            <span>
              <i className={ui.stackInvested} /> Invested
            </span>
            <span>
              <i className={ui.stackGain} /> Gain
            </span>
          </div>
        </div>
        {shown.length === 0 ? (
          <EmptyState
            action={
              <Link className={ui.quiet} state={{ add: 'investment' }} to="/investments">
                Add your first investment
              </Link>
            }
            icon={TrendingUp}
            text="See their value and returns here."
            title="No investments recorded yet."
          />
        ) : (
          <div className={ui.barList}>
            {shown.map((row, index) => (
              <PortfolioRow index={index} key={row.name} peak={peak} row={row} />
            ))}
          </div>
        )}
        <div className={ui.caption}>Tap a category to view its holdings and exact amounts.</div>
        {categories.length > shown.length ? (
          <Link className={ui.textLinkCenter} to="/investments">
            View remaining {categories.length - shown.length} investments ›
          </Link>
        ) : null}
      </section>

      <section className={ui.card}>
        <div className={ui.cardHeader}>
          <h2 className={ui.cardTitle}>Debt Summary</h2>
          <div className={ui.alignEnd}>
            <div className={ui.label}>Total outstanding</div>
            <strong>{formatMoney(outstanding)}</strong>
          </div>
        </div>
        {loans.length === 0 ? (
          <EmptyState
            action={
              <Link className={ui.quiet} state={{ add: true }} to="/debts">
                Add your first loan
              </Link>
            }
            icon={CreditCard}
            text="Track what's left and how much you've paid."
            title="No loans recorded yet."
          />
        ) : (
          <div className={ui.twoColumn}>
            {loans.map(({ id, type, ledger, error }, index) => (
              <Link className={ui.linkCard} key={id} to="/debts">
                <div className={ui.split}>
                  <strong>
                    <i className={ui.dot} style={{ background: chartColor(index) }} />
                    {type}
                  </strong>
                  <span className={ui.chip}>
                    {formatPercent(outstanding > 0 ? (ledger?.remaining ?? 0) / outstanding : 0)} of
                    total debt
                  </span>
                </div>
                <div className={ui.metricValue}>
                  {ledger ? formatMoney(ledger.remaining) : error}
                </div>
                {ledger ? (
                  <>
                    <div className={ui.meter} style={{ height: 5, margin: '8px 0 4px' }}>
                      <span
                        className={ui.meterFill}
                        style={{ width: `${paidShare(ledger) * 100}%` }}
                      />
                    </div>
                    <div className={ui.meterLegend}>
                      <span>Paid: {formatPercent(paidShare(ledger))}</span>
                      <span className={ui.textLink}>
                        View details <ChevronRight size={12} />
                      </span>
                    </div>
                  </>
                ) : null}
              </Link>
            ))}
          </div>
        )}
      </section>
      <QuickAdd />
    </div>
  );
}
