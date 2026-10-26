import { AttendanceDayDetails } from './AttendanceDayDetails';
import React, { useState } from 'react';
import { ScanFace, Fingerprint, Edit, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { AttendancePairItem, AttendanceEventItem } from '../hooks/useAttendancePairs';
import {
  TableContainer,
  TableHead,
  TableHeadRow,
  TableHeadCell,
  TableBody,
  TableEmpty,
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

  /**
   * Đồng bộ duy nhất 3 trạng thái:
   * 1. Đúng giờ (xanh lá)
   * 2. Đi muộn (đỏ)
   * 3. Về sớm (đỏ)
   * Nếu chưa có lượt quẹt thì hiển thị "--"
   */
  const renderEventStatusBadge = (ev: AttendanceEventItem) => {
    if (!ev.time || ev.time === '--:--:--') {
      return <span className="text-slate-500 font-mono text-xs">--</span>;
    }

    if (ev.status === 'UNRECORDED' || ev.statusText === 'UNRECORDED') {
      return (
        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#171b30] text-slate-400 border border-slate-700/60 whitespace-nowrap">
          UNRECORDED
        </span>
      );
    }

    if (ev.status === 'LATE' || ev.statusText === 'Đi muộn' || ev.statusText === 'Đi trễ') {
      return (
        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#38101a] text-rose-400 border border-rose-800/80 whitespace-nowrap">
          Đi muộn
        </span>
      );
    }

    if (ev.status === 'EARLY_LEAVE' || ev.statusText === 'Về sớm') {
      return (
        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#38101a] text-rose-400 border border-rose-800/80 whitespace-nowrap">
          Về sớm
        </span>
      );
    }

    // Mặc định chuẩn giờ khi đã quẹt trong ca
    return (
      <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#0c2a20] text-emerald-400 border border-emerald-800/80 whitespace-nowrap">
        Đúng giờ
      </span>
    );
  };

  /**
   * Render phương thức: icon + Face-id hoặc badge UNRECORDED
   */
  const renderMethod = (ev: AttendanceEventItem) => {
    if (ev.methodLabel === 'UNRECORDED' || !ev.time || ev.time === '--:--:--') {
      return (
        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#171b30] text-slate-400 border border-slate-700/60 whitespace-nowrap">
          UNRECORDED
        </span>
      );
    }

    return (
      <div className="flex items-center justify-center gap-1.5 text-xs text-slate-200 whitespace-nowrap">
        {ev.isFace ? (
          <ScanFace className="w-3.5 h-3.5 text-purple-400 shrink-0" />
        ) : (
          <Fingerprint className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        )}
        <span className="font-medium">{ev.methodLabel || 'Face-id'}</span>
      </div>
    );
  };

  /**
   * Render điểm tin cậy: số % xanh lá hoặc --
   */
  const renderScore = (score: number | null) => {
    if (score === null || score === undefined) {
      return <span className="text-slate-500 font-mono text-xs">--</span>;
    }
    return (
      <span className="text-emerald-400 font-mono font-bold text-xs whitespace-nowrap">
        {(score * 100).toFixed(0)}%
      </span>
    );
  };

  return (
    <TableContainer minWidth="100%">
      <TableHead>
        <TableHeadRow>
          <TableHeadCell width="18%" align="center" className="!py-2.5 !px-2">NHÂN VIÊN</TableHeadCell>
          <TableHeadCell width="11%" align="center" className="!py-2.5 !px-1.5">CA LÀM VIỆC</TableHeadCell>
          <TableHeadCell width="8%" align="center" className="!py-2.5 !px-1">SỰ KIỆN</TableHeadCell>
          <TableHeadCell width="9%" align="center" className="!py-2.5 !px-1">THỜI GIAN</TableHeadCell>
          <TableHeadCell width="11%" align="center" className="!py-2.5 !px-1.5">PHƯƠNG THỨC</TableHeadCell>
          <TableHeadCell width="8%" align="center" className="!py-2.5 !px-1">ĐỘ TIN CẬY</TableHeadCell>
          <TableHeadCell width="10%" align="center" className="!py-2.5 !px-1">TRẠNG THÁI</TableHeadCell>
          <TableHeadCell width="9%" align="center" className="!py-2.5 !px-1">TRỄ / SỚM</TableHeadCell>
          <TableHeadCell width="9%" align="center" className="!py-2.5 !px-1">TĂNG CA</TableHeadCell>
          <TableHeadCell width="7%" align="center" isLast className="!py-2.5 !px-1">THAO TÁC</TableHeadCell>
        </TableHeadRow>
      </TableHead>
      <TableBody>
        {employeePairs.length === 0 ? (
          <TableEmpty
            colSpan={10}
            message={`Không tìm thấy bản ghi chấm công nào phù hợp ${
              startDate === endDate ? `cho ngày ${startDate}` : `trong khoảng từ ${startDate} đến ${endDate}`
            }`}
          />
        ) : (
          employeePairs.map((item) => {
            const { employee, shift, events, lateEarlyStr, overtimeStr } = item;
            const checkInEv = events[0] || {
              type: 'CHECK_IN',
              label: 'Vào Ca',
              time: '--:--:--',
              isFace: true,
              methodLabel: 'UNRECORDED',
              device_id: '--',
              score: null,
              status: 'UNRECORDED',
              statusText: '--',
            };
            const checkOutEv = events[1] || {
              type: 'CHECK_OUT',
              label: 'Hết ca',
              time: '--:--:--',
              isFace: true,
              methodLabel: 'UNRECORDED',
              device_id: '--',
              score: null,
              status: 'UNRECORDED',
              statusText: '--',
            };

            const rowKey = `${employee.employee_id}-${item.date}-${shift.name}`;
            const isExpanded = Boolean(expandedRows[rowKey]);

            return (
              <React.Fragment key={rowKey}>
                {/* DÒNG 1: Gồm 5 cột gộp (rowSpan=2) và các thông số VÀO CA */}
                <tr className="hover:bg-slate-50/50 dark:hover:bg-[#161a38]/40 transition-colors">
                  {/* Cột 1: NHÂN VIÊN (rowSpan=2) */}
                  <td
                    rowSpan={2}
                    className="py-2.5 px-3 align-middle border-r border-slate-200 dark:border-[#202752] border-b border-slate-200 dark:border-[#202752] bg-white dark:bg-[#0f1224]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0" title={employee.full_name}>
                      {employee.avatar ? (
                        <img
                          src={employee.avatar}
                          alt={employee.full_name}
                          className="w-8 h-8 rounded-full object-cover border border-slate-300 dark:border-slate-700 shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-purple-50 dark:bg-purple-900/40 border border-purple-200 dark:border-purple-700/50 flex items-center justify-center font-bold text-purple-600 dark:text-purple-300 shrink-0 text-xs">
                          {employee.full_name.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900 dark:text-white truncate text-xs" title={employee.full_name}>
                          {employee.full_name}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate" title={employee.employee_id}>
                          {employee.employee_id}
                        </p>
                        {item.rawEvents && item.rawEvents.length > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleExpand(rowKey)}
                            className="mt-0.5 text-[9px] text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 flex items-center gap-0.5 cursor-pointer font-sans"
                          >
                            <span>{isExpanded ? 'Ẩn' : `${item.rawEvents.length} lượt · xem chi tiết`}</span>
                            {isExpanded ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                          </button>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Cột 2: CA LÀM VIỆC (rowSpan=2) - Thu hẹp gọn gàng */}
                  <td
                    rowSpan={2}
                    className="py-2.5 px-2 align-middle text-center border-r border-slate-200 dark:border-[#202752] border-b border-slate-200 dark:border-[#202752] bg-white dark:bg-[#0f1224]"
                  >
                    <div className="space-y-0.5 flex flex-col items-center justify-center">
                      <span
                        className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-50 dark:bg-[#3b174a]/60 text-purple-600 dark:text-[#d884ff] border border-purple-200/80 dark:border-[#792e99]/60 whitespace-nowrap"
                        title={item.date}
                      >
                        {item.date}
                      </span>
                      <p className="font-bold text-slate-800 dark:text-slate-200 truncate text-xs w-full" title={shift.name}>
                        {shift.name}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate w-full" title={shift.timeRange}>
                        {shift.timeRange}
                      </p>
                    </div>
                  </td>

                  {/* Cột 3: SỰ KIỆN - Vào Ca (Căn giữa, có đường kẻ đáy) */}
                  <td className="py-2.5 px-2 align-middle text-center border-r border-slate-200 dark:border-[#202752] border-b border-slate-200 dark:border-[#202752] bg-white dark:bg-[#0f1224]">
                    <div className="flex items-center justify-center gap-1.5 text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0 shadow-[0_0_6px_rgba(56,189,248,0.6)]"></span>
                      <span className="text-sky-600 dark:text-sky-300 font-medium whitespace-nowrap">Vào Ca</span>
                    </div>
                  </td>

                  {/* Cột 4: THỜI GIAN - Giờ vào (Có đường kẻ đáy) */}
                  <td className="py-2.5 px-2 align-middle text-center font-mono font-semibold text-xs border-r border-slate-200 dark:border-[#202752] border-b border-slate-200 dark:border-[#202752] bg-white dark:bg-[#0f1224] whitespace-nowrap">
                    {checkInEv.time && checkInEv.time !== '--:--:--' ? (
                      <span className="text-slate-900 dark:text-slate-100">{checkInEv.time}</span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500">--:--:--</span>
                    )}
                  </td>

                  {/* Cột 5: PHƯƠNG THỨC - Vào (Có đường kẻ đáy) */}
                  <td className="py-2.5 px-2 align-middle text-center border-r border-slate-200 dark:border-[#202752] border-b border-slate-200 dark:border-[#202752] bg-white dark:bg-[#0f1224]">
                    {renderMethod(checkInEv)}
                  </td>

                  {/* Cột 6: ĐỘ TIN CẬY - Vào (Có đường kẻ đáy) */}
                  <td className="py-2.5 px-1.5 align-middle text-center border-r border-slate-200 dark:border-[#202752] border-b border-slate-200 dark:border-[#202752] bg-white dark:bg-[#0f1224]">
                    {renderScore(checkInEv.score)}
                  </td>

                  {/* Cột 7: TRẠNG THÁI - Vào (Có đường kẻ đáy) */}
                  <td className="py-2.5 px-2 align-middle text-center border-r border-slate-200 dark:border-[#202752] border-b border-slate-200 dark:border-[#202752] bg-white dark:bg-[#0f1224]">
                    {renderEventStatusBadge(checkInEv)}
                  </td>

                  {/* Cột 8: TRỄ / SỚM (rowSpan=2) */}
                  <td
                    rowSpan={2}
                    className="py-2.5 px-2 align-middle text-center font-mono text-xs border-r border-slate-200 dark:border-[#202752] border-b border-slate-200 dark:border-[#202752] bg-white dark:bg-[#0f1224] whitespace-nowrap"
                  >
                    {item.currentLateEarlySec > 0 ? (
                      <span className="text-rose-600 dark:text-rose-400 font-bold">{lateEarlyStr}</span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500">00:00:00</span>
                    )}
                  </td>

                  {/* Cột 9: TĂNG CA (rowSpan=2) */}
                  <td
                    rowSpan={2}
                    className="py-2.5 px-2 align-middle text-center font-mono text-xs border-r border-slate-200 dark:border-[#202752] border-b border-slate-200 dark:border-[#202752] bg-white dark:bg-[#0f1224] whitespace-nowrap"
                  >
                    {!item.hasCheckedOut && item.hasCheckedIn ? (
                      <span className="text-slate-400 dark:text-slate-500">--:--:--</span>
                    ) : item.currentOTSec > 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">{overtimeStr}</span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500">00:00:00</span>
                    )}
                  </td>

                  {/* Cột 10: THAO TÁC (rowSpan=2) */}
                  <td
                    rowSpan={2}
                    className="py-2.5 px-1.5 align-middle text-center border-b border-slate-200 dark:border-[#202752] bg-white dark:bg-[#0f1224]"
                  >
                    <button
                      type="button"
                      onClick={() => onOpenEditModal(item)}
                      className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#181d38] dark:hover:bg-[#232a52] text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-[#2b3563] text-xs font-medium transition-all shadow-xs cursor-pointer group whitespace-nowrap"
                      title={item.isOffDay ? 'Điều chỉnh hoặc phê duyệt OT ngày nghỉ (OFF)' : 'Chỉnh sửa giờ trễ/sớm và tăng ca'}
                    >
                      <Edit className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors" />
                      <span>Sửa</span>
                    </button>
                  </td>
                </tr>

                {/* DÒNG 2: Chỉ gồm 5 ô tương ứng của HẾT CA (có đường kẻ đáy) */}
                <tr className="hover:bg-slate-50/50 dark:hover:bg-[#161a38]/40 transition-colors border-b border-slate-200 dark:border-[#202752]">
                  {/* Cột 3: SỰ KIỆN - Hết ca (Căn giữa) */}
                  <td className="py-2.5 px-2 align-middle text-center border-r border-slate-200 dark:border-[#202752] border-b border-slate-200 dark:border-[#202752] bg-white dark:bg-[#0f1224]">
                    <div className="flex items-center justify-center gap-1.5 text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 shrink-0 shadow-[0_0_6px_rgba(232,121,249,0.6)]"></span>
                      <span className="text-fuchsia-600 dark:text-fuchsia-300 font-medium whitespace-nowrap">Hết ca</span>
                    </div>
                  </td>

                  {/* Cột 4: THỜI GIAN - Giờ ra */}
                  <td className="py-2.5 px-2 align-middle text-center font-mono font-semibold text-xs border-r border-slate-200 dark:border-[#202752] border-b border-slate-200 dark:border-[#202752] bg-white dark:bg-[#0f1224] whitespace-nowrap">
                    {checkOutEv.time && checkOutEv.time !== '--:--:--' ? (
                      <span className="text-slate-900 dark:text-slate-100">{checkOutEv.time}</span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500">--:--:--</span>
                    )}
                  </td>

                  {/* Cột 5: PHƯƠNG THỨC - Ra */}
                  <td className="py-2.5 px-2 align-middle text-center border-r border-slate-200 dark:border-[#202752] border-b border-slate-200 dark:border-[#202752] bg-white dark:bg-[#0f1224]">
                    {renderMethod(checkOutEv)}
                  </td>

                  {/* Cột 6: ĐỘ TIN CẬY - Ra */}
                  <td className="py-2.5 px-1.5 align-middle text-center border-r border-slate-200 dark:border-[#202752] border-b border-slate-200 dark:border-[#202752] bg-white dark:bg-[#0f1224]">
                    {renderScore(checkOutEv.score)}
                  </td>

                  {/* Cột 7: TRẠNG THÁI - Ra */}
                  <td className="py-2.5 px-2 align-middle text-center border-r border-slate-200 dark:border-[#202752] border-b border-slate-200 dark:border-[#202752] bg-white dark:bg-[#0f1224]">
                    {renderEventStatusBadge(checkOutEv)}
                  </td>
                </tr>

                {/* Dòng mở rộng: Chi tiết toàn bộ sự kiện quẹt thẻ gốc (nếu được bấm) */}
                {isExpanded && item.rawEvents && item.rawEvents.length > 0 && (
                  <tr className="bg-slate-50/80 dark:bg-[#0c0e1e] border-b border-slate-200 dark:border-[#202752]">
                    <td colSpan={10} className="py-3 px-6">
                      <AttendanceDayDetails item={item} />
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
