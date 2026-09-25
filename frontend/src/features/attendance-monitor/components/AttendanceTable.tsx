import React from 'react';
import { ScanFace, Fingerprint, Edit } from 'lucide-react';
import { AttendancePairItem } from '../hooks/useAttendancePairs';
import { getStatusBadge } from '../timeUtils';

interface AttendanceTableProps {
  employeePairs: AttendancePairItem[];
  selectedDate: string;
  onOpenEditModal: (item: AttendancePairItem) => void;
}

export const AttendanceTable: React.FC<AttendanceTableProps> = ({
  employeePairs,
  selectedDate,
  onOpenEditModal,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <th className="py-3.5 px-4">Nhân viên</th>
              <th className="py-3.5 px-4">Ca làm việc</th>
              <th className="py-3.5 px-4">Sự kiện</th>
              <th className="py-3.5 px-4">Thời gian</th>
              <th className="py-3.5 px-4">Phương thức</th>
              <th className="py-3.5 px-4">Độ tin cậy</th>
              <th className="py-3.5 px-4">Trạng thái</th>
              <th className="py-3.5 px-4">Trễ / Sớm</th>
              <th className="py-3.5 px-4">Tăng ca (OT)</th>
              <th className="py-3.5 px-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-xs">
            {employeePairs.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-500 text-xs">
                  Không tìm thấy bản ghi chấm công nào phù hợp cho ngày {selectedDate}
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
                  <React.Fragment key={`${employee.employee_id}-${item.date}`}>
                    {/* Row 1: Check-in */}
                    <tr className="hover:bg-slate-800/30 transition-colors">
                      {/* Employee Info - rowSpan 2 */}
                      <td rowSpan={2} className="py-3 px-4 align-top border-r border-slate-800/40">
                        <div className="flex items-center gap-3">
                          {employee.avatar ? (
                            <img
                              src={employee.avatar}
                              alt={employee.full_name}
                              className="w-8 h-8 rounded-full object-cover border border-slate-700"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300">
                              {employee.full_name.charAt(0)}
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-white">{employee.full_name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              {employee.employee_id} • {employee.department}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Shift Info - rowSpan 2 */}
                      <td rowSpan={2} className="py-3 px-4 align-top border-r border-slate-800/40">
                        <p className="font-medium text-slate-200">{shift.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{shift.timeRange}</p>
                      </td>

                      {/* Check-In Event */}
                      <td className="py-2.5 px-4 font-medium text-slate-300">
                        <span className="inline-flex items-center gap-1.5 text-cyan-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                          {checkInEv.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono font-semibold text-white">
                        {checkInEv.time}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-300">
                          {checkInEv.isFace ? (
                            <ScanFace className="w-3.5 h-3.5 text-blue-400" />
                          ) : (
                            <Fingerprint className="w-3.5 h-3.5 text-emerald-400" />
                          )}
                          {checkInEv.methodLabel}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px]">
                        {checkInEv.score !== null ? (
                          <span className="text-emerald-400">{(checkInEv.score * 100).toFixed(0)}%</span>
                        ) : (
                          <span className="text-slate-600">--</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${inBadge.color}`}>
                          {inBadge.label}
                        </span>
                      </td>

                      {/* Late/Early - rowSpan 2 */}
                      <td rowSpan={2} className="py-3 px-4 align-top font-mono font-bold border-l border-r border-slate-800/40">
                        {item.currentLateEarlySec > 0 ? (
                          <span className="text-rose-400">{lateEarlyStr}</span>
                        ) : (
                          <span className="text-slate-500">00:00:00</span>
                        )}
                      </td>

                      {/* Overtime - rowSpan 2 */}
                      <td rowSpan={2} className="py-3 px-4 align-top font-mono font-bold border-r border-slate-800/40">
                        {item.currentOTSec > 0 ? (
                          <span className="text-emerald-400">{overtimeStr}</span>
                        ) : (
                          <span className="text-slate-500">{overtimeStr}</span>
                        )}
                      </td>

                      {/* Action Edit - rowSpan 2 */}
                      <td rowSpan={2} className="py-3 px-4 align-top text-right">
                        <button
                          type="button"
                          onClick={() => onOpenEditModal(item)}
                          title="Chỉnh sửa giờ trễ/sớm và tăng ca"
                          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>

                    {/* Row 2: Check-out */}
                    <tr className="hover:bg-slate-800/30 transition-colors border-b border-slate-800/40">
                      <td className="py-2.5 px-4 font-medium text-slate-300">
                        <span className="inline-flex items-center gap-1.5 text-purple-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                          {checkOutEv.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono font-semibold text-white">
                        {checkOutEv.time}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-300">
                          {checkOutEv.isFace ? (
                            <ScanFace className="w-3.5 h-3.5 text-blue-400" />
                          ) : (
                            <Fingerprint className="w-3.5 h-3.5 text-emerald-400" />
                          )}
                          {checkOutEv.methodLabel}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px]">
                        {checkOutEv.score !== null ? (
                          <span className="text-emerald-400">{(checkOutEv.score * 100).toFixed(0)}%</span>
                        ) : (
                          <span className="text-slate-600">--</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
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
