import React, { useState } from 'react';
import {
  TableContainer,
  TableHead,
  TableHeadRow,
  TableHeadCell,
  TableBody,
  TableRow,
  TableCell,
  TableEmpty,
  FilterSelect,
} from '../../../components/common';
import { AttendanceEventBadge } from '../../../components/common/AttendanceEventBadge';
import { AttendancePairItem } from '../hooks/useAttendancePairs';
import { formatVNDateISO } from '../../../utils/dateUtils';
import { formatSecondsToHHMMSS, parseTimeToSeconds } from '../../../utils/timeUtils';

export type AttendanceLogFilter = 'ALL' | 'MATCHED' | 'COUNTED';
export function AttendanceLogFilterSelect({ value, onChange }: { value: AttendanceLogFilter; onChange: (value: AttendanceLogFilter) => void }) {
  return <FilterSelect label="Hiển thị lượt:" value={value} onChange={next => onChange(next as AttendanceLogFilter)} className="flex-wrap" widthClass="w-[280px] max-w-full" maxTruncateLen={45} options={[
    { value: 'ALL', label: 'Tất cả lượt checkin / checkout' },
    { value: 'MATCHED', label: 'Chỉ lượt ghép cặp hợp lệ' },
    { value: 'COUNTED', label: 'Chỉ lượt được ghép cặp và tính giờ' },
  ]}/>;
}
export const DEFAULT_ATTENDANCE_REASONS: Record<string, string> = {
  MISSING_CHECK_OUT: 'Thiếu lượt check-out',
  UNPAIRED_CHECK_OUT: 'Thiếu check-in cho lượt check-out',
  NO_VALID_PAIR: 'Không có cặp vào và ra hợp lệ',
  INVALID_PAIR: 'Cặp vào và ra không hợp lệ',
  FLAGGED_EVENT: 'Có lượt chấm công cần xác minh',
  REPLACED_CHECK_IN: 'Lượt check-in được thay bằng lượt vào sau',
  INTERRUPTED_PAIR: 'Cặp vào và ra bị gián đoạn',
  UNDER_MINIMUM_SHIFT: 'Chưa đạt ngưỡng 2/3 ca',
  MINIMUM_SHIFT_REACHED: 'Đã đạt ngưỡng 2/3 ca',
  UNDER_HALF_SHIFT: 'Chưa đạt ngưỡng nửa ca',
  HALF_SHIFT_REACHED: 'Đã đạt ngưỡng nửa ca',
  OFF: 'Ngày OFF, không tự ghi công',
  NO_SHIFT: 'Chưa phân ca',
};

export function AttendanceDayDetails({ item, filter, showFilter = true }: { item: AttendancePairItem; filter?: AttendanceLogFilter; showFilter?: boolean }) {
  const [localFilter, setLocalFilter] = useState<AttendanceLogFilter>('ALL');
  const mode = filter ?? localFilter;
  const intervals = mode === 'COUNTED' ? item.validIntervals.filter(p => p.counted) : item.validIntervals;
  const visibleIds = new Set(intervals.flatMap(p => [p.inId, p.outId]));
  const events = mode === 'ALL' ? item.rawEvents : item.rawEvents.filter(ev => visibleIds.has(ev.id));
  const displayedEventIds = new Set(events.map(ev => ev.id));
  const actualWorkSeconds = intervals.reduce((total, pair) =>
    total + (pair.outId && displayedEventIds.has(pair.outId) ? parseTimeToSeconds(pair.durationStr) ?? 0 : 0), 0);
  const reason = (code: string) => item.reasonLabels?.[code] || DEFAULT_ATTENDANCE_REASONS[code] || (code === 'NO_SHIFT' ? 'Chưa phân ca' : 'Dữ liệu chấm công cần xác minh');
  const reviewText = item.reviewReason?.split(',').filter(Boolean).map(reason).join('; ');

  const hasScans = item.hasCheckedIn || item.hasCheckedOut || item.rawEvents.length > 0;
  const isZeroWorkHours = Number(item.workingHours || 0) === 0;

  return (
    <div className="space-y-4 text-slate-800 dark:text-slate-100 text-sm">
      {showFilter && <AttendanceLogFilterSelect value={localFilter} onChange={setLocalFilter} />}
      {item.needsReview && <p className="text-amber-600">Cần xác minh: {reviewText || 'Dữ liệu chấm công chưa đầy đủ'}</p>}
      {item.hasPairData === false && (
        <p role="status" className="text-amber-600">
          Chưa có kết quả ghép cặp từ bản tổng hợp. Các lượt bên dưới vẫn được giữ; cần tải lại hoặc tính lại công.
        </p>
      )}

      <div className="space-y-2">
        <div className="font-semibold text-xs text-slate-700 dark:text-slate-300">
          Lịch sử checkin / checkout ({events.length} lượt)
        </div>

        <TableContainer minWidth="860px" maxHeight="none">
          <TableHead>
            <TableHeadRow>
              <TableHeadCell width="18%" align="left" className="!py-2.5 !px-3 font-semibold">
                Thời điểm
              </TableHeadCell>
              <TableHeadCell width="10%" align="center" className="!py-2.5 !px-2 font-semibold">
                Sự kiện
              </TableHeadCell>
              <TableHeadCell width="18%" align="left" className="!py-2.5 !px-3 font-semibold">
                Phương thức / thiết bị
              </TableHeadCell>
              <TableHeadCell width="18%" align="left" className="!py-2.5 !px-3 font-semibold">
                Tính hợp lệ / ghép cặp
              </TableHeadCell>
              <TableHeadCell width="16%" align="left" className="!py-2.5 !px-3 font-semibold">
                Thời gian làm việc
              </TableHeadCell>
              <TableHeadCell width="20%" align="left" isLast className="!py-2.5 !px-3 font-semibold">
                Thống kê
              </TableHeadCell>
            </TableHeadRow>
          </TableHead>
          <TableBody>
            {events.length === 0 ? (
              <TableEmpty
                colSpan={6}
                message={
                  <div className="py-2 text-center">
                    <div className="text-rose-600 dark:text-rose-400 font-semibold text-sm">
                      {item.isOffDay ? 'Nghỉ tuần / Nghỉ lễ' : 'Nghỉ làm không lý do'}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {item.isOffDay
                        ? 'Ngày nghỉ theo lịch, không có lượt chấm công'
                        : 'Không có dữ liệu checkin / checkout trong ca làm việc'}
                    </div>
                  </div>
                }
              />
            ) : (
              events.map((ev, idx) => {
                // Tìm xem lượt hiện tại có phải là điểm bắt đầu của một cặp hợp lệ (và lượt kế tiếp là checkout của cặp đó)
                const pairStartingHere = item.validIntervals.find(
                  p => p.inId === ev.id && events[idx + 1]?.id === p.outId
                );
                // Kiểm tra xem lượt hiện tại có phải là điểm kết thúc của cặp liền trước
                const isPairSecondRow = item.validIntervals.some(
                  p => p.outId === ev.id && events[idx - 1]?.id === p.inId
                );

                // Trường hợp lượt đơn lẻ có kết quả pair riêng
                const singlePair = !pairStartingHere && !isPairSecondRow
                  ? item.validIntervals.find(p => p.outId === ev.id)
                  : null;
                const isMatchedSingle = Boolean(singlePair || item.validIntervals.some(p => p.inId === ev.id));

                return (
                  <TableRow key={ev.id}>
                    {/* Cột 1: Thời điểm */}
                    <TableCell align="left" className="!py-2.5 !px-3 font-mono whitespace-nowrap">
                      {ev.timestamp ? formatVNDateISO(ev.timestamp) : ''} {ev.time}
                    </TableCell>

                    {/* Cột 2: Sự kiện */}
                    <TableCell align="center" className="!py-2.5 !px-2">
                      <AttendanceEventBadge type={ev.type} />
                    </TableCell>

                    {/* Cột 3: Phương thức / thiết bị */}
                    <TableCell align="left" className="!py-2.5 !px-3">
                      {ev.methodLabel} · {ev.device_id}
                    </TableCell>

                    {/* Cột 4: Tính hợp lệ / ghép cặp (Gộp 2 hàng nếu thuộc cặp) */}
                    {pairStartingHere ? (
                      <TableCell
                        rowSpan={2}
                        align="left"
                        className="!py-2.5 !px-3 align-middle font-medium text-emerald-600 dark:text-emerald-400"
                      >
                        {ev.rawStatus || 'VALID'} · Đã ghép cặp
                      </TableCell>
                    ) : !isPairSecondRow ? (
                      <TableCell
                        align="left"
                        className={`!py-2.5 !px-3 ${
                          !isMatchedSingle
                            ? 'font-semibold text-rose-600 dark:text-rose-400'
                            : 'font-medium text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {ev.rawStatus || '—'} · {isMatchedSingle ? 'Đã ghép cặp' : ev.pairingReason ? reason(ev.pairingReason) : item.hasPairData === false ? 'Chờ kết quả tổng hợp' : 'Chưa ghép cặp'}
                      </TableCell>
                    ) : null}

                    {/* Cột 5: Thời gian làm việc (Gộp 2 hàng nếu thuộc cặp, chỉ hiển thị Thời lượng cặp:) */}
                    {pairStartingHere ? (
                      <TableCell
                        rowSpan={2}
                        align="left"
                        className="!py-2.5 !px-3 align-middle font-mono"
                      >
                        Thời lượng cặp: {pairStartingHere.durationStr}
                      </TableCell>
                    ) : !isPairSecondRow ? (
                      <TableCell align="left" className="!py-2.5 !px-3 font-mono">
                        {singlePair ? `Thời lượng cặp: ${singlePair.durationStr}` : ev.type === 'CHECK_OUT' ? 'Chưa có cặp hợp lệ để ghi công' : '—'}
                      </TableCell>
                    ) : null}

                    {/* Cột 6: Thống kê (Gộp toàn bộ các hàng lại làm 1) */}
                    {idx === 0 && (
                      <TableCell
                        rowSpan={events.length}
                        isLast
                        align="left"
                        className="!py-3 !px-3.5 align-middle bg-slate-50/60 dark:bg-[#181c38]/40 whitespace-nowrap"
                      >
                        <div className="space-y-1.5 text-xs whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">Thời gian làm thực:</span>
                            <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                              {formatSecondsToHHMMSS(actualWorkSeconds)}
                            </span>
                          </div>
                          {/* Mục 1: Giờ làm */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">Giờ làm:</span>
                            <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                              {formatSecondsToHHMMSS(Number(item.workingHours || 0) * 3600)}
                            </span>
                            {isZeroWorkHours && (
                              hasScans ? (
                                <span className="text-amber-600 dark:text-amber-400 font-semibold text-[11px]">
                                  (Chưa đạt ngưỡng 2/3 ca)
                                </span>
                              ) : (item.isAbsent || item.status === 'ABSENT') ? (
                                <span className="text-rose-600 dark:text-rose-400 font-semibold text-[11px]">
                                  (Nghỉ làm không lý do)
                                </span>
                              ) : null
                            )}
                          </div>

                          {/* Mục 2: Trễ / Sớm hoặc Tăng ca (chỉ hiện khi có) */}
                          {item.currentLateEarlySec > 0 && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-500 dark:text-slate-400 font-medium">Trễ / Sớm:</span>
                              <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">
                                {item.lateEarlyStr}
                              </span>
                            </div>
                          )}
                          {item.currentOTSec > 0 && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-500 dark:text-slate-400 font-medium">Tăng ca:</span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                                {item.overtimeStr}
                              </span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </TableContainer>
      </div>
    </div>
  );
}
