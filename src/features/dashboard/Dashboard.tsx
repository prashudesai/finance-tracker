import { BellRing, ChevronRight, CreditCard, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  attentionItems,
  trackingStart,
  investedFromIncome,
  holdingRows,
  isRepayment,
  monthlyOverview,
  overviewTrends,
  repaymentsByMonth,
  withoutRepayments,
  portfolioCategories,
  type CategoryRow,
} from '../../domain/analytics';
import { budgetReminders } from '../../domain/budget';
import { monthlyTrend } from '../../domain/cashflow';
import { pendingOccurrences } from '../../domain/recurring';
import { paidShare, summarizeLoans, totalOutstanding, greeting } from '../../domain/summary';
import { useSpendingView, useTracker, useView } from '../../store/tracker';
import { chartColor, Donut } from '../../ui/charts';
import {
  formatAmount,
  formatCompactMoney,
  formatMoney,
  formatMonth,
  formatPercent,
  localDate,
  signedMoney,
} from '../../ui/format';
import ui from '../../ui/ui.module.css';
import styles from './Dashboard.module.css';
import { useIsPhone } from '../../ui/useIsPhone';
import { useMedia } from '../../ui/useMedia';
import { EmptyState } from '../../ui/EmptyState';
import { GoalsTile } from '../goals/GoalsTile';
import { MonthRing } from './MonthRing';
import homeStyles from './Home.module.css';
import { NetWorthHero } from './NetWorthHero';
import { QuickActions } from './QuickActions';
import { ComingUp, RecentEntries } from './HomeLists';
import { InsightsCard } from '../insights/InsightsCard';
import { RecapCard } from '../insights/MonthRecap';
import { InstallCard } from '../install/InstallPrompts';
import { EmiActions, useHiddenEmis } from './EmiActions';
import { GettingStarted } from './GettingStarted';
import { TrendChart } from './TrendChart';

/** Portfolio rows on the dashboard: more on wide screens, where it sits beside the taller chart. */
const DASHBOARD_CATEGORIES = { narrow: 5, wide: 8 };
/** The income chart shows the same six months on every screen. */
const CHART_MONTHS = 6;
type SortKey = 'size' | 'gain';

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

export function Dashboard({ name = '' }: { name?: string }) {
  const data = useView();
  const household = useTracker((state) => state.data);
  const syncedAt = useTracker((state) => state.syncedAt);
  const accessRequests = useTracker((state) => state.accessRequests);
  const phone = useIsPhone();
  // The width where the chart and portfolio sit side by side.
  const wide = useMedia('(min-width: 1000px)');
  const today = localDate();
  const month = today.slice(0, 7);
  const [sort, setSort] = useState<SortKey>('size');

  // Spending figures count each closed month's house expense.
  const spending = useSpendingView();
  const overview = monthlyOverview(spending, month, today);
  const trends = useMemo(() => overviewTrends(spending, month, today), [spending, month, today]);
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
  const { hide, isHidden } = useHiddenEmis();
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
    ).filter(({ emi }) => !emi || emi.missed || !isHidden(emi.loanId, emi.date)),
    ...budgetReminders(household, today).map(({ line, month: due, amount }) => ({
      label: `${line.name} due ${due === month ? 'this month' : `in ${formatMonth(due).split(' ')[0]}`}, ${formatMoney(amount)}`,
      path: '/analytics/budget',
      state: { open: line.id },
    })),
  ];

  const rows = holdingRows(data, today);
  const categories = portfolioCategories(rows).sort((a, b) =>
    sort === 'gain' ? b.gain - a.gain : b.current - a.current,
  );
  const shown = categories.slice(0, wide ? DASHBOARD_CATEGORIES.wide : DASHBOARD_CATEGORIES.narrow);
  const peak = Math.max(...categories.map((row) => Math.max(row.invested, row.current)), 1);
  const portfolioCurrent = rows.reduce((sum, row) => sum + row.position.current, 0);
  const portfolioInvested = rows.reduce((sum, row) => sum + row.position.invested, 0);
  const portfolioGain = portfolioCurrent - portfolioInvested;

  const invested = investedFromIncome(data);
  // From when tracking began: months before it have no income or spending to compare.
  const since = trackingStart(data) ?? month;
  // Spending without loan repayments, which show as their own part of each bar.
  const repaid = repaymentsByMonth(spending);
  const trend = monthlyTrend(withoutRepayments(spending), month, CHART_MONTHS)
    .filter((row) => row.month >= since)
    .map((row) => ({
      ...row,
      emis: repaid.get(row.month) ?? 0,
      invested: invested.get(row.month) ?? 0,
    }));
  const firstTrend = trend[0]?.month ?? month;
  // Where one month's income went: the last complete month, or this one while it's the only one.
  const splitMonth = trend.length > 1 ? (trend.at(-2)?.month ?? month) : month;
  const inSplit = (row: { date: string }) => row.date.startsWith(splitMonth);
  const splitRows = spending.expenses.filter(inSplit);
  const splitEmis = splitRows
    .filter((row) => isRepayment(row, spending.loans))
    .reduce((total, row) => total + row.amount, 0);
  const splitSpent = splitRows.reduce((total, row) => total + row.amount, 0) - splitEmis;
  const splitIncome = spending.income.filter(inSplit).reduce((total, row) => total + row.amount, 0);
  const splitInvested = invested.get(splitMonth) ?? 0;
  const splitLeft = splitIncome - splitSpent - splitEmis - splitInvested;

  const trendCard = (
    <section className={ui.card}>
      <div className={ui.cardHeader}>
        <div>
          <h2>Income vs expenses and investing</h2>
          <div className={ui.caption}>
            {trend.length > 1
              ? `Last ${trend.length} months · ${formatMonth(firstTrend)} – ${formatMonth(month)}`
              : formatMonth(month)}
          </div>
        </div>
        {phone ? null : (
          <Link className={ui.textLink} to="/analytics">
            View details ›
          </Link>
        )}
      </div>
      <TrendChart months={trend} />
      {phone ? <p className={ui.notice}>Tap a month to see amounts.</p> : null}
      {!phone && splitIncome > 0 ? (
        <div className={styles.split}>
          <h3 className={ui.label}>
            Where {formatMonth(splitMonth)}
            {splitMonth === month ? ' so far' : ''} income went
          </h3>
          <Donut
            centerLabel="Income"
            centerValue={formatAmount(Math.round(splitIncome))}
            segments={[
              { label: 'Spending', value: splitSpent, color: 'var(--series-expense)' },
              { label: 'EMIs', value: splitEmis, color: 'var(--loss)' },
              { label: 'Invested', value: splitInvested, color: 'var(--scenario-base)' },
              {
                label: 'Left in the bank',
                value: Math.max(0, splitLeft),
                color: 'var(--series-income)',
              },
            ].filter((row) => row.value > 0)}
            title={`Where ${formatMonth(splitMonth)} income went`}
          />
          {splitLeft < 0 ? (
            <p className={ui.caption} style={{ margin: 0 }}>
              {formatMoney(Math.round(-splitLeft))} more went out than came in.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );

  return (
    <div className={ui.page}>
      {attention.length > 0 ? (
        <details className={ui.attention}>
          <summary>
            <span className={ui.attentionTitle}>
              <BellRing aria-hidden="true" size={18} />
              Needs attention
              <span className={ui.attentionCount}>{attention.length}</span>
            </span>
            <span className={ui.caption}>Review ›</span>
          </summary>
          <ul className={ui.list} style={{ marginTop: 10 }}>
            {attention.map((item) => {
              const review = (
                <Link
                  aria-label={`Review: ${item.label}`}
                  className={ui.textLink}
                  state={item.state}
                  to={item.path}
                >
                  Review ›
                </Link>
              );
              const emi = 'emi' in item ? item.emi : undefined;
              return (
                <li className={ui.row} key={item.label}>
                  <span className={ui.rowMain}>{item.label}</span>
                  {emi ? (
                    <EmiActions
                      date={emi.date}
                      fallback={review}
                      label={item.label}
                      loanId={emi.loanId}
                      missed={emi.missed}
                      onHide={() => hide(emi.loanId, emi.date)}
                    />
                  ) : (
                    review
                  )}
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}

      <h1 className={homeStyles.greeting}>
        <span>{greeting(new Date().getHours(), '').replace(/,\s*$/, '')}</span>
        {greeting(0, name).includes(',') ? (
          <strong>{greeting(0, name).split(', ')[1]}</strong>
        ) : null}
      </h1>

      <GettingStarted />

      {/* One column on phones; on wide screens, net worth beside this month. */}
      <div className={homeStyles.layout}>
        <div className={homeStyles.column}>
          <NetWorthHero data={data} today={today} />
          <QuickActions />
          <InsightsCard />
        </div>
        <div className={homeStyles.column}>
          <MonthRing
            income={overview.close.income}
            invested={invested.get(month) ?? 0}
            month={month}
            repaid={overview.repaid}
            spent={overview.spent}
            spentChange={trends.expenses.change}
          />
          <ComingUp data={household} today={today} />
          <RecentEntries data={data} />
        </div>
      </div>

      {/* Prompts come after your own figures, never before them. */}
      <RecapCard />
      <InstallCard />
      <GoalsTile />

      {/* Side by side on wide screens, half and half; one after the other on phones. */}
      <div className={styles.pair}>
        {trendCard}

        <section className={ui.card}>
          {/* On phones the sort stays beside the title, with shorter words, not on a line of its own. */}
          <div className={ui.cardHeader} style={phone ? undefined : { flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <h2 className={ui.cardTitle}>Investment portfolio</h2>
              <div className={ui.caption}>Value and returns</div>
            </div>
            <label className={`${ui.caption} ${ui.inlineSort}`}>
              <span className={phone ? ui.visuallyHidden : undefined}>Sort by</span>
              <select
                className={ui.fieldSelect}
                onChange={(event) => setSort(event.target.value as SortKey)}
                value={sort}
              >
                <option value="size">{phone ? 'By size' : 'Portfolio size'}</option>
                <option value="gain">{phone ? 'By gain' : 'Gain'}</option>
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
              View remaining {categories.length - shown.length}{' '}
              {categories.length - shown.length === 1 ? 'investment' : 'investments'} ›
            </Link>
          ) : null}
        </section>
      </div>

      <section className={ui.card}>
        <div className={ui.cardHeader}>
          <h2 className={ui.cardTitle}>Debt summary</h2>
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
    </div>
  );
}
