import { useState } from 'react';
import {
  balanceTrend,
  debtProgress,
  financialSummary,
  financialYearsWithData,
  holdingRows,
  memberContributions,
  memberPositions,
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
import { NetWorthHistory } from './NetWorthHistory';

type Allocation = 'all' | 'retirement';
type ReturnsView = 'holdings' | 'family';

function ViewDetails({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <details className={ui.fold}>
      <summary>View Details</summary>
      <div aria-label="Scrollable table" className={ui.tableWrap} role="group" tabIndex={0}>
        <table className={ui.table}>
          <thead>
            <tr>
              {headers.map((header, index) => (
                <th className={index > 0 ? ui.numeric : undefined} key={header}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.join('|')}>
                {row.map((cell, index) => (
                  <td className={index > 0 ? ui.numeric : undefined} key={`${index}-${cell}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
type Trend = 'surplus' | 'pms';

const RETURN_ROWS = 5;

const monthsLabel = (count: number, noun: string) =>
  count === 0 ? `No ${noun} entries recorded` : `Across ${count} months with ${noun} entries`;

export function AnalyticsPage() {
  const data = useView();
  const today = localDate();
  const [year, setYear] = useState(financialYearStart(today));
  const [allocation, setAllocation] = useState<Allocation>('all');
  const [trend, setTrend] = useState<Trend>('surplus');
  const [returnsView, setReturnsView] = useState<ReturnsView>('holdings');

  const summary = financialSummary(data, year, today);
  const worth = netWorth(data, today);
  const debts = debtProgress(data, today);
  const rows = holdingRows(data, today);
  const categories = portfolioCategories(
    allocation === 'all' ? rows : rows.filter((row) => row.holding.kind !== 'investment'),
  );
  const allocationTotal = categories.reduce((sum, row) => sum + row.current, 0);
  const returnsRows =
    returnsView === 'family'
      ? memberPositions(rows).map(({ member, invested, gain }) => ({
          label: member,
          invested,
          gain,
        }))
      : [...rows]
          .sort((a, b) => b.position.gain - a.position.gain)
          .slice(0, RETURN_ROWS)
          .map(({ holding, position }) => ({
            label: holding.name,
            invested: position.invested,
            gain: position.gain,
          }));
  const returnsPeak = Math.max(
    ...returnsRows.map((row) => row.invested + Math.max(0, row.gain)),
    1,
  );
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
      <NetWorthHistory />
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
          <details className={ui.fold}>
            <summary>About these averages</summary>
            <p className={ui.caption}>
              Each average divides the financial year's total by the months that have entries, so
              months with nothing recorded don't pull it down.
            </p>
          </details>
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
          <ViewDetails
            headers={['Item', 'Amount', 'Share of income']}
            rows={[
              ['Income', summary.income],
              ['Expenses', summary.expenses],
              ['Stallion', summary.pms],
              ['NPS + PPF', summary.npsPpf],
              ['Cash remaining', summary.remaining],
            ].map(([label, value]) => [
              String(label),
              formatMoney(Number(value)),
              summary.income > 0 ? formatPercent(Number(value) / summary.income) : '—',
            ])}
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
          <ViewDetails
            headers={['Month', trend === 'surplus' ? 'Balance' : 'Profit']}
            rows={points.map((row) => [row.label, formatMoney(row.value)])}
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
          <ViewDetails
            headers={['Asset', 'Invested', 'Current', 'Share']}
            rows={categories.map((row) => [
              row.name,
              formatMoney(row.invested),
              formatMoney(row.current),
              formatPercent(allocationTotal > 0 ? row.current / allocationTotal : 0),
            ])}
          />
        </section>
        <section className={ui.card}>
          <div className={ui.cardHeader} style={{ flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.2rem' }}>Investment Returns</h2>
            <select
              aria-label="Returns view"
              className={ui.fieldSelect}
              onChange={(event) => setReturnsView(event.target.value as ReturnsView)}
              value={returnsView}
            >
              <option value="holdings">Returns vs. Invested</option>
              <option value="family">Family Split</option>
            </select>
          </div>
          {returnsRows.length === 0 ? (
            <p className={ui.empty}>No holdings yet.</p>
          ) : (
            <ul className={ui.list}>
              {returnsRows.map((row) => (
                <li className={ui.row} key={row.label}>
                  <div className={ui.rowMain}>
                    <div className={ui.rowTitle}>{row.label}</div>
                    <div className={ui.rowDetail}>Invested {formatCompactMoney(row.invested)}</div>
                    <div className={ui.stack} style={{ marginTop: 6 }}>
                      <span
                        className={ui.stackInvested}
                        style={{ width: `${(row.invested / returnsPeak) * 100}%` }}
                      />
                      <span
                        className={ui.stackGain}
                        style={{ width: `${(Math.max(0, row.gain) / returnsPeak) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className={`${ui.amount} ${row.gain < 0 ? ui.loss : ui.gain}`}>
                    {formatMoney(row.gain)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {returnsView === 'holdings' && rows.length > RETURN_ROWS ? (
            <div className={ui.caption}>
              Showing top {RETURN_ROWS} of {rows.length} holdings. View Details shows all.
            </div>
          ) : null}
          <ViewDetails
            headers={['Holding', 'Invested', 'Current', 'Gain', 'XIRR']}
            rows={rows.map(({ holding, position }) => [
              holding.name,
              formatMoney(position.invested),
              formatMoney(position.current),
              formatMoney(position.gain),
              formatPercent(position.xirr, 2),
            ])}
          />
        </section>
        <section className={ui.card}>
          <h2 style={{ fontSize: '1.2rem' }}>Debt Reduction Progress</h2>
          <div className={ui.meter} style={{ height: 22, borderRadius: 8 }}>
            <span className={ui.meterFill} style={{ width: `${debts.paidShare * 100}%` }} />
            <span className={ui.meterDebt} style={{ flex: 1 }} />
          </div>
          <div className={ui.metricsTwo}>
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
