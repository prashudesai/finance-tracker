import { CalendarRange, FileText } from 'lucide-react';
import { financialYearLabel } from '../../domain/calendar';
import { yearSummary } from '../../domain/yearSummary';
import type { TrackerData } from '../../data/repository';
import { formatMoney, formatMonth, formatPercent, signedMoney } from '../../ui/format';
import { downloadTablePdf, pdfAmount } from '../../ui/pdf';
import { Metric } from '../../ui/Stat';
import ui from '../../ui/ui.module.css';

const PPF_LIMIT = 1_50_000;

/** A financial year on one card, with a PDF for tax time. */
export function YearAtGlance({
  data,
  fy,
  today,
  onError,
}: {
  data: TrackerData;
  fy: number;
  today: string;
  onError: (message: string) => void;
}) {
  const year = yearSummary(data, fy, today);
  if (!year) return null;
  const label = financialYearLabel(fy);
  const running = year.to >= today.slice(0, 7);
  const change = year.netWorth ? year.netWorth.end - year.netWorth.start : null;
  const kept = year.income - year.spent;

  const lines: [string, string][] = [
    ['Income', pdfAmount(year.income)],
    ['Spent, including unrecorded and EMIs', pdfAmount(year.spent)],
    ['  of which EMIs', pdfAmount(year.emis)],
    ['Invested from income', pdfAmount(year.invested)],
    ['Kept after spending', pdfAmount(kept)],
    ['Savings rate', year.savingsRate === null ? '-' : formatPercent(year.savingsRate, 0)],
    ...(year.netWorth
      ? ([
          ['Net worth at the start', pdfAmount(year.netWorth.start)],
          ['Net worth at the end', pdfAmount(year.netWorth.end)],
        ] as [string, string][])
      : []),
    ...year.topCategories.map((row): [string, string] => [
      `Spent on ${row.category}`,
      pdfAmount(row.amount),
    ]),
    ['Paid into PPF', pdfAmount(year.ppf)],
    ['Paid into NPS', pdfAmount(year.nps)],
  ];

  return (
    <section aria-label={`${label} at a glance`} className={ui.hero}>
      <div className={ui.cardHeader} style={{ flexWrap: 'wrap' }}>
        <div className={ui.cardHeader} style={{ justifyContent: 'flex-start' }}>
          <span aria-hidden="true" className={ui.tileIcon}>
            <CalendarRange size={20} />
          </span>
          <div>
            <h2 className={ui.cardTitle}>
              {label} at a glance{running ? ', so far' : ''}
            </h2>
            <div className={ui.caption}>
              {formatMonth(year.from)} to {formatMonth(year.to)} · {year.months} months
            </div>
          </div>
        </div>
        <button
          className={ui.quiet}
          onClick={() =>
            void downloadTablePdf({
              title: `${label} at a glance`,
              subtitle: `${formatMonth(year.from)} to ${formatMonth(year.to)} · Amounts in INR`,
              columns: [
                { label: 'Item', width: 180 },
                { label: 'Amount', width: 60, numeric: true },
              ],
              rows: lines.map(([item, amount]) => [item, amount]),
              file: `finance-${label.replace(/\s/g, '-').toLowerCase()}.pdf`,
            }).catch(() => onError('The PDF could not be created. Please try again.'))
          }
          type="button"
        >
          <FileText size={16} /> Save as PDF
        </button>
      </div>
      <div className={ui.metricsTwo}>
        <Metric label="Income" value={formatMoney(year.income)} />
        <Metric label="Spent" value={formatMoney(year.spent)} />
        <Metric label="Invested from income" value={formatMoney(year.invested)} />
        <Metric
          label="Savings rate"
          value={year.savingsRate === null ? '—' : formatPercent(year.savingsRate, 0)}
        />
      </div>
      <ul className={ui.list}>
        {change !== null && year.netWorth ? (
          <li className={ui.row}>
            <span className={ui.rowMain}>Net worth</span>
            <span className={`${ui.amount} ${change < 0 ? ui.loss : ui.gain}`}>
              {signedMoney(change)}
              <span className={ui.caption} style={{ display: 'block', fontWeight: 400 }}>
                {formatMoney(year.netWorth.start)} → {formatMoney(year.netWorth.end)}
              </span>
            </span>
          </li>
        ) : null}
        {year.best && year.worst ? (
          <li className={ui.row}>
            <span className={ui.rowMain}>Income kept</span>
            <span className={ui.amount} style={{ textAlign: 'right' }}>
              <span style={{ display: 'block', fontWeight: 400 }}>
                Best: {formatMonth(year.best.month).split(' ')[0]},{' '}
                {formatPercent(year.best.rate, 0)}
              </span>
              <span style={{ display: 'block', fontWeight: 400 }}>
                Lowest: {formatMonth(year.worst.month).split(' ')[0]},{' '}
                {formatPercent(year.worst.rate, 0)}
              </span>
            </span>
          </li>
        ) : null}
        {year.topCategories.length > 0 ? (
          <li className={ui.row}>
            <span className={ui.rowMain}>
              Most spent on
              <span className={ui.caption} style={{ display: 'block' }}>
                Recorded spending
              </span>
            </span>
            <span className={ui.amount} style={{ textAlign: 'right' }}>
              {year.topCategories.map((row) => (
                <span key={row.category} style={{ display: 'block', fontWeight: 400 }}>
                  {row.category} {formatMoney(row.amount)}
                </span>
              ))}
            </span>
          </li>
        ) : null}
        {year.ppf > 0 || year.nps > 0 ? (
          <li className={ui.row}>
            <span className={ui.rowMain}>
              For tax
              <span className={ui.caption} style={{ display: 'block' }}>
                PPF counts under 80C, up to {formatMoney(PPF_LIMIT)} an account
              </span>
            </span>
            <span className={ui.amount} style={{ textAlign: 'right' }}>
              <span style={{ display: 'block', fontWeight: 400 }}>PPF {formatMoney(year.ppf)}</span>
              <span style={{ display: 'block', fontWeight: 400 }}>NPS {formatMoney(year.nps)}</span>
            </span>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
