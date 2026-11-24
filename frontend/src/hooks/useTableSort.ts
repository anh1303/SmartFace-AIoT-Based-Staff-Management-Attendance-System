import { useState } from 'react';

const collator = new Intl.Collator('vi', { sensitivity: 'base', numeric: true });

export function compareEmployeeNames(a: string, b: string) {
  const partsA = a.trim().split(/\s+/);
  const partsB = b.trim().split(/\s+/);
  return collator.compare(partsA.at(-1) || '', partsB.at(-1) || '') || collator.compare(a.trim(), b.trim());
}

export function compareEmployeeCodes(a: string, b: string) {
  const numberA = Number(a.match(/\d+$/)?.[0] || 0);
  const numberB = Number(b.match(/\d+$/)?.[0] || 0);
  return numberA - numberB || collator.compare(a, b);
}

export function useTableSort<T, K extends string>(rows: T[], comparators: Record<K, (a: T, b: T) => number>) {
  const [sort, setSort] = useState<{ key: K; direction: 'ascending' | 'descending' } | null>(null);
  const sortedRows = sort
    ? [...rows].sort((a, b) => comparators[sort.key](a, b) * (sort.direction === 'ascending' ? 1 : -1))
    : rows;

  const sortProps = (key: K) => ({
    'aria-sort': sort?.key === key ? sort.direction : 'none' as const,
    onSort: () => setSort(previous => {
      if (previous?.key === key) {
        return previous.direction === 'ascending' ? { key, direction: 'descending' } : null;
      }
      return { key, direction: 'ascending' };
    }),
  });

  return { sortedRows, sortProps };
}
