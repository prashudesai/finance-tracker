import {
  Banknote,
  CalendarDays,
  ChevronRight,
  CreditCard,
  LineChart as TrendIcon,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import {
  attentionItems,
  closeMonth,
  fullHouseExpense,
  holdingRows,
  monthlyOverview,
  netWorth,
  pmsGainChange,
  portfolioCategories,
  type CategoryRow,
} from '../../domain/analytics';
import { financialYearRange, financialYearStart, previousMonth } from '../../domain/calendar';
import { monthlyTrend } from '../../domain/cashflow';
import { pendingOccurrences } from '../../domain/recurring';
import { paidShare, summarizeLoans, totalOutstanding } from '../../domain/summary';
import { useView } from '../../store/tracker';
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
import { useIsPhone } from '../../ui/useIsPhone';
import { Metric, Stat } from '../../ui/Stat';
import ui from '../../ui/ui.module.css';
import { GettingStarted } from './GettingStarted';
import { QuickAdd } from './QuickAdd';
import { TrendChart } from './TrendChart';

const DASHBOARD_CATEGORIES = 5;
type SortKey = 'size' | 'gain';

function shortFy(month: string) {
  const start = financialYearStart(month);
  return `FY ${String(start % 100)}–${String((start + 1) % 100)}`;
}

function PortfolioRow({ row, peak, index }: { row: CategoryRow; peak: number; index: number }) {
  const scale = (value: number) => `${(Math.max(0, value) / peak) * 100}%`;
  const tone = row.gain < 0 ? ui.loss : ui.gain;
  return (
    <Link
      className={ui.barRow}
      state={{ open: row.name }}
      style={{ color: 'inherit', textDecoration: 'none' }}
      to="/investments"
    >
      <span>
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
      <span className={ui.alignEnd}>
        <strong>{formatCompactMoney(row.current)}</strong>
        <span className={`${ui.caption} ${tone}`} style={{ display: 'block' }}>
          {signedMoney(row.gain)} · {formatPercent(row.absolute)}
        </span>
      </span>
    </Link>
  );
}

export function Dashboard() {
  const data = useView();
  const today = localDate();
  const month = today.slice(0, 7);
  const [sort, setSort] = useState<SortKey>('size');
  const [fullHouse, setFullHouse] = useState(false);
  const phone = useIsPhone();
  const [snapshotMonth, setSnapshotMonth] = useState(previousMonth(month));

  const worth = netWorth(data, today);
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
  const attention = attentionItems(data, today, pending.length);

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
  const snapshotOptions = Array.from({ length: 6 }, (_, index) => {
    let key = month;
    for (let step = 0; step <= index; step++) key = previousMonth(key);
    return key;
  });
  const trend = monthlyTrend(data, month, fyMonths).map((row) =>
    fullHouse ? { ...row, expenses: fullHouseExpense(data, row.month) } : row,
  );
  const monthName = formatMonth(month).split(' ')[0];
  const snapshotName = formatMonth(snapshotMonth).split(' ')[0];
  const previousName = formatMonth(overview.previous);

  return (
    <div className={ui.page}>
      {attention.length > 0 ? (
        <details className={ui.attention}>
          <summary>
            <span>Needs attention · {attention.length}</span>
            <span className={ui.caption}>
              {attention.length} item{attention.length === 1 ? '' : 's'} to review
            </span>
          </summary>
          <ul className={ui.list} style={{ marginTop: 10 }}>
            {attention.map(({ label, path }) => (
              <li className={ui.row} key={label}>
                <span className={ui.rowMain}>{label}</span>
                <Link className={ui.caption} style={{ color: 'var(--accent)' }} to={path}>
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

      <div className={ui.twoColumn}>
        <section aria-label="Net worth" className={ui.hero}>
          <div className={ui.cardHeader} style={{ justifyContent: 'flex-start' }}>
            <span aria-hidden="true" className={ui.tileIcon}>
              <TrendIcon size={20} />
            </span>
            <div>
              <div>Net Worth</div>
              <div className={ui.caption}>Assets after outstanding debts</div>
            </div>
          </div>
          <div className={ui.value}>{formatMoney(worth.netWorth)}</div>
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
            <span>Debts {formatPercent(1 - worth.assetShare)}</span>
          </div>
        </section>

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
      </div>

      <div className={ui.sectionLabel}>
        Monthly overview <span>{formatMonth(month)}</span>
      </div>
      <section aria-label="This month" className={ui.tiles}>
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

      <div className={ui.twoColumn}>
        <section className={ui.card}>
          <div className={ui.cardHeader}>
            <div>
              <h2>Income vs expenses</h2>
              <div className={ui.caption}>
                {shortFy(month)} · April to {monthName}
              </div>
            </div>
            <Link
              className={ui.caption}
              style={{ color: 'var(--accent)', textDecoration: 'none' }}
              to="/analytics"
            >
              View details ›
            </Link>
          </div>
          <select
            aria-label="Expense measure"
            className={ui.fieldSelect}
            onChange={(event) => setFullHouse(event.target.value === 'full')}
            value={fullHouse ? 'full' : 'recorded'}
          >
            <option value="recorded">Income vs expenses</option>
            <option value="full">Income vs full house expense</option>
          </select>
          <TrendChart months={trend} />
        </section>

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
          <Link className={ui.quiet} to="/cash-flow">
            View cash-flow details
          </Link>
          <details className={ui.fold}>
            <summary>How these figures are calculated</summary>
            <p className={ui.caption}>
              Contributions and spending are what you recorded in each month. Debt principal counts
              only the principal part of each repayment. PMS gain change needs a valuation in both
              months. House expense is opening balance plus income, less recorded expenses, PMS
              transfers and next month's opening balance.
            </p>
          </details>
        </details>
      </div>

      <section className={ui.card}>
        <div className={ui.cardHeader}>
          <div>
            <h2 style={{ fontSize: '1.3rem' }}>Investment Portfolio</h2>
            <div className={ui.caption}>Value and returns</div>
          </div>
          <label className={ui.caption}>
            Sort by{' '}
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
        <div className={ui.metrics}>
          <Metric label="Current value" value={formatCompactMoney(portfolioCurrent)} />
          <Metric label="Invested" value={formatCompactMoney(portfolioInvested)} />
          <Metric
            detail={formatPercent(portfolioInvested > 0 ? portfolioGain / portfolioInvested : null)}
            label="Total gain"
            tone={portfolioGain < 0 ? ui.loss : ui.gain}
            value={signedMoney(portfolioGain)}
          />
        </div>
        {shown.length === 0 ? (
          <p className={ui.empty}>No investments recorded yet.</p>
        ) : (
          <div>
            {shown.map((row, index) => (
              <PortfolioRow index={index} key={row.name} peak={peak} row={row} />
            ))}
          </div>
        )}
        {categories.length > shown.length ? (
          <Link className={ui.quiet} to="/investments">
            View remaining {categories.length - shown.length} investments ›
          </Link>
        ) : null}
      </section>

      <section className={ui.card}>
        <div className={ui.cardHeader}>
          <h2>Debt Summary</h2>
          <div className={ui.alignEnd}>
            <div className={ui.label}>Total outstanding</div>
            <strong>{formatMoney(outstanding)}</strong>
          </div>
        </div>
        {loans.length === 0 ? (
          <p className={ui.empty}>No loans recorded yet.</p>
        ) : (
          <div className={ui.twoColumn}>
            {loans.map(({ id, type, ledger, error }, index) => (
              <Link
                className={ui.metric}
                key={id}
                style={{ color: 'inherit', textDecoration: 'none' }}
                to="/debts"
              >
                <div className={ui.split}>
                  <strong>
                    <i className={ui.dot} style={{ background: chartColor(index) }} />
                    {type}
                  </strong>
                  <span className={ui.caption}>
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
                      <span style={{ color: 'var(--accent)' }}>
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
