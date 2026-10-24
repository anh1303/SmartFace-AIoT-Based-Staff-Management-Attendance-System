import React, { useState } from 'react';
import { ScanFace, Fingerprint, AlertTriangle, ShieldCheck, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { AttendancePairItem } from '../hooks/useAttendancePairs';
import { getStatusBadge } from '../../../utils/timeUtils';
import {
  TableContainer,
  TableHead,
  TableHeadRow,
  TableHeadCell,
  TableBody,
  TableEmpty,
  ActionEditButton,
} from '../../../components/common';

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
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleExpand = (rowKey: string) => {
    setExpandedRows(prev => ({ ...prev, [rowKey]: !prev[rowKey] }));
  };

  return (
    <TableContainer minWidth="1250px">
      <TableHead>
        <TableHeadRow>
          <TableHeadCell width="200px" align="center">Nhân viên</TableHeadCell>
          <TableHeadCell width="140px">Ca làm việc</TableHeadCell>
          <TableHeadCell width="90px">Giờ thường</TableHeadCell>
          <TableHeadCell width="200px">Khoảng IN → OUT hợp lệ</TableHeadCell>
          <TableHeadCell width="120px">Phương thức / TB</TableHeadCell>
          <TableHeadCell width="80px">Độ tin cậy</TableHeadCell>
          <TableHeadCell width="110px">Trạng thái</TableHeadCell>
          <TableHeadCell width="90px">Trễ / Sớm</TableHeadCell>
          <TableHeadCell width="130px">Tăng ca (OT)</TableHeadCell>
          <TableHeadCell width="140px">Rà soát / Policy</TableHeadCell>
          <TableHeadCell width="70px" isLast>Thao tác</TableHeadCell>
        </TableHeadRow>
      </TableHead>
      <TableBody>
        {employeePairs.length === 0 ? (
          <TableEmpty
            colSpan={11}
            message={`Không tìm thấy bản ghi chấm công nào phù hợp ${
              startDate === endDate ? `cho ngày ${startDate}` : `trong khoảng từ ${startDate} đến ${endDate}`
            }`}
          />
        ) : (
          employeePairs.map((item) => {
            const { employee, shift, events, validIntervals, lateEarlyStr, overtimeStr } = item;
            const checkInEv = events[0];
            const checkOutEv = events[1];
            const rowKey = `${employee.employee_id}-${item.date}-${shift.name}`;
            const isExpanded = Boolean(expandedRows[rowKey]);

            // Trạng thái hiển thị
            const badge = item.isOffDay
              ? { label: 'Nghỉ (OFF)', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700' }
              : item.isUnassigned
                ? { label: 'Chưa phân ca', color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-300 dark:border-amber-800' }
                : getStatusBadge(checkInEv.status !== 'UNRECORDED' ? checkInEv.status : (checkOutEv.status !== 'UNRECORDED' ? checkOutEv.status : 'UNRECORDED'));

            return (
              <React.Fragment key={rowKey}>
                <tr className="hover:bg-slate-50/90 dark:hover:bg-[#1a1e3a]/50 transition-colors border-b border-slate-200 dark:border-[#202752]">
                  {/* Cột 1: Thông tin nhân viên */}
                  <td className="py-3 px-4 align-middle border-r border-slate-200 dark:border-[#202752] bg-white dark:bg-[#13162b] max-w-[200px]">
                    <div className="flex items-center gap-3 min-w-0" title={employee.full_name}>
                      {employee.avatar ? (
                        <img
                          src={employee.avatar}
                          alt={employee.full_name}
                          className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700/50 flex items-center justify-center font-bold text-purple-600 dark:text-purple-300 shrink-0">
                          {employee.full_name.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 dark:text-white truncate" title={employee.full_name}>
                          {employee.full_name}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate" title={`${employee.employee_id} • ${employee.department}`}>
                          {employee.employee_id} • {employee.department}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Cột 2: Ca làm việc & Ngày */}
                  <td className="py-3 px-3 align-middle text-center border-r border-slate-200 dark:border-[#202752] bg-white dark:bg-[#13162b] max-w-[140px]">
                    <div className="space-y-1 flex flex-col items-center justify-center">
                      <span
                        className="inline-block px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 text-[10px] font-mono font-semibold text-purple-600 dark:text-purple-400 border border-purple-200/80 dark:border-purple-800/40 truncate max-w-full"
                        title={item.date}
                      >
                        {item.date}
                      </span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 truncate text-xs w-full" title={shift.name}>
                        {shift.name}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate w-full" title={shift.timeRange}>
                        {shift.timeRange}
                      </p>
                    </div>
                  </td>

                  {/* Cột 3: Giờ thường (regular_hours) */}
                  <td className="py-3 px-3 align-middle text-center border-r border-slate-200 dark:border-[#202752] bg-white dark:bg-[#13162b]">
                    <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                      {item.regularHours.toFixed(1)}h
                    </span>
                    {item.rawWorkSeconds > 0 && (
                      <p className="text-[10px] text-slate-400 font-mono" title={`Giây gốc quẹt thẻ: ${item.rawWorkSeconds}s`}>
                        Gốc: {item.rawWorkSecondsStr}
                      </p>
                    )}
                  </td>

                  {/* Cột 4: Từng khoảng IN -> OUT hợp lệ */}
                  <td className="py-2.5 px-3 align-middle border-r border-slate-200 dark:border-[#202752] bg-white dark:bg-[#13162b]">
                    {validIntervals && validIntervals.length > 0 ? (
                      <div className="space-y-1 text-left">
                        {validIntervals.map((interval, iIdx) => (
                          <div key={iIdx} className="flex items-center justify-between gap-1 text-[11px] font-mono">
                            {interval.isValid ? (
                              <>
                                <span className="text-slate-800 dark:text-slate-200 font-semibold">
                                  {interval.inTime} → {interval.outTime}
                                </span>
                                <span className="text-[10px] px-1 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 font-bold shrink-0">
                                  {interval.durationStr}
                                </span>
                              </>
                            ) : (
                              <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                {interval.inTime ? `${interval.inTime} (chưa ra)` : `${interval.outTime} (chưa vào)`}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center font-mono text-slate-400 text-xs">--:--:--</div>
                    )}

                    {item.rawEvents && item.rawEvents.length > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleExpand(rowKey)}
                        className="mt-1 text-[10px] text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 flex items-center gap-0.5 cursor-pointer font-sans"
                      >
                        <span>{isExpanded ? 'Ẩn raw log' : `Chi tiết ${item.rawEvents.length} quẹt thẻ`}</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    )}
                  </td>

                  {/* Cột 5: Phương thức / Thiết bị */}
                  <td className="py-2.5 px-3 align-middle text-center border-r border-slate-200 dark:border-[#202752] bg-white dark:bg-[#13162b]">
                    {checkInEv.methodLabel === 'UNRECORDED' && checkOutEv.methodLabel === 'UNRECORDED' ? (
                      <span className="text-slate-400 text-xs font-mono">--</span>
                    ) : (
                      <div className="space-y-0.5 flex flex-col items-center">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 dark:text-slate-200">
                          {checkInEv.isFace ? (
                            <ScanFace className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                          ) : (
                            <Fingerprint className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          )}
                          {checkInEv.methodLabel !== 'UNRECORDED' ? checkInEv.methodLabel : checkOutEv.methodLabel}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-[110px]" title={checkInEv.device_id}>
                          {checkInEv.device_id !== '--' ? checkInEv.device_id : checkOutEv.device_id}
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Cột 6: Độ tin cậy (Điểm thật từ máy) */}
                  <td className="py-2.5 px-3 align-middle font-mono text-xs border-r border-slate-200 dark:border-[#202752] text-center bg-white dark:bg-[#13162b]">
                    {checkInEv.score !== null ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        {(checkInEv.score * 100).toFixed(0)}%
                      </span>
                    ) : checkOutEv.score !== null ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        {(checkOutEv.score * 100).toFixed(0)}%
                      </span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-600">--</span>
                    )}
                  </td>

                  {/* Cột 7: Trạng thái */}
                  <td className="py-2.5 px-3 align-middle border-r border-slate-200 dark:border-[#202752] text-center bg-white dark:bg-[#13162b]">
                    <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold border ${badge.color}`}>
                      {badge.label}
                    </span>
                  </td>

                  {/* Cột 8: Trễ / Sớm */}
                  <td className="py-3 px-3 align-middle font-mono font-bold text-center border-r border-slate-200 dark:border-[#202752] bg-white dark:bg-[#13162b] truncate" title={item.currentLateEarlySec > 0 ? lateEarlyStr : '00:00:00'}>
                    {item.currentLateEarlySec > 0 ? (
                      <span className="text-rose-600 dark:text-rose-400">{lateEarlyStr}</span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500">00:00:00</span>
                    )}
                  </td>

                  {/* Cột 9: Tăng ca (OT đề xuất / chờ duyệt / đã duyệt) */}
                  <td className="py-3 px-3 align-middle font-mono text-center border-r border-slate-200 dark:border-[#202752] bg-white dark:bg-[#13162b]">
                    <div className="space-y-0.5">
                      {item.currentOTSec > 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs block">
                          Đã duyệt: {overtimeStr}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 text-xs block">
                          00:00:00
                        </span>
                      )}
                      {item.pendingOtHours > 0 && (
                        <span className="inline-block text-[10px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/40 px-1 rounded border border-amber-200 dark:border-amber-800" title="Giờ tăng ca đề xuất cần quản lý phê duyệt">
                          Chờ duyệt: {item.pendingOtHours}h
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Cột 10: Rà soát & Cảnh báo Policy */}
                  <td className="py-3 px-3 align-middle text-center border-r border-slate-200 dark:border-[#202752] bg-white dark:bg-[#13162b]">
                    <div className="flex flex-col items-center gap-1">
                      {item.isLegacyNoPolicy ? (
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/30 inline-flex items-center gap-1"
                          title="Bản ghi cũ chưa được đồng bộ Policy Version"
                        >
                          <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>Chưa có Policy</span>
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 inline-flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>{item.policyVersion || 'v1.0'}</span>
                        </span>
                      )}

                      {item.needsReview && (
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-600 border border-rose-500/30 inline-flex items-center gap-1"
                          title={item.reviewReason || 'Cần quản lý rà soát'}
                        >
                          <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                          <span className="truncate max-w-[110px]">{item.reviewReason || 'Cần rà soát'}</span>
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Cột 11: Nút chỉnh sửa */}
                  <td className="py-3 px-3 align-middle text-center bg-white dark:bg-[#13162b]">
                    <ActionEditButton
                      onClick={() => onOpenEditModal(item)}
                      title={item.isOffDay ? 'Điều chỉnh hoặc phê duyệt OT ngày nghỉ (OFF)' : 'Chỉnh sửa giờ trễ/sớm và tăng ca'}
                    />
                  </td>
                </tr>

                {/* Dòng mở rộng: Chi tiết toàn bộ sự kiện quẹt thẻ gốc (Raw Events) */}
                {isExpanded && item.rawEvents && item.rawEvents.length > 0 && (
                  <tr className="bg-slate-50/80 dark:bg-[#0f1224]/80 border-b border-slate-200 dark:border-[#202752]">
                    <td colSpan={11} className="py-3 px-6">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-purple-600" />
                            Toàn bộ lịch sử quẹt thẻ gốc ({item.rawEvents.length} lượt ghi nhận máy):
                          </span>
                          <span className="text-[11px] text-slate-400 font-normal">
                            * Sự kiện lẻ được hiển thị rõ ràng nhưng không tự động sinh giờ công sai lệch
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {item.rawEvents.map((ev, eIdx) => (
                            <div
                              key={eIdx}
                              className="p-2 rounded-lg bg-white dark:bg-[#13162b] border border-slate-200 dark:border-[#21264b] text-[11px] space-y-0.5"
                            >
                              <div className="flex items-center justify-between font-mono font-semibold">
                                <span className={ev.type === 'CHECK_IN' ? 'text-indigo-600 dark:text-indigo-400' : 'text-purple-600 dark:text-purple-400'}>
                                  {ev.label}
                                </span>
                                <span className="text-slate-900 dark:text-white">{ev.time}</span>
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                                <span>{ev.methodLabel}</span>
                                <span>{ev.device_id}</span>
                              </div>
                              {ev.score !== null && (
                                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                                  Tin cậy: {(ev.score * 100).toFixed(0)}%
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })
        )}
      </TableBody>
    </TableContainer>
  );
};
