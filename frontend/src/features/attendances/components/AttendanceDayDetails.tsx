import { AttendanceEventBadge } from '../../../components/common/AttendanceEventBadge';
import React, { useState } from 'react';
import { formatSecondsToHHMMSS } from '../../../utils/timeUtils';
import { AttendancePairItem } from '../hooks/useAttendancePairs';
import { formatVNDateISO } from '../../../utils/dateUtils';

export type AttendanceLogFilter = 'ALL' | 'MATCHED' | 'COUNTED';
export function AttendanceLogFilterSelect({ value, onChange }: { value: AttendanceLogFilter; onChange: (value: AttendanceLogFilter) => void }) {
  return <label className="flex flex-wrap gap-2 items-center text-sm text-slate-800 dark:text-slate-100">Hiển thị lượt
    <select aria-label="Lọc lượt chấm công" value={value} onChange={e => onChange(e.target.value as AttendanceLogFilter)} className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2">
      <option value="ALL">Tất cả lượt checkin / checkout</option>
      <option value="MATCHED">Chỉ lượt ghép cặp hợp lệ</option>
      <option value="COUNTED">Chỉ lượt được ghép cặp và tính giờ</option>
    </select>
  </label>;
}
export function AttendanceDayDetails({ item, filter, showFilter = true }: { item: AttendancePairItem; filter?: AttendanceLogFilter; showFilter?: boolean }) {
  const [localFilter, setLocalFilter] = useState<AttendanceLogFilter>('ALL');
  const mode = filter ?? localFilter;
  const intervals = mode === 'COUNTED' ? item.validIntervals.filter(p => p.counted) : item.validIntervals;
  const visibleIds = new Set(intervals.flatMap(p => [p.inId, p.outId]));
  const events = mode === 'ALL' ? item.rawEvents : item.rawEvents.filter(ev => visibleIds.has(ev.id));
  const reason = (code: string) => item.reasonLabels?.[code] || 'Dữ liệu chấm công cần xác minh';
  const reviewText = item.reviewReason?.split(',').filter(Boolean).map(reason).join('; ');
  return <div className="space-y-4 text-slate-800 dark:text-slate-100 text-sm">
    {showFilter && <AttendanceLogFilterSelect value={localFilter} onChange={setLocalFilter} />}
    <p className="text-xs text-slate-500">Công ngày đã ghi: {item.workingHours}h. Công cả ca được ghi một lần tại checkout đầu tiên đạt ngưỡng ghi công của ngày; OT đề xuất cần duyệt riêng.</p>
    {item.needsReview && <p className="text-amber-600">Cần xác minh: {reviewText || 'Dữ liệu chấm công chưa đầy đủ'}</p>}
    {item.hasPairData === false && <p role="status" className="text-amber-600">Chưa có kết quả ghép cặp từ bản tổng hợp. Các lượt bên dưới vẫn được giữ; cần tải lại hoặc tính lại công.</p>}
    <div>
      <h4 className="font-semibold mb-2">Các cặp vào → ra ({intervals.length})</h4>
      {!intervals.length && item.hasPairData !== false && <p className="text-slate-500">{mode === 'COUNTED' ? 'Không có cặp đủ điều kiện tính giờ trong bộ lọc này.' : 'Chưa có cặp hợp lệ.'}</p>}
      {intervals.map((p,i) => <div key={i} className="flex flex-wrap justify-between gap-2 py-1 font-mono text-xs"><span>{p.inTime} → {p.outTime}</span><span>{p.durationStr}</span></div>)}
    </div>
    <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs">
      <caption className="text-left font-semibold pb-2">Lịch sử checkin / checkout ({events.length} lượt)</caption>
      <thead><tr>{['Thời điểm', 'Sự kiện', 'Phương thức / thiết bị', 'Tính hợp lệ / ghép cặp', 'Thời gian hợp lệ / công đã ghi tại checkout'].map(t => <th className="p-2" key={t}>{t}</th>)}</tr></thead>
      <tbody>{events.map(ev => {
        const pair = item.validIntervals.find(p => p.outId === ev.id);
        const matched = pair || item.validIntervals.some(p => p.inId === ev.id);
        return <tr key={ev.id} className="border-t border-slate-200 dark:border-slate-700">
          <td className="p-2 font-mono whitespace-nowrap">{ev.timestamp ? formatVNDateISO(ev.timestamp) : ''} {ev.time}</td>
          <td className="p-2"><AttendanceEventBadge type={ev.type}/></td>
          <td className="p-2">{ev.methodLabel} · {ev.device_id}</td>
          <td className="p-2">{ev.rawStatus || '—'} · {matched ? 'Đã ghép cặp' : ev.pairingReason ? reason(ev.pairingReason) : item.hasPairData === false ? 'Chờ kết quả tổng hợp' : 'Chưa ghép cặp'}</td>
          <td className="p-2">{pair ? <div className="space-y-1">
            <div className="font-mono">Thời lượng cặp: {pair.durationStr}</div>
            {typeof pair.creditedRegularSeconds === 'number' ? <>
              <div className="font-mono">{formatSecondsToHHMMSS(pair.regularSeconds || 0)} trong ca · {formatSecondsToHHMMSS(pair.overtimeSeconds || 0)} OT đề xuất</div>
              <div className="font-semibold">Công ghi nhận: +{formatSecondsToHHMMSS(pair.creditedRegularSeconds)}</div>
              {pair.creditReason && <div className="text-slate-500">{reason(pair.creditReason)}</div>}
            </> : <div className="text-amber-600">Bản tổng hợp cũ chưa có chi tiết công tại checkout; công ngày đã ghi {item.workingHours}h.</div>}
          </div> : ev.type === 'CHECK_OUT' ? 'Chưa có cặp hợp lệ để ghi công' : '—'}</td>
        </tr>;
      })}</tbody>
    </table>{!events.length && <p className="py-3 text-slate-500">Không có lượt phù hợp bộ lọc.</p>}</div>
  </div>;
}
