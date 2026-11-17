import { Lock } from 'lucide-react';
import type { WorkShift } from '../../../types';

export function ScheduleShiftBadge({ shift, isPast = false }: { shift?: WorkShift; isPast?: boolean }) {
  if (!shift || shift.shift_type === 'OFF') {
    return (
      <span className={`schedule-shift-badge w-full py-2 px-1 rounded-lg bg-slate-100 dark:bg-[#0b0d19] text-slate-400 dark:text-slate-500 text-[11px] text-center border border-slate-200/80 dark:border-[#21264b] transition-colors truncate flex items-center justify-center gap-1 ${isPast ? 'opacity-70' : 'group-hover:border-slate-300 dark:group-hover:border-blue-900/50'}`}>
        <span>Nghỉ ca</span>
        {isPast && <Lock size={11} aria-label="Ca đã qua" className="shrink-0 text-amber-600 dark:text-amber-400"/>}
      </span>
    );
  }

  let colorClass = 'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/40';
  let typeName = 'Hành chính';

  if (shift.shift_type === 'MORNING') {
    colorClass = 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40';
    typeName = 'Ca Sáng';
  } else if (shift.shift_type === 'AFTERNOON') {
    colorClass = 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/40';
    typeName = 'Ca Chiều';
  } else if (shift.shift_type === 'OTHER') {
    colorClass = 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/40';
    typeName = 'Ca khác';
  }

  const tooltipText = shift.note
    ? `${typeName} (${shift.start_time} - ${shift.end_time})\nChú thích: ${shift.note}`
    : `${typeName} (${shift.start_time} - ${shift.end_time})`;

  return (
    <span
      className={`schedule-shift-badge block py-1.5 px-1.5 xl:px-2 rounded-lg border text-xs text-center transition-all shadow-xs ${colorClass} ${isPast ? 'opacity-85 saturate-75 border-dashed' : ''} w-full overflow-hidden`}
      title={tooltipText + (isPast ? '\n[Ca đã qua - Chỉ xem chi tiết]' : '')}
    >
      <span className="flex items-center justify-center gap-1">
        <span className="block font-bold tracking-tight truncate text-[11px] xl:text-xs text-center">
          {typeName}
        </span>
        {isPast && <Lock size={11} aria-label="Ca đã qua" className="shrink-0 text-amber-600 dark:text-amber-400"/>}
      </span>
      <span className="block font-mono text-[10px] xl:text-[11px] text-slate-700 dark:text-slate-200 mt-0.5 truncate text-center">
        {shift.start_time} - {shift.end_time}
      </span>
    </span>
  );
}
