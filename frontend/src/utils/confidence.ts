export function confidenceColor(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(score)) return 'text-slate-500 dark:text-slate-400';
  const percent = score > 1 ? score : score * 100;
  if (percent >= 95) return 'text-emerald-600 dark:text-emerald-400';
  if (percent >= 80) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}
