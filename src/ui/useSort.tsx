import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import ui from './ui.module.css';

export type SortValue = string | number;

interface Sort<Key> {
  key: Key;
  ascending: boolean;
}

/** Sorts rows by a column. Choosing the same column reverses it. */
export function useSort<Row, Key extends string>(
  rows: Row[],
  valueOf: (row: Row, key: Key) => SortValue,
) {
  const [sort, setSort] = useState<Sort<Key> | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const direction = sort.ascending ? 1 : -1;
    return [...rows].sort((a, b) => {
      const left = valueOf(a, sort.key);
      const right = valueOf(b, sort.key);
      const order =
        typeof left === 'number' && typeof right === 'number'
          ? left - right
          : String(left).localeCompare(String(right), 'en-IN', { numeric: true });
      return order * direction;
    });
  }, [rows, sort, valueOf]);

  const toggle = (key: Key) =>
    setSort((current) => ({
      key,
      ascending: current?.key === key ? !current.ascending : true,
    }));

  return { sorted, sort, toggle };
}

export function SortHeader<Key extends string>({
  label,
  column,
  sort,
  onSort,
  numeric = false,
  className,
}: {
  label: string;
  column: Key;
  sort: Sort<Key> | null;
  onSort: (key: Key) => void;
  numeric?: boolean;
  className?: string | undefined;
}) {
  const active = sort?.key === column;
  const Icon = !active ? ArrowUpDown : sort.ascending ? ArrowUp : ArrowDown;
  return (
    <th
      aria-sort={!active ? 'none' : sort.ascending ? 'ascending' : 'descending'}
      className={`${numeric ? ui.numeric : ''} ${className ?? ''}`}
    >
      <button className={ui.sortButton} onClick={() => onSort(column)} type="button">
        {label} <Icon aria-hidden="true" size={12} />
      </button>
    </th>
  );
}
