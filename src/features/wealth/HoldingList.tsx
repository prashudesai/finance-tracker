import {
  Banknote,
  BarChart3,
  Briefcase,
  Building2,
  ChevronRight,
  Coins,
  Gem,
  Landmark,
  Layers,
  LineChart,
  PiggyBank,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useMemo } from 'react';
import type { CategoryRow } from '../../domain/analytics';
import { lastDayOfMonth, previousMonth } from '../../domain/calendar';
import { holdingValue } from '../../domain/holdings';
import type { TrackerData } from '../../data/repository';
import { formatAmount, formatPercent } from '../../ui/format';
import { TrendLine } from '../../ui/TrendLine';
import styles from './HoldingList.module.css';

const MONTHS = 6;

/** Each kind of investment has its own icon, by words in its name; anything else a chart. */
const ICONS: [RegExp, LucideIcon][] = [
  [/\b(PF|PPF|EPF)\b/i, Landmark],
  [/NPS|pension/i, ShieldCheck],
  [/deposit|\bFD\b|\bRD\b/i, PiggyBank],
  [/bond|debenture|NCD/i, Banknote],
  [/gold|silver|SGB/i, Gem],
  [/REIT|InvIT|real estate|property/i, Building2],
  [/PMS|portfolio management|AIF/i, Briefcase],
  [/ETF|index/i, BarChart3],
  [/mutual|fund|SIP/i, Layers],
  [/cash|savings|reserve|liquid/i, Wallet],
  [/stock|share|equity/i, LineChart],
  [/crypto/i, Coins],
];

export const iconFor = (name: string): LucideIcon =>
  ICONS.find(([pattern]) => pattern.test(name))?.[1] ?? LineChart;

/**
 * Holdings as compact rows: a category's value, its gain, and a line of its value at each of
 * the last six month-ends. Each row opens the category's details.
 */
export function HoldingList({
  categories,
  data,
  today,
  onOpen,
}: {
  categories: CategoryRow[];
  data: TrackerData;
  today: string;
  onOpen: (name: string) => void;
}) {
  const ends = useMemo(() => {
    const months = [today.slice(0, 7)];
    while (months.length < MONTHS) months.unshift(previousMonth(months[0] ?? today.slice(0, 7)));
    return months.map((month, index) =>
      index === months.length - 1 ? today : lastDayOfMonth(month),
    );
  }, [today]);

  return (
    <ul className={styles.list}>
      {categories.map((category) => {
        const Icon = iconFor(category.name);
        const series = ends.map((date) =>
          category.rows
            .filter((row) => row.holding.date <= date)
            .reduce((sum, row) => sum + holdingValue(row.holding, data, date), 0),
        );
        const start = series.findIndex((value) => value > 0);
        const line = start === -1 ? [] : series.slice(start);
        const up = (line.at(-1) ?? 0) >= (line[0] ?? 0);
        return (
          <li key={category.name}>
            <button
              aria-label={`${category.name}: ${formatAmount(category.current)}. Open details`}
              className={styles.row}
              onClick={() => onOpen(category.name)}
              type="button"
            >
              <span aria-hidden="true" className={styles.icon}>
                <Icon size={18} />
              </span>
              <span className={styles.text}>
                <strong>{category.name}</strong>
                <small>
                  {formatAmount(category.invested)} invested
                  {category.count > 1 ? ` · ${category.count} holdings` : ''}
                </small>
              </span>
              <span className={styles.trend}>
                {line.length >= 2 ? (
                  <TrendLine
                    color={up ? 'var(--accent)' : 'var(--loss)'}
                    height={24}
                    values={line}
                    width={56}
                  />
                ) : null}
              </span>
              <span className={styles.value}>
                <strong>{formatAmount(category.current)}</strong>
                {category.absolute !== null ? (
                  <small data-down={category.absolute < 0 || undefined}>
                    {category.absolute >= 0 ? '+' : ''}
                    {formatPercent(category.absolute)}
                  </small>
                ) : null}
              </span>
              <ChevronRight aria-hidden="true" className={styles.chevron} size={16} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
