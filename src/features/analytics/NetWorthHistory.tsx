import { TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { netWorthHistory } from '../../domain/analytics';
import { useIsPhone } from '../../ui/useIsPhone';
import { useView } from '../../store/tracker';
import { LineChart } from '../../ui/charts';
import { EmptyState } from '../../ui/EmptyState';
import { formatMoney, formatMonth, localDate } from '../../ui/format';
import ui from '../../ui/ui.module.css';

const RANGES = [
  { months: 12, label: '1 year' },
  { months: 36, label: '3 years' },
  { months: 60, label: 'All' },
];
const MIN_MONTHS = 2;

const shortMonth = (month: string) => {
  const [name = '', year = ''] = formatMonth(month).split(' ');
  return `${name.slice(0, 3)} ${year.slice(-2)}`;
};

export function NetWorthHistory() {
  const data = useView();
  const today = localDate();
  const phone = useIsPhone();
  const [range, setRange] = useState(12);
  const [picked, setPicked] = useState<number | null>(null);
  const history = useMemo(() => netWorthHistory(data, today), [data, today]);
  const rows = history.slice(-range);

  if (rows.length < MIN_MONTHS) {
    return (
      <section className={ui.card}>
        <h2 style={{ fontSize: '1.2rem' }}>Net worth history</h2>
        <EmptyState
          icon={TrendingUp}
          text="Your chart starts once you've tracked accounts for two months."
          title="Your history will appear here"
        />
      </section>
    );
  }

  const shown = picked !== null && picked < rows.length ? picked : rows.length - 1;
  const row = rows[shown] ?? rows[rows.length - 1];
  const before = rows[shown - 1];
  const change = row && before ? row.netWorth - before.netWorth : null;
  const series = (name: string, color: string, value: (item: (typeof rows)[number]) => number) => ({
    name,
    color,
    points: rows.map((item) => ({ label: shortMonth(item.month), value: value(item) })),
  });

  return (
    <section aria-label="Net worth history" className={ui.card}>
      <div className={ui.cardHeader} style={{ flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '1.2rem' }}>Net worth history</h2>
        <div aria-label="Chart range" className={ui.segmented} role="group">
          {RANGES.map(({ months, label }) => (
            <button
              aria-pressed={range === months}
              className={range === months ? ui.segmentActive : ui.segment}
              key={months}
              onClick={() => {
                setRange(months);
                setPicked(null);
              }}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <LineChart
        narrow={phone}
        onPick={setPicked}
        picked={shown}
        plain
        series={[
          series('Net worth', 'var(--accent)', (item) => item.netWorth),
          { ...series('Assets', 'var(--scenario-base)', (item) => item.assets), dash: '6 4' },
          { ...series('Debts', 'var(--debt)', (item) => item.debts), dash: '2 4' },
        ]}
        title="Net worth, assets and debts at each month end"
      />
      {row ? (
        <div className={ui.metric}>
          <strong>{formatMonth(row.month)}</strong>
          <div className={ui.compact} style={{ marginTop: 6 }}>
            <div className={ui.metric}>
              <div className={ui.label}>Net worth</div>
              <div className={ui.metricValue}>{formatMoney(row.netWorth)}</div>
            </div>
            <div className={ui.metric}>
              <div className={ui.label}>Change</div>
              <div className={ui.metricValue}>
                {change === null
                  ? '—'
                  : `${change < 0 ? '−' : '+'}${formatMoney(Math.abs(change))}`}
              </div>
            </div>
            <div className={ui.metric}>
              <div className={ui.label}>Assets</div>
              <div className={ui.metricValue}>{formatMoney(row.assets)}</div>
            </div>
            <div className={ui.metric}>
              <div className={ui.label}>Debts</div>
              <div className={ui.metricValue}>{formatMoney(row.debts)}</div>
            </div>
          </div>
          {row.estimated ? (
            <p className={ui.caption} style={{ marginTop: 6 }}>
              Estimate: some market values weren't updated this month.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
