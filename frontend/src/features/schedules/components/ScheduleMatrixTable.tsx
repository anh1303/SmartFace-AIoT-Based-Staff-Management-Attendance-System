import {Avatar} from '../../../components/common/Avatar';
import React from 'react';
import { useTableSort, compareEmployeeNames } from '../../../hooks/useTableSort';
import { Employee, WorkShift } from '../../../types';
import { getTodayVNString } from '../../../utils/dateUtils';
import { ScheduleShiftBadge } from './ScheduleShiftBadge';

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
  const todayVN = getTodayVNString();
  const { sortedRows, sortProps } = useTableSort(filteredEmployees, {
    name: (a, b) => compareEmployeeNames(a.full_name, b.full_name),
  });


  return (
    <div className="bg-white dark:bg-[#13162b] border border-slate-300 dark:border-[#28305c] rounded-xl overflow-hidden shadow-xs">
      <div role="region" aria-label="Lịch phân ca theo tuần, cuộn ngang để xem các ngày" tabIndex={0} className="overflow-x-auto overflow-y-auto max-h-[620px]">
        <table className="w-full min-w-[1050px] table-fixed text-left text-xs border-collapse">
          <thead className="sticky top-0 z-20 bg-slate-200 dark:bg-[#0c0f1f] border-b-2 border-slate-300 dark:border-[#28305c] text-slate-800 dark:text-slate-200 font-mono text-[11px] uppercase tracking-wider font-bold">
            <tr>
              <th aria-sort={sortProps('name')['aria-sort']} className="py-3.5 px-3 w-40 sm:w-44 lg:w-48 sticky left-0 top-0 bg-slate-200 dark:bg-[#0c0f1f] z-30 border-r border-b-2 border-slate-300 dark:border-[#222956] text-center">
                <button type="button" onClick={sortProps('name').onSort} className="w-full cursor-pointer uppercase focus-visible:outline-blue-500">Nhân viên</button>
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
            {sortedRows.map((emp) => {
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
                    const isPast = day.date < todayVN;

                    return (
                      <td
                        key={day.date}
                        className={`py-2 px-1 ${index < daysOfWeek.length - 1
                            ? 'border-r border-slate-200 dark:border-[#202752]'
                            : ''
                          } ${isInactive
                            ? 'cursor-not-allowed opacity-60'
                            : isPast
                              ? 'cursor-pointer group hover:bg-slate-100/50 dark:hover:bg-[#151933]/60'
                              : 'cursor-pointer group hover:bg-blue-50/50 dark:hover:bg-blue-950/20'
                          } transition-colors`}
                      >
                        <button
                          type="button"
                          className="w-full min-h-16 rounded-md focus-visible:outline-blue-600"
                          aria-label={isPast ? `Xem chi tiết ca ${emp.full_name}, ${day.name} ngày ${day.label} (Đã khóa)` : `Phân ca ${emp.full_name}, ${day.name} ngày ${day.label}`}
                          disabled={isInactive}
                          onClick={() => onCellClick(emp.employee_id, emp.full_name, day.date, `${day.name} (${day.label})`)}
                        >
                          <ScheduleShiftBadge shift={shift} isPast={isPast}/>
                        </button>
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
