import { useMemo } from 'react';
import { financialYearLabel } from '../../domain/calendar';
import {
  incomeByMember,
  incomeBySource,
  incomeSteadiness,
  isSalarySource,
  salaryHistory,
  savingsRateByMonth,
  sourceRegularity,
  whereIncomeGoes,
  yearOnYear,
} from '../../domain/income';
import { useSaveSettings, useSettings, useSpendingView } from '../../store/tracker';
import { chartColor, LineChart } from '../../ui/charts';
import { formatAmount, formatShortMonth, formatShortMonthYear, localDate } from '../../ui/format';
import ui from '../../ui/ui.module.css';
import { useIsPhone } from '../../ui/useIsPhone';
import styles from './Income.module.css';

const percent = (share: number) => `${Math.round(share * 100)}%`;
const monthName = (month: string | null) => (month ? formatShortMonthYear(month) : '');

function Change({ value }: { value: number | null }) {
  if (value === null) return <span className={ui.caption}>New</span>;
  const tone = value > 0.005 ? 'up' : value < -0.005 ? 'down' : 'flat';
  return (
    <span className={styles.change} data-tone={tone}>
      {tone === 'flat' ? 'Same' : `${value > 0 ? '+' : '−'}${percent(Math.abs(value))}`}
    </span>
  );
}

/** Where income comes from, how it's changing, and where it goes, for one financial year. */
export function IncomeSection({ year }: { year: number }) {
  const data = useSpendingView();
  const settings = useSettings();
  const save = useSaveSettings();
  const phone = useIsPhone();
  const today = localDate();
  const chosen = settings.salarySources;

  const figures = useMemo(
    () => ({
      sources: incomeBySource(data, year, today, chosen),
      salary: salaryHistory(data, today, chosen),
      yoy: yearOnYear(data, year, today),
      members: incomeByMember(data, year, today, chosen),
      steady: incomeSteadiness(data, today),
      goes: whereIncomeGoes(data, year, today),
      rates: savingsRateByMonth(data, today),
    }),
    [chosen, data, today, year],
  );
  const { sources, salary, yoy, members, steady, goes, rates } = figures;
  const allSources = [...new Set(data.income.map((row) => row.source))].sort();
  const period =
    sources.from && sources.to
      ? `${monthName(sources.from)} to ${monthName(sources.to)}, ${sources.months} month${sources.months === 1 ? '' : 's'}`
      : financialYearLabel(year);

  if (sources.months === 0 || sources.total === 0) {
    return (
      <section aria-label="Income" className={ui.card}>
        <h2 style={{ fontSize: '1.2rem' }}>Income</h2>
        <p className={ui.empty}>
          Once a full month of income is recorded this year, this shows where it comes from and
          where it goes.
        </p>
      </section>
    );
  }

  const peakSource = Math.max(...sources.sources.map((row) => row.total), 1);
  const goesParts = [
    {
      label: 'Spending',
      amount: goes.spending,
      per100: goes.per100.spending,
      color: 'var(--series-expense)',
    },
    { label: 'EMIs', amount: goes.emis, per100: goes.per100.emis, color: chartColor(3) },
    {
      label: 'Savings contributions',
      amount: goes.invested,
      per100: goes.per100.invested,
      color: chartColor(2),
    },
    {
      label: 'Left in the bank',
      amount: goes.left,
      per100: goes.per100.left,
      color: 'var(--accent)',
    },
  ];
  const rateTop = Math.max(...rates.rows.map((row) => Math.abs(row.rate ?? 0)), 0.01);

  return (
    <div className={ui.page}>
      <p className={ui.caption} style={{ margin: 0 }}>
        {period}. Averages count each month from the year's start, or when you started tracking, to
        the last complete month.
      </p>

      <div className={ui.twoColumn}>
        <section aria-label="Where your money comes from" className={ui.card}>
          <h2 style={{ fontSize: '1.2rem' }}>Where your money comes from</h2>
          <div className={styles.split}>
            <div className={styles.figure}>
              <span className={ui.caption}>Salary, a month</span>
              <strong>{formatAmount(sources.salary.monthly)}</strong>
              <small>{formatAmount(sources.salary.total)} this year</small>
            </div>
            <div className={styles.figure}>
              <span className={ui.caption}>Other income, a month</span>
              <strong>{formatAmount(sources.other.monthly)}</strong>
              <small>{formatAmount(sources.other.total)} this year</small>
            </div>
          </div>
          <div aria-hidden="true" className={styles.shareBar}>
            <span style={{ flex: sources.salaryShare, background: 'var(--series-income)' }} />
            <span style={{ flex: 1 - sources.salaryShare, background: chartColor(1) }} />
          </div>
          <p className={ui.caption} style={{ margin: 0 }}>
            {percent(sources.salaryShare)} of your income is salary, and{' '}
            {percent(1 - sources.salaryShare)} comes from other sources. In all,{' '}
            {formatAmount(sources.monthly)} a month on average.
          </p>
          <ul className={styles.sources}>
            {sources.sources.map((row, index) => {
              const regular = row.salary ? null : sourceRegularity(data, row.source, today);
              return (
                <li key={row.source}>
                  <span>
                    <strong>{row.source}</strong>
                    <small>
                      {row.salary ? 'Salary' : 'Other'} · {percent(row.share)}
                      {regular ? ` · came ${regular.came} of the last ${regular.of} months` : ''}
                    </small>
                  </span>
                  <span className={styles.amount}>
                    {formatAmount(row.monthly)}
                    <small>a month</small>
                  </span>
                  <span aria-hidden="true" className={styles.track}>
                    <span
                      style={{
                        width: `${(row.total / peakSource) * 100}%`,
                        background: chartColor(index),
                      }}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
          {allSources.length > 1 ? (
            <details className={ui.fold}>
              <summary>Which sources are salary?</summary>
              <div className={styles.choose}>
                {allSources.map((source) => (
                  <label className={ui.check} key={source}>
                    <input
                      checked={isSalarySource(source, chosen)}
                      onChange={(event) => {
                        const current = allSources.filter((name) => isSalarySource(name, chosen));
                        save({
                          salarySources: event.target.checked
                            ? [...current, source]
                            : current.filter((name) => name !== source),
                        });
                      }}
                      type="checkbox"
                    />
                    {source}
                  </label>
                ))}
              </div>
              <p className={ui.caption}>
                {chosen.length > 0
                  ? 'Your choice is saved.'
                  : 'Until you choose, any source with salary or pay in its name counts.'}
              </p>
            </details>
          ) : null}
        </section>

        <section aria-label="Salary over time" className={ui.card}>
          <h2 style={{ fontSize: '1.2rem' }}>Salary over time</h2>
          {salary.points.some((point) => point.amount > 0) ? (
            <>
              <LineChart
                narrow={phone}
                plain
                series={[
                  {
                    name: 'Salary',
                    color: 'var(--series-income)',
                    points: salary.points.map((point) => ({
                      label: `${formatShortMonth(point.month)} ${point.month.slice(2, 4)}`,
                      value: point.amount,
                    })),
                  },
                ]}
                title="Salary each month"
              />
              {salary.raises.length > 0 ? (
                <ul className={styles.raises}>
                  {salary.raises.map((raise) => (
                    <li key={raise.month}>
                      {percent(raise.change)} raise in {monthName(raise.month)}:{' '}
                      {formatAmount(raise.from)} to {formatAmount(raise.to)} a month
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={ui.caption}>No raise found yet in the months recorded.</p>
              )}
              {salary.yearlyGrowth !== null ? (
                <p className={ui.caption} style={{ margin: 0 }}>
                  Your salary has grown about {percent(salary.yearlyGrowth)} a year since{' '}
                  {monthName(salary.points.find((point) => point.amount > 0)?.month ?? null)}.
                </p>
              ) : null}
            </>
          ) : (
            <p className={ui.empty}>No salary recorded yet.</p>
          )}
        </section>
      </div>

      <div className={ui.twoColumn}>
        <section aria-label="This year against last year" className={ui.card}>
          <h2 style={{ fontSize: '1.2rem' }}>This year against last year</h2>
          <p className={ui.caption} style={{ margin: 0 }}>
            {yoy.from && yoy.to
              ? `${monthName(yoy.from)} to ${monthName(yoy.to)}, against the same months a year before`
              : ''}
          </p>
          {yoy.lastYear === 0 ? (
            <p className={ui.empty}>Nothing recorded for the same months last year to compare.</p>
          ) : (
            <ul className={ui.list}>
              {yoy.rows.map((row) => (
                <li className={ui.row} key={row.source}>
                  <div className={ui.rowMain}>
                    <div className={ui.rowTitle}>{row.source}</div>
                    <div className={ui.rowDetail}>
                      {formatAmount(row.lastYear)} → {formatAmount(row.thisYear)}
                    </div>
                  </div>
                  <Change value={row.change} />
                </li>
              ))}
              <li className={ui.row}>
                <div className={ui.rowMain}>
                  <div className={ui.rowTitle}>All income</div>
                  <div className={ui.rowDetail}>
                    {formatAmount(yoy.lastYear)} → {formatAmount(yoy.thisYear)}
                  </div>
                </div>
                <Change value={yoy.change} />
              </li>
            </ul>
          )}
        </section>

        <section aria-label="Who earns what" className={ui.card}>
          <h2 style={{ fontSize: '1.2rem' }}>Who earns what</h2>
          <ul className={styles.sources}>
            {members.map((row) => (
              <li key={row.member}>
                <span>
                  <strong>{row.member || 'Household'}</strong>
                  <small>
                    {percent(row.share)} of income · salary {formatAmount(row.salary)} · other{' '}
                    {formatAmount(row.other)}
                  </small>
                </span>
                <span className={styles.amount}>{formatAmount(row.total)}</span>
                <span aria-hidden="true" className={`${styles.track} ${styles.shareBar}`}>
                  {row.salary > 0 ? (
                    <span style={{ flex: row.salary, background: 'var(--series-income)' }} />
                  ) : null}
                  {row.other > 0 ? (
                    <span style={{ flex: row.other, background: chartColor(1) }} />
                  ) : null}
                  <span
                    style={{
                      flex: Math.max(0, sources.total - row.total),
                      background: 'transparent',
                    }}
                  />
                </span>
              </li>
            ))}
          </ul>
          <ul className={styles.legend}>
            <li>
              <i style={{ background: 'var(--series-income)' }} /> Salary
            </li>
            <li>
              <i style={{ background: chartColor(1) }} /> Other
            </li>
          </ul>
        </section>
      </div>

      <div className={ui.twoColumn}>
        <section aria-label="Where each ₹100 goes" className={ui.card}>
          <h2 style={{ fontSize: '1.2rem' }}>Where each ₹100 goes</h2>
          <div aria-hidden="true" className={styles.shareBar} style={{ height: 18 }}>
            {goesParts
              .filter((part) => part.per100 > 0)
              .map((part) => (
                <span key={part.label} style={{ flex: part.per100, background: part.color }} />
              ))}
          </div>
          <ul className={styles.legend} style={{ display: 'grid', gap: 8 }}>
            {goesParts.map((part) => (
              <li key={part.label} style={{ justifyContent: 'space-between' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <i style={{ background: part.color }} /> {part.label}
                </span>
                <span>
                  <b>₹{Math.round(part.per100)}</b>{' '}
                  <span className={ui.caption}>({formatAmount(part.amount)})</span>
                </span>
              </li>
            ))}
          </ul>
          <p className={ui.caption} style={{ margin: 0 }}>
            Of the {formatAmount(goes.income)} earned. What's left stays in the bank, which isn't
            counted in net worth.
          </p>
        </section>

        <section aria-label="How steady your income is" className={ui.card}>
          <h2 style={{ fontSize: '1.2rem' }}>How steady your income is</h2>
          {steady ? (
            <>
              <p className={ui.caption} style={{ margin: 0 }}>
                Over the last {steady.months} months, your income <strong>{steady.verdict}</strong>:
                it's usually within {percent(steady.spread)} of the average.
              </p>
              <div className={styles.split}>
                <div className={styles.figure}>
                  <span className={ui.caption}>Average a month</span>
                  <strong>{formatAmount(steady.average)}</strong>
                  <small>
                    {steady.below} month{steady.below === 1 ? '' : 's'} below it
                  </small>
                </div>
                <div className={styles.figure}>
                  <span className={ui.caption}>Best and worst</span>
                  <strong>{formatAmount(steady.best?.amount ?? 0)}</strong>
                  <small>
                    {monthName(steady.best?.month ?? null)}, lowest{' '}
                    {formatAmount(steady.worst?.amount ?? 0)} in{' '}
                    {monthName(steady.worst?.month ?? null)}
                  </small>
                </div>
              </div>
            </>
          ) : (
            <p className={ui.empty}>Three months of income are needed to judge this.</p>
          )}
        </section>
      </div>

      <section aria-label="Savings rate by month" className={ui.card}>
        <div className={ui.split}>
          <h2 style={{ fontSize: '1.2rem' }}>Savings rate by month</h2>
          {rates.average !== null ? (
            <span className={ui.chip}>Average {percent(rates.average)}</span>
          ) : null}
        </div>
        <p className={ui.caption} style={{ margin: 0 }}>
          The share of each month's income left after all spending, including EMIs.
        </p>
        <div
          className={styles.rates}
          role="img"
          aria-label={rates.rows
            .map(
              (row) =>
                `${monthName(row.month)} ${row.rate === null ? 'no income' : percent(row.rate)}`,
            )
            .join(', ')}
        >
          {rates.rows.map((row) => (
            <div className={styles.rate} data-negative={(row.rate ?? 0) < 0} key={row.month}>
              <b>{row.rate === null ? '—' : percent(row.rate)}</b>
              <span style={{ height: `${(Math.abs(row.rate ?? 0) / rateTop) * 100}%` }} />
            </div>
          ))}
        </div>
        <div aria-hidden="true" className={styles.rateLabels}>
          {rates.rows.map((row) => (
            <span key={row.month}>{formatShortMonth(row.month)}</span>
          ))}
        </div>
      </section>
    </div>
  );
}
