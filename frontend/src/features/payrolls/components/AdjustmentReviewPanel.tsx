import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../api/client';
import { useToast } from '../../../context/ToastContext';

export interface AttendanceAdjustment {
  id: string; employee_id: string; employee_name: string; date: string;
  kind: 'OVERTIME' | 'LATE_EARLY' | 'ABSENCE'; hours: number; amount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'VOID'; note: string | null;
  reviewed_by: string | null; reviewed_at: string | null; updated_at: string; can_review: boolean; locked?: boolean;
}
const labels = { OVERTIME: 'Tăng ca', LATE_EARLY: 'Phạt trễ / sớm', ABSENCE: 'Phạt vắng ca' };
const statuses = { PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Không duyệt', VOID: 'Không còn phát sinh' };
const money = (value: number) => `${value.toLocaleString('vi-VN')} ₫`;

export function AdjustmentReviewPanel({ period, employeeId }: { period: string; employeeId?: string }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const query = useQuery({
    queryKey: ['attendanceAdjustments', period, employeeId || 'ALL'],
    queryFn: async (): Promise<AttendanceAdjustment[]> => {
      const params = new URLSearchParams({ period });
      if (employeeId) params.set('employeeId', employeeId);
      const res = await apiFetch(`/api/payroll/adjustments?${params}`);
      if (!res.success) throw new Error(res.message || 'Không tải được các khoản OT/phạt');
      return res.data;
    },
  });
  const review = useMutation({
    mutationFn: async ({ item, status }: { item: AttendanceAdjustment; status: 'APPROVED' | 'REJECTED' }) => {
      const res = await apiFetch(`/api/payroll/adjustments/${item.id}`, { method: 'PATCH', body: JSON.stringify({ status, note: notes[item.id] ?? item.note ?? '', updated_at: item.updated_at }) });
      if (!res.success) throw new Error(res.message || 'Không lưu được quyết định');
    },
    onSuccess: () => {
      showToast('Đã lưu quyết định. Tính lại lương sau khi hoàn tất duyệt.', 'success');
      for (const key of ['attendanceAdjustments', 'attendanceSummaries', 'payroll']) queryClient.invalidateQueries({ queryKey: [key] });
    },
    onError: (err: Error) => {
      showToast(err.message, 'error');
      queryClient.invalidateQueries({ queryKey: ['attendanceAdjustments'] });
    },
  });
  const groups = new Map<string, AttendanceAdjustment[]>();
  for (const item of query.data || []) groups.set(item.employee_id, [...(groups.get(item.employee_id) || []), item]);
  const activeItems = (query.data || []).filter(i => i.status !== 'VOID');
  const overtimeItems = activeItems.filter(i => i.kind === 'OVERTIME');
  const penaltyItems = activeItems.filter(i => i.kind !== 'OVERTIME');
  return <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#13162b] p-4 space-y-4 text-slate-800 dark:text-slate-100">
    <div>
      <h2 className="font-bold">Duyệt OT và các khoản phạt · {period}</h2>
      <p className="text-xs text-slate-500 mt-1">Mở từng nhân viên để duyệt từng khoản theo ngày. Chỉ khoản đã duyệt được tính vào lương. Phạt vắng theo tỷ lệ cấu hình (mặc định 25% tiền công ca); nghỉ có phép chọn Không duyệt và ghi chú.</p>
    </div>
    {query.isSuccess && <div className="grid sm:grid-cols-3 gap-3 text-sm">
      <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3">OT đề xuất: <strong>{overtimeItems.reduce((n,i) => n+i.hours,0)}h</strong><div className="text-xs text-emerald-600">Đã duyệt {overtimeItems.filter(i => i.status === 'APPROVED').reduce((n,i) => n+i.hours,0)}h</div></div>
      <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3">Phạt đề xuất: <strong>{money(penaltyItems.reduce((n,i) => n+i.amount,0))}</strong><div className="text-xs text-rose-600">Đã duyệt {money(penaltyItems.filter(i => i.status === 'APPROVED').reduce((n,i) => n+i.amount,0))}</div></div>
      <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3">Chờ duyệt: <strong>{activeItems.filter(i => i.status === 'PENDING').length} khoản</strong></div>
    </div>}
    {query.isPending && <p role="status">Đang tải các khoản…</p>}
    {query.isError && <div role="alert">{query.error.message} <button type="button" onClick={() => query.refetch()}>Thử lại</button></div>}
    {query.isSuccess && !groups.size && <p className="text-sm text-slate-500">Chưa có khoản OT/phạt trong kỳ. Dùng Tính lương để cập nhật các ngày công.</p>}
    {[...groups].map(([id, items]) => {
      const active = items.filter(i => i.status !== 'VOID');
      const approved = active.filter(i => i.status === 'APPROVED');
      const pending = active.filter(i => i.status === 'PENDING');
      return <div key={id} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
        <button type="button" aria-expanded={!!expanded[id]} onClick={() => setExpanded(p => ({ ...p, [id]: !p[id] }))} className="w-full p-3 text-left flex flex-wrap justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800">
          <span className="font-semibold">{items[0].employee_name} <span className="text-xs text-slate-500">{id}</span></span>
          <span className="text-xs">{pending.length} khoản chờ · OT: {active.filter(i => i.kind === 'OVERTIME').reduce((n,i) => n+i.hours,0)}h (duyệt {approved.filter(i => i.kind === 'OVERTIME').reduce((n,i) => n+i.hours,0)}h) · Phạt duyệt: {money(approved.filter(i => i.kind !== 'OVERTIME').reduce((n,i) => n+i.amount,0))} · Chờ: {money(pending.reduce((n,i) => n+i.amount,0))} {expanded[id] ? '▴' : '▾'}</span>
        </button>
        {expanded[id] && <div className="overflow-x-auto"><table className="w-full text-sm text-left min-w-[700px]">
          <thead className="bg-slate-50 dark:bg-slate-800"><tr>{['Ngày / khoản', 'Khối lượng', 'Số tiền', 'Trạng thái', 'Ghi chú / quyết định'].map(h => <th key={h} className="p-3">{h}</th>)}</tr></thead>
          <tbody>{items.map(item => <tr key={item.id} className="border-t border-slate-100 dark:border-slate-700">
            <td className="p-3">{item.date}<div className="font-semibold">{labels[item.kind]}</div></td>
            <td className="p-3">{item.kind === 'ABSENCE' ? `1 ca (${item.hours}h)` : `${item.hours}h`}</td>
            <td className="p-3 font-mono">{money(item.amount)}</td>
            <td className="p-3"><span className={item.status === 'PENDING' ? 'text-amber-600' : item.status === 'APPROVED' ? 'text-emerald-600' : 'text-slate-500'}>{statuses[item.status]}</span>
              {item.reviewed_at && <div className="text-xs text-slate-500">{new Date(item.reviewed_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</div>}</td>
            <td className="p-3">{item.can_review && item.status !== 'VOID' ? <div className="space-y-2">
              <textarea aria-label={`Ghi chú ${labels[item.kind]} ngày ${item.date}`} maxLength={2000} rows={2} value={notes[item.id] ?? item.note ?? ''} onChange={e => setNotes(p => ({ ...p, [item.id]: e.target.value }))} className="w-full min-w-48 rounded border border-slate-300 dark:border-slate-600 bg-transparent p-2" placeholder="Ghi chú (ví dụ: nghỉ có phép)" />
              <div className="flex gap-2">
                <button type="button" disabled={review.isPending} onClick={() => review.mutate({ item, status: 'APPROVED' })} className="rounded bg-emerald-700 text-white px-3 py-1 disabled:opacity-50">Duyệt khoản này</button>
                <button type="button" disabled={review.isPending} onClick={() => review.mutate({ item, status: 'REJECTED' })} className="rounded border border-slate-300 dark:border-slate-600 px-3 py-1 disabled:opacity-50">Không duyệt</button>
              </div></div> : <span>{item.note || '—'}{item.locked && <span className="block text-xs text-slate-500">Ngày công / kỳ lương đã khóa</span>}</span>}</td>
          </tr>)}</tbody>
        </table></div>}
      </div>;
    })}
  </section>;
}
