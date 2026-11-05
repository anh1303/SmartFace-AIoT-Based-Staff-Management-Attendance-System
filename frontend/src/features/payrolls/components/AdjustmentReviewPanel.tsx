import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { apiFetch } from '../../../api/client';
import { FilterBar, FilterSelect, SearchInput, TableContainer, TableHead, TableHeadRow, TableHeadCell, TableBody, TableRow, TableCell, TableEmpty } from '../../../components/common';
import type { WorkShift } from '../../../types';

export interface AttendanceAdjustment {
  id: string;
  employee_id: string;
  employee_name: string;
  date: string;
  kind: 'OVERTIME' | 'LATE_EARLY' | 'ABSENCE';
  hours: number;
  amount: number | null;
  amount_unavailable?: boolean;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'VOID';
  note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  updated_at: string;
  can_review: boolean;
  locked?: boolean;
}
export const adjustmentLabels = { OVERTIME: 'Tăng ca', LATE_EARLY: 'Phạt trễ / sớm', ABSENCE: 'Phạt vắng ca' };
const statuses = { PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt' } as const;
const money = (n: number | null) => n == null ? 'Chưa có đơn giá đối chiếu' : `${Number(n).toLocaleString('vi-VN')} ₫`;
export function filterAdjustments(items: AttendanceAdjustment[], status: string, kind: string, search: string) { const q = search.trim().toLocaleLowerCase('vi-VN'); return items.filter(i => (status === 'ALL' || i.status === status) && (kind === 'ALL' || i.kind === kind) && (!q || `${i.employee_name} ${i.employee_id} ${i.date}`.toLocaleLowerCase('vi-VN').includes(q))); }
export function canReviewAdjustment(item: AttendanceAdjustment) { return item.can_review && item.amount != null && !item.amount_unavailable && !item.locked && item.status !== 'VOID'; }

export function AdjustmentReviewPanel({ period, employeeId, workShifts = [], startDate = '', endDate = '' }: { period: string; employeeId?: string; workShifts?: WorkShift[]; startDate?: string; endDate?: string }) {
  const [params, setParams] = useSearchParams();
  const requestedStatus = params.get('reviewStatus');
  const status = requestedStatus === 'PENDING' || requestedStatus === 'APPROVED' ? requestedStatus : 'ALL';
  const kind = params.get('reviewKind') || 'ALL', search = params.get('reviewSearch') || '';
  const setFilter = (name: string, value: string) => setParams(previous => { const next = new URLSearchParams(previous); if (value) next.set(name, value); else next.delete(name); return next; }, { replace: true });
  const query = useQuery({ queryKey: ['attendanceAdjustments', period, employeeId || 'ALL'], queryFn: async (): Promise<AttendanceAdjustment[]> => {
    const p = new URLSearchParams({ period });
    if (employeeId) p.set('employeeId', employeeId);
    const res = await apiFetch(`/api/payroll/adjustments?${p}`);
    if (!res.success) throw new Error(res.message || 'Không tải được OT và các khoản phạt');
    return res.data;
  } });
  const items = (query.data || []).filter(item => (item.status === 'PENDING' || item.status === 'APPROVED') && (!startDate || item.date >= startDate) && (!endDate || item.date <= endDate));
  const visible = filterAdjustments(items, status, kind, search).sort((a, b) => b.date.localeCompare(a.date) || a.employee_name.localeCompare(b.employee_name));

  return <section className="space-y-4" aria-label="Các khoản thưởng phạt trong kỳ">
    <div className="sf-summary"><span>Chờ duyệt: <strong>{items.filter(i => i.status === 'PENDING').length} khoản</strong></span><span>Đã duyệt: <strong>{items.filter(i => i.status === 'APPROVED').length} khoản</strong></span></div>
    <FilterBar><label className="w-full lg:w-96"><span className="sr-only">Tìm khoản phát sinh</span><SearchInput value={search} onChange={value => setFilter('reviewSearch', value)} placeholder="Tên nhân viên, mã hoặc ngày…" containerClassName="relative w-full" /></label><div className="flex flex-wrap items-center gap-4 w-full lg:w-auto"><FilterSelect label="Loại khoản:" value={kind} onChange={value => setFilter('reviewKind', value)} allLabel="Tất cả loại khoản" options={Object.entries(adjustmentLabels).map(([value, label]) => ({ value, label }))} widthClass="w-[180px]"/><FilterSelect label="Trạng thái:" value={status} onChange={value => setFilter('reviewStatus', value)} allLabel="Tất cả trạng thái" options={Object.entries(statuses).map(([value, label]) => ({ value, label }))} widthClass="w-[180px]"/></div></FilterBar>
    {query.isPending ? <div className="sf-empty" role="status">Đang tải các khoản phát sinh…</div> : query.isError ? <div className="sf-feedback error" role="alert"><span>{query.error.message} <button className="underline" onClick={() => query.refetch()}>Thử lại</button></span></div> : <TableContainer minWidth="1050px" maxHeight="548px">
      <TableHead><TableHeadRow className="h-12"><TableHeadCell width="9%">Ngày</TableHeadCell><TableHeadCell width="13%">Ca làm việc</TableHeadCell><TableHeadCell width="12%">Thưởng / Phạt</TableHeadCell><TableHeadCell width="8%">Thời gian</TableHeadCell><TableHeadCell width="11%">Số tiền</TableHeadCell><TableHeadCell width="34%">Lý do</TableHeadCell><TableHeadCell width="13%" isLast>Trạng thái</TableHeadCell></TableHeadRow></TableHead>
      <TableBody>{visible.length ? visible.map(item => {
        const shift = workShifts.find(s => s.employee_id === item.employee_id && s.date === item.date);
        const shiftLabels: Record<WorkShift['shift_type'], string> = { MORNING: 'Ca sáng', AFTERNOON: 'Ca chiều', OFFICE_HOURS: 'Ca hành chính', OTHER: 'Ca khác', OFF: 'Nghỉ ca' };
        return <TableRow key={item.id} className="h-[100px]">
        <TableCell>{item.date.split('-').reverse().join('/')}</TableCell>
        <TableCell>{shift ? <>{shiftLabels[shift.shift_type]}{shift.shift_type !== 'OFF' && shift.start_time && shift.end_time && <div className="sf-secondary">{shift.start_time} – {shift.end_time}</div>}</> : 'Không có dữ liệu ca'}</TableCell>
        <TableCell>{adjustmentLabels[item.kind]}</TableCell>
        <TableCell>{item.hours} giờ</TableCell>
        <TableCell className={`sf-money font-semibold ${item.kind === 'OVERTIME' ? 'text-emerald-700' : 'text-rose-700'}`}>{money(item.amount)}</TableCell>
        <TableCell><span className="line-clamp-2" title={item.note || undefined}>{item.note || 'Chưa có lý do'}</span></TableCell>
        <TableCell isLast><span className={`sf-badge ${item.status === 'PENDING' ? 'warning' : 'success'}`}><Clock size={13}/>{item.status === 'PENDING' ? 'Chưa duyệt' : statuses.APPROVED}</span>{item.status === 'APPROVED' && item.reviewed_at && <div className="sf-secondary">{new Date(item.reviewed_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</div>}</TableCell>
      </TableRow>}) : <TableEmpty colSpan={7} message={items.length ? 'Không có khoản phù hợp' : 'Chưa có khoản phát sinh trong kỳ'} />}</TableBody>
    </TableContainer>}
  </section>;
}
