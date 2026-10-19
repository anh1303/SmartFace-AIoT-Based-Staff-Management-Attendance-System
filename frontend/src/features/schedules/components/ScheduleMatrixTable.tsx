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
        <div className="py-2 px-1 rounded-lg bg-slate-100 dark:bg-[#0b0d19] text-slate-400 dark:text-slate-500 text-[11px] text-center border border-slate-200/80 dark:border-[#21264b] group-hover:border-slate-300 dark:group-hover:border-purple-900/50 transition-colors truncate">
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

    const tooltipText = shift.note
      ? `${typeName} (${shift.start_time} - ${shift.end_time})\nChú thích: ${shift.note}`
      : `${typeName} (${shift.start_time} - ${shift.end_time})`;

    return (
      <div
        className={`py-1.5 px-1.5 xl:px-2 rounded-lg border text-xs text-center transition-all shadow-xs ${colorClass} w-full overflow-hidden`}
        title={tooltipText}
      >
        <p className="font-bold tracking-tight truncate text-[11px] xl:text-xs text-center">
          {typeName}
        </p>
        <p className="font-mono text-[10px] xl:text-[11px] text-slate-700 dark:text-slate-200 mt-0.5 truncate text-center">
          {shift.start_time} - {shift.end_time}
        </p>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-[#13162b] border border-slate-300 dark:border-[#28305c] rounded-xl overflow-hidden shadow-xs">
      <div className="overflow-x-auto overflow-y-auto max-h-[620px]">
        <table className="w-full table-fixed text-left text-xs border-collapse">
          <thead className="sticky top-0 z-20 bg-slate-200 dark:bg-[#0c0f1f] border-b-2 border-slate-300 dark:border-[#28305c] text-slate-800 dark:text-slate-200 font-mono text-[11px] uppercase tracking-wider font-bold">
            <tr>
              <th className="py-3.5 px-3 w-40 sm:w-44 lg:w-48 sticky left-0 top-0 bg-slate-200 dark:bg-[#0c0f1f] z-30 border-r border-b-2 border-slate-300 dark:border-[#222956] text-center">
                Nhân viên
              </th>
              {daysOfWeek.map((d, index) => (
                <th
                  key={d.date}
                  className={`sticky top-0 z-20 bg-slate-200 dark:bg-[#0c0f1f] border-b-2 border-slate-300 dark:border-[#28305c] py-3.5 px-1 ${index < daysOfWeek.length - 1
                      ? 'border-r border-slate-300 dark:border-[#222956]'
                      : ''
                    } text-center`}
                >
                  <div className="font-bold text-slate-900 dark:text-white text-xs truncate">
                    {d.name}
                  </div>
                  <div className="text-[10px] xl:text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                    {d.label}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-slate-700 dark:text-slate-300">
            {filteredEmployees.map((emp) => {
              const isInactive = emp.status === 'INACTIVE';
              return (
                <tr
                  key={emp.employee_id}
                  className={`border-b border-slate-200 dark:border-[#202752] transition-colors ${isInactive
                      ? 'bg-slate-50/50 dark:bg-[#0b0d19]/40 opacity-70'
                      : 'hover:bg-purple-50/40 dark:hover:bg-[#181c38]/50'
                    }`}
                >
                  {/* Employee Fixed Column */}
                  <td className="py-2.5 px-3 sticky left-0 bg-white dark:bg-[#13162b] z-10 border-r border-slate-200 dark:border-[#202752] w-40 sm:w-44 lg:w-48 max-w-[192px]">
                    <div className="flex items-center gap-2 min-w-0">
                      <img
                        src={emp.avatar}
                        alt={emp.full_name}
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border shrink-0 ${isInactive
                            ? 'border-amber-500/50 grayscale'
                            : 'border-slate-200 dark:border-slate-700'
                          }`}
                      />
                      <div className="overflow-hidden min-w-0 flex-1">
                        <div className="flex items-center gap-1 min-w-0">
                          <p
                            className="font-semibold text-slate-900 dark:text-white truncate text-xs flex-1"
                            title={emp.full_name}
                          >
                            {emp.full_name}
                          </p>
                          {isInactive && (
                            <span className="px-1 py-0.2 text-[8px] font-bold rounded bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 shrink-0">
                              NGƯNG
                            </span>
                          )}
                        </div>
                        <p
                          className="text-[10px] font-mono text-purple-600 dark:text-purple-400 truncate"
                          title={`${emp.employee_id} - ${emp.department}`}
                        >
                          {emp.employee_id} - {emp.department}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Day Columns */}
                  {daysOfWeek.map((day, index) => {
                    const shift = workShifts.find(
                      (s) => s.employee_id === emp.employee_id && s.date === day.date
                    );

                    return (
                      <td
                        key={day.date}
                        onClick={() =>
                          onCellClick(
                            emp.employee_id,
                            emp.full_name,
                            day.date,
                            `${day.name} (${day.label})`
                          )
                        }
                        className={`py-2 px-1 ${index < daysOfWeek.length - 1
                            ? 'border-r border-slate-200 dark:border-[#202752]'
                            : ''
                          } ${isInactive
                            ? 'cursor-not-allowed opacity-60'
                            : 'cursor-pointer group hover:bg-purple-50/50 dark:hover:bg-purple-950/20'
                          } transition-colors`}
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