/** Draft input rounding. Backend remains authoritative for paid time. */
export const roundPayableHours = (seconds: number): number => {
  const duration = Math.max(0, seconds);
  const whole = Math.floor(duration / 3600);
  const remainder = duration - whole * 3600;
  return whole + (remainder >= 2700 ? 1 : remainder >= 1800 ? 0.5 : 0);
};

export const formatSecondsToHHMMSS = (totalSec: number): string => {
  if (totalSec <= 0) return '00:00:00';
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export const getStatusBadge = (status: string) => {
  switch (status) {
    case 'PRESENT':
    case 'ON_TIME':
      return { label: 'Đúng giờ', color: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' };
    case 'LATE':
      return { label: 'Đi trễ', color: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20' };
    case 'EARLY_LEAVE':
      return { label: 'Về sớm', color: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20' };
    case 'LATE_AND_EARLY':
      return { label: 'Trễ & Sớm', color: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20' };
    case 'ABSENT':
      return { label: 'Vắng mặt', color: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20' };
    case 'OFF': return { label: 'Ngày OFF', color: 'text-slate-500' };
    case 'SCHEDULED': return { label: 'Chưa đến ca', color: 'text-slate-500' };
    case 'INCOMPLETE': return { label: 'Thiếu cặp IN/OUT', color: 'text-amber-600' };
    case 'NO_SHIFT':
      return { label: 'Không có ca', color: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700' };
    default:
      return { label: status, color: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700' };
  }
};
