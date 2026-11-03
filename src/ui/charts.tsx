import { formatCompactMoney, formatMoney } from './format';
import styles from './charts.module.css';
import ui from './ui.module.css';

export interface Segment {
  label: string;
  value: number;
}

/** Fixed order, so a category keeps its colour wherever it appears. */
export const CHART_COLORS = [
  'var(--accent)',
  '#d9a24a',
  '#7f9cf5',
  '#e0838c',
  '#b58be0',
  '#4fb3c9',
  '#c9c96a',
  '#8fb8a8',
];

export const chartColor = (index: number) => CHART_COLORS[index % CHART_COLORS.length] ?? '#8fb8a8';

function DataTable({
  caption,
  rows,
  format = formatMoney,
}: {
  caption: string;
  rows: Segment[];
  format?: (value: number) => string;
}) {
  return (
    <div className={ui.visuallyHidden}>
      <table>
        <caption>{caption}</caption>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td>{format(row.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Donut({
  title,
  segments,
  centerLabel,
  centerValue,
}: {
  title: string;
  segments: Segment[];
  centerLabel: string;
  centerValue: string;
}) {
  const total = segments.reduce((sum, row) => sum + row.value, 0);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const gap = 1.5;
  let offset = 0;
  return (
    <div className={styles.donut}>
      <figure className={styles.ring}>
        <svg aria-hidden="true" viewBox="0 0 100 100">
          {segments.map((row, index) => {
            const length = total > 0 ? (row.value / total) * circumference : 0;
            const dash = `${Math.max(0, length - gap)} ${circumference}`;
            const circle = (
              <circle
                cx="50"
                cy="50"
                fill="none"
                key={row.label}
                r={radius}
                stroke={chartColor(index)}
                strokeDasharray={dash}
                strokeDashoffset={-offset}
                strokeWidth="13"
              >
                <title>{`${row.label}: ${formatMoney(row.value)}`}</title>
              </circle>
            );
            offset += length;
            return circle;
          })}
        </svg>
        <figcaption className={styles.center}>
          <span>{centerLabel}</span>
          <strong>{centerValue}</strong>
        </figcaption>
      </figure>
      <ul className={styles.legend}>
        {segments.map((row, index) => (
          <li key={row.label}>
            <i style={{ background: chartColor(index) }} />
            <span>{row.label}</span>
            <b>{total > 0 ? ((row.value / total) * 100).toFixed(1) : '0.0'}%</b>
          </li>
        ))}
      </ul>
      <DataTable caption={title} rows={segments} />
    </div>
  );
}

export function ColumnChart({ title, bars }: { title: string; bars: Segment[] }) {
  const peak = Math.max(...bars.map((row) => row.value), 1);
  return (
    <figure className={styles.columns}>
      <div aria-hidden="true" className={styles.columnPlot}>
        {bars.map((row, index) => (
          <div className={styles.column} key={row.label}>
            <span className={styles.columnValue}>{formatCompactMoney(row.value)}</span>
            <span
              className={styles.columnBar}
              style={{
                height: `${(Math.max(0, row.value) / peak) * 100}%`,
                background: chartColor(index),
              }}
              title={`${row.label}: ${formatMoney(row.value)}`}
            />
          </div>
        ))}
      </div>
      <div aria-hidden="true" className={styles.columnLabels}>
        {bars.map((row) => (
          <span key={row.label}>{row.label}</span>
        ))}
      </div>
      <DataTable caption={title} rows={bars} />
    </figure>
  );
}

export interface LineSeries {
  name: string;
  /** A fixed colour, for series with a meaning of their own. */
  color?: string;
  /** A dash pattern, so series differ by more than colour. */
  dash?: string;
  points: { label: string; value: number }[];
}

export function LineChart({
  title,
  series,
  narrow = false,
  height: chosenHeight,
  plain = false,
  picked,
  onPick,
}: {
  title: string;
  series: LineSeries[];
  height?: number | undefined;
  /** Lines only, for many points. */
  plain?: boolean;
  picked?: number;
  /** Makes each point selectable, for showing its details elsewhere. */
  onPick?: (index: number) => void;
  /** Draws for a phone's width, so the labels stay readable. */
  narrow?: boolean;
}) {
  const values = series.flatMap((line) => line.points.map((point) => point.value));
  const labels = series[0]?.points.map((point) => point.label) ?? [];
  if (values.length === 0) return <p className={ui.empty}>Nothing to chart yet.</p>;
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;
  const width = narrow ? 400 : 900;
  const height = chosenHeight ?? (narrow ? 260 : 300);
  const top = 12;
  const bottom = 26;
  const left = 64;
  const x = (index: number) =>
    left + (labels.length > 1 ? (index / (labels.length - 1)) * (width - left - 16) : 0);
  const y = (value: number) => top + (1 - (value - low) / span) * (height - top - bottom);
  // A flat line has one level, and two gridlines there would share a key.
  const ticks = [...new Set([high, (high + low) / 2, low])];
  const stride = Math.max(1, Math.ceil(labels.length / (narrow ? 3 : 7)));
  return (
    <figure className={styles.line}>
      {series.length > 1 ? (
        <figcaption className={styles.lineLegend}>
          {series.map((line, index) => (
            <span key={line.name}>
              <i
                style={
                  line.dash
                    ? {
                        height: 0,
                        background: 'none',
                        borderTop: `2px ${line.dash.startsWith('2') ? 'dotted' : 'dashed'} ${line.color ?? chartColor(index)}`,
                      }
                    : { background: line.color ?? chartColor(index) }
                }
              />{' '}
              {line.name}
            </span>
          ))}
        </figcaption>
      ) : null}
      <svg aria-hidden="true" viewBox={`0 0 ${width} ${height}`}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line stroke="var(--border)" x1={left} x2={width - 16} y1={y(tick)} y2={y(tick)} />
            <text fill="var(--muted)" fontSize="13" textAnchor="end" x={left - 6} y={y(tick) + 4}>
              {formatCompactMoney(tick)}
            </text>
          </g>
        ))}
        {labels.map((label, index) =>
          index % stride === 0 ? (
            <text
              fill="var(--muted)"
              fontSize="13"
              key={label}
              textAnchor={index === labels.length - 1 ? 'end' : 'middle'}
              x={x(index)}
              y={height - 8}
            >
              {label}
            </text>
          ) : null,
        )}
        {series.map((line, seriesIndex) => (
          <g key={line.name}>
            <polyline
              className={line.dash ? undefined : styles.drawnLine}
              fill="none"
              {...(line.dash ? {} : { pathLength: 1 })}
              points={line.points.map((point, index) => `${x(index)},${y(point.value)}`).join(' ')}
              stroke={line.color ?? chartColor(seriesIndex)}
              strokeDasharray={line.dash}
              strokeLinejoin="round"
              strokeWidth="2"
            />
            {plain
              ? null
              : line.points.map((point, index) => (
                  <circle
                    cx={x(index)}
                    cy={y(point.value)}
                    fill={line.color ?? chartColor(seriesIndex)}
                    key={point.label}
                    r="4"
                  >
                    <title>{`${line.name}, ${point.label}: ${formatMoney(point.value)}`}</title>
                  </circle>
                ))}
          </g>
        ))}
        {picked === undefined ? null : (
          <line
            stroke="var(--border-strong)"
            x1={x(picked)}
            x2={x(picked)}
            y1={top}
            y2={height - bottom}
          />
        )}
        {onPick
          ? labels.map((label, index) => (
              <rect
                fill="transparent"
                height={height}
                key={label}
                onClick={() => onPick(index)}
                style={{ cursor: 'pointer' }}
                width={(width - left - 16) / Math.max(1, labels.length - 1)}
                x={x(index) - (width - left - 16) / Math.max(1, labels.length - 1) / 2}
                y={0}
              />
            ))
          : null}
      </svg>
      <div className={ui.visuallyHidden}>
        <table>
          <caption>{title}</caption>
          <tbody>
            {labels.map((label, index) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                {series.map((line) => (
                  <td key={line.name}>{formatMoney(line.points[index]?.value ?? 0)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
