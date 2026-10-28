import {Avatar} from '../../../components/common/Avatar';
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
        <div className="py-2 px-1 rounded-lg bg-slate-100 dark:bg-[#0b0d19] text-slate-400 dark:text-slate-500 text-[11px] text-center border border-slate-200/80 dark:border-[#21264b] group-hover:border-slate-300 dark:group-hover:border-blue-900/50 transition-colors truncate">
          Nghỉ ca
        </div>
      );
    }

    let colorClass = 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/40';
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
      <div role="region" aria-label="Lịch phân ca theo tuần, cuộn ngang để xem các ngày" tabIndex={0} className="overflow-x-auto overflow-y-auto max-h-[620px]">
        <table className="w-full min-w-[1050px] table-fixed text-left text-xs border-collapse">
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
              const isInactive = emp.status !== 'ACTIVE';
              return (
                <tr
                  key={emp.employee_id}
                  className={`border-b border-slate-200 dark:border-[#202752] transition-colors ${isInactive
                      ? 'bg-slate-50/50 dark:bg-[#0b0d19]/40 opacity-70'
                      : 'hover:bg-blue-50/40 dark:hover:bg-[#181c38]/50'
                    }`}
                >
                  {/* Employee Fixed Column */}
                  <td className="py-2.5 px-3 sticky left-0 bg-white dark:bg-[#13162b] z-10 border-r border-slate-200 dark:border-[#202752] w-40 sm:w-44 lg:w-48 max-w-[192px]">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar src={emp.avatar} name={emp.full_name} size={30}/>
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
                          className="text-[10px] font-mono text-blue-600 dark:text-blue-400 truncate"
                          title={emp.employee_id}
                        >
                          {emp.employee_id}
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
                        className={`py-2 px-1 ${index < daysOfWeek.length - 1
                            ? 'border-r border-slate-200 dark:border-[#202752]'
                            : ''
                          } ${isInactive
                            ? 'cursor-not-allowed opacity-60'
                            : 'cursor-pointer group hover:bg-blue-50/50 dark:hover:bg-blue-950/20'
                          } transition-colors`}
                      >
                        <button type="button" className="w-full min-h-16 rounded-md focus-visible:outline-blue-600" aria-label={`Phân ca ${emp.full_name}, ${day.name} ngày ${day.label}`} disabled={isInactive} onClick={()=>onCellClick(emp.employee_id,emp.full_name,day.date,`${day.name} (${day.label})`)}>{renderShiftBadge(shift)}{shift?.shift_type==='OTHER'&&shift.note&&<span className="block text-xs text-slate-500 dark:text-slate-300 px-1 mt-1 truncate" title={shift.note}>{shift.note}</span>}</button>
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