import React from 'react';
import { Employee, WorkShift } from '../../../types';

export interface DayOfWeekItem {
  name: string;
  date: string;
  label: string;
  offset: number;
}

interface ScheduleMatrixTableProps {
  filteredEmployees: Employee[];
  daysOfWeek: DayOfWeekItem[];
  workShifts: WorkShift[];
  onCellClick: (empId: string, empName: string, date: string, dayLabel: string) => void;
}

export const ScheduleMatrixTable: React.FC<ScheduleMatrixTableProps> = ({
  filteredEmployees,
  daysOfWeek,
  workShifts,
  onCellClick,
}) => {
  const renderShiftBadge = (shift: WorkShift | undefined) => {
    if (!shift || shift.shift_type === 'OFF') {
      return (
        <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-[#0b0d19] text-slate-400 dark:text-slate-500 text-xs text-center border border-slate-200/80 dark:border-[#21264b] group-hover:border-slate-300 dark:group-hover:border-purple-900/50 transition-colors">
          Nghỉ ca (OFF)
        </div>
      );
    }

    let colorClass = 'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/40';
    let typeName = 'Hành chính';

    if (shift.shift_type === 'MORNING') {
      colorClass = 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/40';
      typeName = 'Ca Sáng';
    } else if (shift.shift_type === 'AFTERNOON') {
      colorClass = 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/40';
      typeName = 'Ca Chiều';
    }

    return (
      <div className={`p-2.5 rounded-xl border text-xs text-left transition-all shadow-xs ${colorClass} max-w-full overflow-hidden`}>
        <p className="font-bold tracking-tight truncate" title={typeName}>{typeName}</p>
        <p className="font-mono text-xs text-slate-700 dark:text-slate-200 mt-0.5 truncate" title={`${shift.start_time} - ${shift.end_time}`}>{shift.start_time} - {shift.end_time}</p>
        {shift.note && <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5" title={shift.note}>{shift.note}</p>}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-2xl overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50 dark:bg-[#0f1224] border-b border-slate-200/80 dark:border-[#21264b] text-slate-500 dark:text-slate-400 font-mono text-[11px]">
            <tr>
              <th className="py-4 px-4 w-56 sticky left-0 bg-slate-50 dark:bg-[#0f1224] z-10 border-r border-slate-200/80 dark:border-[#21264b]">
                Nhân sự ({filteredEmployees.length})
              </th>
              {daysOfWeek.map(d => (
                <th key={d.date} className="py-4 px-3 min-w-[145px] border-r border-slate-200/60 dark:border-[#21264b]/60 last:border-r-0">
                  <div className="font-bold text-slate-900 dark:text-white text-xs">{d.name}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{d.label}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#1d2243] text-slate-700 dark:text-slate-300">
            {filteredEmployees.map(emp => {
              const isInactive = emp.status === 'INACTIVE';
              return (
                <tr key={emp.employee_id} className={`transition-colors ${isInactive ? 'bg-slate-50/50 dark:bg-[#0b0d19]/40 opacity-70' : 'hover:bg-slate-50/80 dark:hover:bg-[#1a1e3a]/40'}`}>
                  {/* Employee Fixed Column */}
                  <td className="py-3.5 px-4 sticky left-0 bg-white dark:bg-[#13162b] z-10 border-r border-slate-200/80 dark:border-[#21264b] w-56 max-w-[224px]">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={emp.avatar}
                        alt={emp.full_name}
                        className={`w-8 h-8 rounded-full object-cover border shrink-0 ${isInactive ? 'border-amber-500/50 grayscale' : 'border-slate-200 dark:border-slate-700'}`}
                      />
                      <div className="overflow-hidden min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-white truncate text-xs flex-1" title={emp.full_name}>{emp.full_name}</p>
                          {isInactive && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 shrink-0">
                              TẠM NGƯNG
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] font-mono text-purple-600 dark:text-purple-400 truncate" title={`${emp.employee_id} • ${emp.department}`}>{emp.employee_id} • {emp.department}</p>
                      </div>
                    </div>
                  </td>

                  {/* Day Columns */}
                  {daysOfWeek.map(day => {
                    const shift = workShifts.find(
                      s => s.employee_id === emp.employee_id && s.date === day.date
                    );

                    return (
                      <td
                        key={day.date}
                        onClick={() => onCellClick(emp.employee_id, emp.full_name, day.date, `${day.name} (${day.label})`)}
                        className={`py-2.5 px-2 border-r border-slate-100 dark:border-[#21264b]/60 last:border-r-0 ${isInactive ? 'cursor-not-allowed opacity-60' : 'cursor-pointer group hover:bg-purple-50/50 dark:hover:bg-purple-950/20'} transition-colors`}
                      >
                        {renderShiftBadge(shift)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
