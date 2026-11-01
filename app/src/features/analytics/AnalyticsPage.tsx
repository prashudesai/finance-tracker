import { useState } from 'react';
import {
  balanceTrend,
  debtProgress,
  financialSummary,
  financialYearsWithData,
  holdingRows,
  memberContributions,
  netWorth,
  pmsGainTrend,
  portfolioCategories,
} from '../../domain/analytics';
import { financialYearLabel, financialYearStart } from '../../domain/calendar';
import { useView } from '../../store/tracker';
import { ColumnChart, Donut, LineChart } from '../../ui/charts';
import {
  formatCompactMoney,
  formatMoney,
  formatMonth,
  formatPercent,
  localDate,
} from '../../ui/format';
import { Metric } from '../../ui/Stat';
import ui from '../../ui/ui.module.css';

type Allocation = 'all' | 'retirement';
type Trend = 'surplus' | 'pms';

const monthsLabel = (count: number, noun: string) =>
  count === 0 ? `No ${noun} entries recorded` : `Across ${count} months with ${noun} entries`;

export function AnalyticsPage() {
  const data = useView();
  const today = localDate();
  const [year, setYear] = useState(financialYearStart(today));
  const [allocation, setAllocation] = useState<Allocation>('all');
  const [trend, setTrend] = useState<Trend>('surplus');

  const summary = financialSummary(data, year, today);
  const worth = netWorth(data, today);
  const debts = debtProgress(data, today);
  const rows = holdingRows(data, today);
  const categories = portfolioCategories(
    allocation === 'all' ? rows : rows.filter((row) => row.holding.kind !== 'investment'),
  );
  const allocationTotal = categories.reduce((sum, row) => sum + row.current, 0);
  const returns = [...rows]
    .sort((a, b) => b.position.gain - a.position.gain)
    .slice(0, 5)
    .map((row) => ({ label: row.holding.name, value: row.position.gain }));
  const members = memberContributions(data, year);
  const points = (trend === 'surplus' ? balanceTrend(data, year) : pmsGainTrend(data)).map(
    (row) => ({
      label: new Date(`${row.month}-01T00:00:00`).toLocaleDateString('en-IN', {
        month: 'short',
        year: '2-digit',
      }),
      value: row.value,
    }),
  );
  const retirementTotal = rows
    .filter((row) => row.holding.kind !== 'investment')
    .map((row) => ({ label: row.holding.name, value: row.position.current }));

  return (
    <div className={ui.page}>
      <div className={ui.split}>
        <span />
        <label className={ui.caption}>
          Financial year{' '}
          <select
            className={ui.fieldSelect}
            onChange={(event) => setYear(Number(event.target.value))}
            value={year}
          >
            {financialYearsWithData(data, today).map((value) => (
              <option key={value} value={value}>
                {financialYearLabel(value)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={ui.twoColumn}>
        <section className={ui.card}>
          <div className={ui.split}>
            <h2 style={{ fontSize: '1.2rem' }}>Financial Summary</h2>
            <span className={ui.caption}>Assets, debts and returns are current</span>
          </div>
          <div className={ui.metrics}>
            <Metric label="FY income" tone={ui.gain} value={formatMoney(summary.income)} />
            <Metric label="FY expenses" tone={ui.loss} value={formatMoney(summary.expenses)} />
            <Metric
              label="FY net cash surplus"
              tone={summary.surplus < 0 ? ui.loss : ui.gain}
              value={formatMoney(summary.surplus)}
            />
            <Metric
              label="Investment returns"
              tone={ui.gain}
              value={formatMoney(summary.returns)}
            />
            <Metric
              label="Retirement funds"
              tone={ui.gain}
              value={formatMoney(summary.retirement)}
            />
            <Metric label="FY recorded contributions" value={formatMoney(summary.contributions)} />
          </div>
          <div className={ui.metric}>
            <div className={ui.split}>
              <span>Net Worth · current</span>
              <strong>{formatMoney(worth.netWorth)}</strong>
            </div>
            <div className={ui.meter} style={{ height: 7, margin: '8px 0' }}>
              <span className={ui.meterFill} style={{ width: `${worth.assetShare * 100}%` }} />
            </div>
            <div className={ui.meterLegend}>
              <span>Assets {formatMoney(worth.assets)}</span>
              <span>Debts {formatMoney(worth.debts)}</span>
            </div>
          </div>
        </section>

        <section className={ui.card}>
          <h2 style={{ fontSize: '1.2rem' }}>Average Monthly Snapshot</h2>
          <div className={ui.metricsTwo}>
            <Metric
              detail={monthsLabel(summary.incomeMonths, 'income')}
              label="Income average"
              tone={ui.gain}
              value={formatCompactMoney(summary.averageIncome)}
            />
            <Metric
              detail={monthsLabel(summary.expenseMonths, 'expense')}
              label="Expense average"
              value={formatCompactMoney(summary.averageExpenses)}
            />
            <Metric
              detail={monthsLabel(summary.contributionMonths, 'contribution')}
              label="Investment contributions"
              value={formatCompactMoney(summary.averageContributions)}
            />
            <Metric
              detail="Based on recorded FY totals"
              label="Expense / income"
              tone={ui.gain}
              value={formatPercent(summary.expenseRatio)}
            />
          </div>
          <div className={ui.metric}>
            <div className={ui.split}>
              <span className={ui.caption}>Reported expenses as a share of income</span>
              <strong>{formatPercent(summary.expenseRatio)}</strong>
            </div>
            <div className={ui.meter} style={{ height: 7, marginTop: 8 }}>
              <span
                className={ui.meterFill}
                style={{ width: `${Math.min(1, summary.expenseRatio ?? 0) * 100}%` }}
              />
            </div>
          </div>
        </section>
      </div>

      <div className={ui.twoColumn}>
        <section className={ui.card}>
          <h2 style={{ fontSize: '1.2rem' }}>FY Income &amp; Cash Outflows</h2>
          <ColumnChart
            bars={[
              { label: 'Income', value: summary.income },
              { label: 'Expenses', value: summary.expenses },
              { label: 'Stallion', value: summary.pms },
              { label: 'NPS + PPF', value: summary.npsPpf },
              { label: 'Cash remaining', value: summary.remaining },
            ]}
            title="Income and cash outflows for the financial year"
          />
        </section>
        <section className={ui.card}>
          <div className={ui.cardHeader} style={{ flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.2rem' }}>
              {trend === 'surplus' ? 'Monthly Surplus Balance Trend' : 'Stallion PMS Profit Trend'}
            </h2>
            <select
              aria-label="Trend"
              className={ui.fieldSelect}
              onChange={(event) => setTrend(event.target.value as Trend)}
              value={trend}
            >
              <option value="surplus">Monthly Surplus</option>
              <option value="pms">Stallion PMS</option>
            </select>
          </div>
          <LineChart
            series={[{ name: trend === 'surplus' ? 'Balance' : 'Profit', points }]}
            title="Trend by month"
          />
        </section>
      </div>

      <div className={ui.threeColumn}>
        <section className={ui.card}>
          <div className={ui.cardHeader} style={{ flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.2rem' }}>Asset Allocation</h2>
            <select
              aria-label="Allocation scope"
              className={ui.fieldSelect}
              onChange={(event) => setAllocation(event.target.value as Allocation)}
              value={allocation}
            >
              <option value="all">All Assets</option>
              <option value="retirement">Retirement Only</option>
            </select>
          </div>
          {categories.length === 0 ? (
            <p className={ui.empty}>No holdings yet.</p>
          ) : (
            <Donut
              centerLabel="Total assets"
              centerValue={formatCompactMoney(allocationTotal)}
              segments={categories.map((row) => ({ label: row.name, value: row.current }))}
              title="Asset allocation"
            />
          )}
        </section>
        <section className={ui.card}>
          <h2 style={{ fontSize: '1.2rem' }}>Investment Returns</h2>
          {returns.length === 0 ? (
            <p className={ui.empty}>No holdings yet.</p>
          ) : (
            <ul className={ui.list}>
              {returns.map((row) => (
                <li className={ui.row} key={row.label}>
                  <div className={ui.rowMain}>{row.label}</div>
                  <span className={`${ui.amount} ${row.value < 0 ? ui.loss : ui.gain}`}>
                    {formatMoney(row.value)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className={ui.caption}>Showing top 5 holdings by gain.</div>
        </section>
        <section className={ui.card}>
          <h2 style={{ fontSize: '1.2rem' }}>Debt Reduction Progress</h2>
          <div className={ui.meter} style={{ height: 22, borderRadius: 8 }}>
            <span className={ui.meterFill} style={{ width: `${debts.paidShare * 100}%` }} />
            <span className={ui.meterDebt} style={{ flex: 1 }} />
          </div>
          <div className={ui.metrics}>
            <Metric
              detail={formatPercent(debts.paidShare)}
              label="Paid"
              value={formatMoney(debts.paid)}
            />
            <Metric
              detail={formatPercent(1 - debts.paidShare)}
              label="Remaining"
              value={formatMoney(debts.remaining)}
            />
          </div>
        </section>
      </div>

      <div className={ui.twoColumn}>
        <section className={ui.card}>
          <h2 style={{ fontSize: '1.2rem' }}>Retirement Funds Breakdown</h2>
          {retirementTotal.length === 0 ? (
            <p className={ui.empty}>No retirement accounts yet.</p>
          ) : (
            <ColumnChart bars={retirementTotal} title="Retirement funds" />
          )}
        </section>
        <section className={ui.card}>
          <h2 style={{ fontSize: '1.2rem' }}>Family Member Contributions</h2>
          <div className={ui.caption}>{financialYearLabel(year)}</div>
          {members.length === 0 ? (
            <p className={ui.empty}>No contributions in {formatMonth(today.slice(0, 7))}'s year.</p>
          ) : (
            <ul className={ui.list}>
              {members.map((row) => (
                <li className={ui.row} key={row.member}>
                  <div className={ui.rowMain}>{row.member}</div>
                  <span className={ui.amount}>{formatMoney(row.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
