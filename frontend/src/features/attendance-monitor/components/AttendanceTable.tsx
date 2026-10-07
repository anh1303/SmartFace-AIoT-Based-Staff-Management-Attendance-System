import React from 'react';
import { ScanFace, Fingerprint, Edit } from 'lucide-react';
import { AttendancePairItem } from '../hooks/useAttendancePairs';
import { getStatusBadge } from '../timeUtils';

interface AttendanceTableProps {
  employeePairs: AttendancePairItem[];
  startDate: string;
  endDate: string;
  onOpenEditModal: (item: AttendancePairItem) => void;
}

export const AttendanceTable: React.FC<AttendanceTableProps> = ({
  employeePairs,
  startDate,
  endDate,
  onOpenEditModal,
}) => {
  return (
    <div className="bg-white dark:bg-[#13162b] border border-slate-300 dark:border-[#28305c] rounded-xl overflow-hidden shadow-xs transition-colors">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-300 dark:border-[#28305c] bg-slate-200 dark:bg-[#0c0f1f] text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              <th className="py-3.5 px-4 border-r border-slate-300 dark:border-[#222956]">Nhân viên</th>
              <th className="py-3.5 px-4 border-r border-slate-300 dark:border-[#222956]">Ca làm việc</th>
              <th className="py-3.5 px-4 border-r border-slate-300 dark:border-[#222956] text-center">Sự kiện</th>
              <th className="py-3.5 px-4 border-r border-slate-300 dark:border-[#222956] text-center">Thời gian</th>
              <th className="py-3.5 px-4 border-r border-slate-300 dark:border-[#222956] text-center">Phương thức</th>
              <th className="py-3.5 px-4 border-r border-slate-300 dark:border-[#222956] text-center">Độ tin cậy</th>
              <th className="py-3.5 px-4 border-r border-slate-300 dark:border-[#222956] text-center">Trạng thái</th>
              <th className="py-3.5 px-4 border-r border-slate-300 dark:border-[#222956] text-center">Trễ / Sớm</th>
              <th className="py-3.5 px-4 border-r border-slate-300 dark:border-[#222956] text-center">Tăng ca (OT)</th>
              <th className="py-3.5 px-4 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody className="text-xs">
            {employeePairs.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs">
                  Không tìm thấy bản ghi chấm công nào phù hợp {startDate === endDate ? `cho ngày ${startDate}` : `trong khoảng từ ${startDate} đến ${endDate}`}
                </td>
              </tr>
            ) : (
              employeePairs.map((item) => {
                const { employee, shift, events, lateEarlyStr, overtimeStr } = item;
                const checkInEv = events[0];
                const checkOutEv = events[1];

                const inBadge = getStatusBadge(checkInEv.status);
                const outBadge = getStatusBadge(checkOutEv.status);

                return (
                  <React.Fragment key={`${employee.employee_id}-${item.date}-${shift.name}`}>
                    {/* Row 1: Check-in */}
                    <tr className="hover:bg-slate-50/90 dark:hover:bg-[#1a1e3a]/50 transition-colors border-b border-slate-200 dark:border-[#202752]">
                      {/* Employee Info - rowSpan 2 */}
                      <td rowSpan={2} className="py-3 px-4 align-top border-r border-b-2 border-slate-300 dark:border-[#28305c] bg-white dark:bg-[#13162b]">
                        <div className="flex items-center gap-3">
                          {employee.avatar ? (
                            <img
                              src={employee.avatar}
                              alt={employee.full_name}
                              className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700/50 flex items-center justify-center font-bold text-purple-600 dark:text-purple-300">
                              {employee.full_name.charAt(0)}
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">{employee.full_name}</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                              {employee.employee_id} • {employee.department}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Shift Info - rowSpan 2 */}
                      <td rowSpan={2} className="py-3 px-4 align-top border-r border-b-2 border-slate-300 dark:border-[#28305c] bg-white dark:bg-[#13162b]">
                        <p className="font-medium text-slate-800 dark:text-slate-200">{shift.name}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{shift.timeRange}</p>
                        {startDate !== endDate && (
                          <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#0f1224] text-[10px] font-mono text-purple-600 dark:text-purple-400 border border-slate-200 dark:border-[#272d5a]">
                            {item.date}
                          </span>
                        )}
                      </td>

                      {/* Check-In Event */}
                      <td className="py-2.5 px-4 font-medium text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-[#202752] text-center">
                        <span className="inline-flex items-center justify-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400" />
                          {checkInEv.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono font-semibold text-slate-900 dark:text-white border-r border-slate-200 dark:border-[#202752] text-center">
                        {checkInEv.time}
                      </td>
                      <td className="py-2.5 px-4 border-r border-slate-200 dark:border-[#202752] text-center">
                        {checkInEv.methodLabel === 'UNRECORDED' ? (
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${getStatusBadge('UNRECORDED').color}`}>
                            UNRECORDED
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-200">
                            {checkInEv.isFace ? (
                              <ScanFace className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                            ) : (
                              <Fingerprint className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            )}
                            {checkInEv.methodLabel}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] border-r border-slate-200 dark:border-[#202752] text-center">
                        {checkInEv.score !== null ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">{(checkInEv.score * 100).toFixed(0)}%</span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-600">--</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 border-r border-slate-200 dark:border-[#202752] text-center">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${inBadge.color}`}>
                          {inBadge.label}
                        </span>
                      </td>

                      {/* Late/Early - rowSpan 2 */}
                      <td rowSpan={2} className="py-3 px-4 align-middle font-mono font-bold border-r border-b-2 border-slate-300 dark:border-[#28305c] bg-white dark:bg-[#13162b] text-center">
                        {item.currentLateEarlySec > 0 ? (
                          <span className="text-rose-600 dark:text-rose-400">{lateEarlyStr}</span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">00:00:00</span>
                        )}
                      </td>

                      {/* Overtime - rowSpan 2 */}
                      <td rowSpan={2} className="py-3 px-4 align-middle font-mono font-bold border-r border-b-2 border-slate-300 dark:border-[#28305c] bg-white dark:bg-[#13162b] text-center">
                        {item.currentOTSec > 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400">{overtimeStr}</span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">{overtimeStr}</span>
                        )}
                      </td>

                      {/* Action Edit - rowSpan 2 */}
                      <td rowSpan={2} className="py-3 px-4 align-middle text-center border-b-2 border-slate-300 dark:border-[#28305c] bg-white dark:bg-[#13162b]">
                        <button
                          type="button"
                          onClick={() => onOpenEditModal(item)}
                          title="Chỉnh sửa giờ trễ/sớm và tăng ca"
                          className="p-2 rounded-xl bg-slate-100 hover:bg-purple-50 dark:bg-[#0f1224] dark:hover:bg-purple-950/40 text-slate-600 hover:text-purple-600 dark:text-slate-300 dark:hover:text-purple-300 border border-slate-200 dark:border-[#272d5a] transition-colors cursor-pointer inline-flex items-center justify-center"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>

                    {/* Row 2: Check-out */}
                    <tr className="hover:bg-slate-50/90 dark:hover:bg-[#1a1e3a]/50 transition-colors border-b-2 border-slate-300 dark:border-[#28305c]">
                      <td className="py-2.5 px-4 font-medium text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-[#202752] text-center">
                        <span className="inline-flex items-center justify-center gap-1.5 text-purple-600 dark:text-purple-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500 dark:bg-purple-400" />
                          {checkOutEv.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono font-semibold text-slate-900 dark:text-white border-r border-slate-200 dark:border-[#202752] text-center">
                        {checkOutEv.time}
                      </td>
                      <td className="py-2.5 px-4 border-r border-slate-200 dark:border-[#202752] text-center">
                        {checkOutEv.methodLabel === 'UNRECORDED' ? (
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${getStatusBadge('UNRECORDED').color}`}>
                            UNRECORDED
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-200">
                            {checkOutEv.isFace ? (
                              <ScanFace className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                            ) : (
                              <Fingerprint className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            )}
                            {checkOutEv.methodLabel}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] border-r border-slate-200 dark:border-[#202752] text-center">
                        {checkOutEv.score !== null ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">{(checkOutEv.score * 100).toFixed(0)}%</span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-600">--</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 border-r border-slate-200 dark:border-[#202752] text-center">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${outBadge.color}`}>
                          {outBadge.label}
                        </span>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
