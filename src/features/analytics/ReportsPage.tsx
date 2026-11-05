import { Download, FileText, Printer } from 'lucide-react';
import { useState } from 'react';
import {
  addMonths,
  financialYearLabel,
  financialYearRange,
  financialYearStart,
} from '../../domain/calendar';
import { financialYearsWithData } from '../../domain/analytics';
import {
  groupTotals,
  reportCsv,
  reportRows,
  REPORT_TYPES,
  type ReportType,
} from '../../domain/reports';
import { useTracker, useSpendingView } from '../../store/tracker';
import { downloadText } from '../../ui/download';
import { Field } from '../../ui/Field';
import { formatDay, formatMoney, localDate } from '../../ui/format';
import { downloadTablePdf, pdfAmount } from '../../ui/pdf';
import { Metric } from '../../ui/Stat';
import ui from '../../ui/ui.module.css';
import { useIsPhone } from '../../ui/useIsPhone';

const ROW_LIMIT = 200;
const PHONE_ROWS = 20;

export function ReportsPage() {
  const data = useSpendingView();
  const report = useTracker((state) => state.report);
  const today = localDate();
  const thisFy = financialYearStart(today);
  const [start, setStart] = useState(financialYearRange(thisFy).start);
  const [end, setEnd] = useState(today);
  const [type, setType] = useState<ReportType>('all');
  const phone = useIsPhone();
  const [phoneRows, setPhoneRows] = useState(PHONE_ROWS);

  const presets: [string, () => void][] = [
    [
      'This month',
      () => {
        setStart(`${today.slice(0, 7)}-01`);
        setEnd(today);
      },
    ],
    [
      'This FY',
      () => {
        setStart(financialYearRange(thisFy).start);
        setEnd(today);
      },
    ],
    [
      'Last FY',
      () => {
        const range = financialYearRange(thisFy - 1);
        setStart(range.start);
        setEnd(range.end);
      },
    ],
    [
      'Last 3 months',
      () => {
        setStart(addMonths(today, -3));
        setEnd(today);
      },
    ],
  ];

  const rows = start && end && start <= end ? reportRows(data, start, end, type) : [];
  const totals = groupTotals(rows);
  const years = financialYearsWithData(data, today);

  return (
    <div className={ui.page}>
      <section className={ui.card}>
        <div>
          <div className={ui.label}>Quick period</div>
          <div className={ui.actions} style={{ flexWrap: 'wrap', marginTop: 8 }}>
            {presets.map(([label, apply]) => (
              <button className={ui.quiet} key={label} onClick={apply} type="button">
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className={ui.form}>
          <Field label="Financial year">
            <select
              onChange={(event) => {
                if (!event.target.value) return;
                const range = financialYearRange(Number(event.target.value));
                setStart(range.start);
                setEnd(range.end);
              }}
              value=""
            >
              <option value="">Custom date range</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {financialYearLabel(year)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="From date">
            <input onChange={(event) => setStart(event.target.value)} type="date" value={start} />
          </Field>
          <Field label="To date">
            <input onChange={(event) => setEnd(event.target.value)} type="date" value={end} />
          </Field>
          <Field label="Report type">
            <select onChange={(event) => setType(event.target.value as ReportType)} value={type}>
              {REPORT_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className={ui.caption}>
          Both dates are included. Downloads follow the selected family profile.
        </div>
      </section>

      {start > end ? (
        <p className={ui.notice} role="alert">
          The start date must be on or before the end date.
        </p>
      ) : null}

      {totals.length > 0 ? (
        <section aria-label="Report summary" className={ui.metrics}>
          {totals.map((row) => (
            <Metric key={row.group} label={row.group} value={formatMoney(row.amount)} />
          ))}
        </section>
      ) : null}

      <section className={ui.card}>
        <div className={ui.cardHeader} style={{ flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '1.2rem' }}>
            {rows.length} {rows.length === 1 ? 'record' : 'records'}
          </h2>
          <div className={ui.actions}>
            <button
              className={ui.quiet}
              disabled={rows.length === 0}
              onClick={() =>
                downloadText(`finance-report-${start}-to-${end}.csv`, reportCsv(rows), 'text/csv')
              }
              type="button"
            >
              <Download size={16} /> CSV
            </button>
            <button
              className={ui.quiet}
              disabled={rows.length === 0}
              onClick={() =>
                void downloadTablePdf({
                  title: 'Finance report',
                  subtitle: `${start} to ${end} · ${rows.length} records · Amounts in INR`,
                  columns: [
                    { label: 'Date', width: 26 },
                    { label: 'Type', width: 40 },
                    { label: 'Name', width: 80 },
                    { label: 'Details', width: 92 },
                    { label: 'Amount', width: 38, numeric: true },
                  ],
                  rows: rows.map((row) => [
                    row.date,
                    row.group,
                    row.name,
                    row.detail,
                    pdfAmount(row.amount),
                  ]),
                  file: `finance-report-${start}-to-${end}.pdf`,
                }).catch(() => report('The PDF could not be created. Please try again.'))
              }
              type="button"
            >
              <FileText size={16} /> PDF
            </button>
            <button
              className={ui.quiet}
              disabled={rows.length === 0}
              onClick={() => window.print()}
              type="button"
            >
              <Printer size={16} /> Print
            </button>
          </div>
        </div>
        {rows.length === 0 ? (
          <p className={ui.empty}>No records in this period.</p>
        ) : phone ? (
          // A phone has no room for five columns: each record is one row, amount on the right.
          <>
            <ul className={ui.list}>
              {rows.slice(0, phoneRows).map((row, index) => (
                <li className={ui.row} key={`${row.date}-${row.name}-${index}`}>
                  <div className={ui.rowMain}>
                    <div className={ui.rowTitle}>{row.name}</div>
                    <div className={ui.rowDetail}>
                      {formatDay(row.date)} {row.date.slice(0, 4)} · {row.group}
                      {row.detail ? ` · ${row.detail}` : ''}
                    </div>
                  </div>
                  <span className={ui.amount}>{formatMoney(row.amount)}</span>
                </li>
              ))}
            </ul>
            {rows.length > phoneRows ? (
              <button
                className={ui.quiet}
                onClick={() => setPhoneRows(phoneRows + PHONE_ROWS)}
                type="button"
              >
                Show {Math.min(PHONE_ROWS, rows.length - phoneRows)} more
              </button>
            ) : null}
          </>
        ) : (
          <div aria-label="Scrollable table" className={ui.tableWrap} role="group" tabIndex={0}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Name</th>
                  <th>Details</th>
                  <th className={ui.numeric}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, ROW_LIMIT).map((row, index) => (
                  <tr key={`${row.date}-${row.name}-${index}`}>
                    <td>
                      {formatDay(row.date)} {row.date.slice(0, 4)}
                    </td>
                    <td>{row.group}</td>
                    <td>{row.name}</td>
                    <td>{row.detail || '—'}</td>
                    <td className={ui.numeric}>{formatMoney(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!phone && rows.length > ROW_LIMIT ? (
          <div className={ui.caption}>
            Showing the latest {ROW_LIMIT}. The CSV has every record.
          </div>
        ) : null}
      </section>
    </div>
  );
}
