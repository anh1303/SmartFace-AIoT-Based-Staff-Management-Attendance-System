import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams, useLocation } from 'react-router-dom';
import { Check, X, Clock, FileSearch, Lock, RotateCcw, ArrowUpRight, Info } from 'lucide-react';
import { apiFetch } from '../../../api/client';
import { useToast } from '../../../context/ToastContext';
import { Modal } from '../../../components/common/Modal';
export interface AttendanceAdjustment {
    id: string;
    employee_id: string;
    employee_name: string;
    date: string;
    kind: 'OVERTIME' | 'LATE_EARLY' | 'ABSENCE';
    hours: number;
    amount: number;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'VOID';
    note: string | null;
    reviewed_by: string | null;
    reviewed_at: string | null;
    updated_at: string;
    can_review: boolean;
    locked?: boolean;
}
export const adjustmentLabels = { OVERTIME: 'Tăng ca', LATE_EARLY: 'Phạt trễ / sớm', ABSENCE: 'Phạt vắng ca' };
const statuses = { PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Không duyệt', VOID: 'Không còn phát sinh' };
const money = (n: number) => `${Number(n).toLocaleString('vi-VN')} ₫`;
export function filterAdjustments(items: AttendanceAdjustment[], status: string, kind: string, search: string) { const q = search.trim().toLocaleLowerCase('vi-VN'); return items.filter(i => (status === 'ALL' || i.status === status) && (kind === 'ALL' || i.kind === kind) && (!q || `${i.employee_name} ${i.employee_id} ${i.date}`.toLocaleLowerCase('vi-VN').includes(q))); }
export function canReviewAdjustment(item: AttendanceAdjustment) { return item.can_review && !item.locked && item.status !== 'VOID'; }
export function AdjustmentReviewPanel({ period, employeeId }: {
    period: string;
    employeeId?: string;
}) {
    const location = useLocation();
    const client = useQueryClient();
    const { showToast } = useToast();
    const [params, setParams] = useSearchParams();
    const status = params.get('reviewStatus') || 'PENDING', kind = params.get('reviewKind') || 'ALL', search = params.get('reviewSearch') || '';
    const setFilter = (name: string, value: string) => setParams(previous => { const next = new URLSearchParams(previous); if (value)
        next.set(name, value);
    else
        next.delete(name); return next; }, { replace: true });
    const [selected, setSelected] = useState<AttendanceAdjustment | null>(null);
    const [note, setNote] = useState('');
    const [decision, setDecision] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
    const [dirty, setDirty] = useState(false);
    const query = useQuery({ queryKey: ['attendanceAdjustments', period, employeeId || 'ALL'], queryFn: async (): Promise<AttendanceAdjustment[]> => { const p = new URLSearchParams({ period }); if (employeeId)
            p.set('employeeId', employeeId); const res = await apiFetch(`/api/payroll/adjustments?${p}`); if (!res.success)
            throw new Error(res.message || 'Không tải được OT và các khoản phạt'); return res.data; } });
    const review = useMutation({ mutationFn: async () => { if (!selected || !canReviewAdjustment(selected))
            throw new Error('Khoản này không còn được phép xét duyệt. Vui lòng tải lại.'); const res = await apiFetch(`/api/payroll/adjustments/${encodeURIComponent(selected.id)}`, { method: 'PATCH', body: JSON.stringify({ status: decision, note, updated_at: selected.updated_at }) }); if (!res.success)
            throw new Error(res.message || 'Không lưu được quyết định'); }, onSuccess: () => { showToast('Đã lưu quyết định xét duyệt.', 'success'); setSelected(null); setDirty(true); for (const key of ['attendanceAdjustments', 'attendanceSummaries', 'payroll'])
            client.invalidateQueries({ queryKey: [key] }); }, onError: () => { client.invalidateQueries({ queryKey: ['attendanceAdjustments'] }); } });
    const items = query.data || [];
    const active = items.filter(i => i.status !== 'VOID');
    const pending = active.filter(i => i.status === 'PENDING');
    const visible = filterAdjustments(items, status, kind, search).sort((a, b) => b.date.localeCompare(a.date) || a.employee_name.localeCompare(b.employee_name));
    const open = (item: AttendanceAdjustment) => { review.reset(); setSelected(item); setNote(item.note || ''); setDecision('APPROVED'); };
    return <section className="space-y-4" aria-label="Xét duyệt OT và khoản phạt"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-lg font-semibold">Xét duyệt OT & khoản phạt</h2><p className="sf-secondary">Kỳ {period} · Xem căn cứ và quyết định riêng từng khoản theo ngày.</p></div><button className="sf-button" onClick={() => query.refetch()} disabled={query.isFetching}><RotateCcw size={16}/>Tải lại</button></div>
 <div className="sf-summary"><span><strong>{pending.length}</strong> khoản chờ duyệt</span><span>OT chờ: <strong>{pending.filter(i => i.kind === 'OVERTIME').reduce((n, i) => n + i.hours, 0)} giờ</strong></span><span>Phạt chờ: <strong>{money(pending.filter(i => i.kind !== 'OVERTIME').reduce((n, i) => n + i.amount, 0))}</strong></span><span>Đã duyệt: <strong>{active.filter(i => i.status === 'APPROVED').length} khoản</strong></span></div>
 {dirty && <div className="sf-feedback warning" role="status"><Info size={18}/><span>Quyết định đã lưu. Dùng <strong>Tính lương</strong> để cập nhật phiếu lương sau khi hoàn tất xét duyệt.</span></div>}
 <div className="sf-toolbar"><label className="sf-field sf-search">Tìm khoản phát sinh<input className="sf-input" value={search} onChange={e => setFilter('reviewSearch', e.target.value)} placeholder="Tên nhân viên, mã hoặc ngày…"/></label><label className="sf-field">Loại khoản<select className="sf-input" value={kind} onChange={e => setFilter('reviewKind', e.target.value)}><option value="ALL">Tất cả loại khoản</option>{Object.entries(adjustmentLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="sf-field">Trạng thái<select className="sf-input" value={status} onChange={e => setFilter('reviewStatus', e.target.value)}><option value="ALL">Tất cả trạng thái</option>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
 {query.isPending ? <div className="sf-empty" role="status">Đang tải các khoản phát sinh…</div> : query.isError ? <div className="sf-feedback error" role="alert"><span>{query.error.message} <button className="underline" onClick={() => query.refetch()}>Thử lại</button></span></div> : <div className="sf-panel"><table className="sf-table sf-responsive"><thead><tr><th>Nhân viên / ngày</th><th>Khoản phát sinh</th><th>Khối lượng / số tiền</th><th>Trạng thái</th><th>Xem xét</th></tr></thead><tbody>{visible.map(item => <tr key={item.id}><td><strong>{item.employee_name}</strong><div className="sf-secondary">{item.employee_id} · {item.date}</div></td><td data-label="Loại khoản">{adjustmentLabels[item.kind]}<div className="sf-secondary line-clamp-2">{item.note || 'Chưa có ghi chú'}</div></td><td data-label="Khối lượng"><span>{item.kind === 'ABSENCE' ? `1 ca (${item.hours} giờ)` : `${item.hours} giờ`}</span><div className={`sf-money font-semibold mt-1 ${item.kind === 'OVERTIME' ? 'text-emerald-700' : 'text-rose-700'}`}>{money(item.amount)}</div></td><td data-label="Trạng thái"><span className={`sf-badge ${item.status === 'PENDING' ? 'warning' : item.status === 'APPROVED' ? 'success' : ''}`}><Clock size={13}/>{statuses[item.status]}</span>{item.locked && <div className="sf-secondary flex items-center gap-1"><Lock size={12}/>Ngày công / kỳ lương đã khóa</div>}{item.reviewed_at && <div className="sf-secondary">{new Date(item.reviewed_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</div>}</td><td><button className="sf-button" onClick={() => open(item)}><FileSearch size={15}/>{canReviewAdjustment(item) ? 'Xem & xét duyệt' : 'Xem chi tiết'}</button></td></tr>)}</tbody></table>{!visible.length && <div className="sf-empty"><Check size={28}/><p className="font-semibold">{!items.length ? 'Chưa có khoản phát sinh trong kỳ' : 'Không có khoản phù hợp'}</p><p className="sf-secondary">{!items.length ? 'Dùng Tính lương để cập nhật các ngày công.' : 'Thử thay đổi loại khoản, trạng thái hoặc từ khóa.'}</p>{items.length > 0 && <button className="sf-button mt-4" onClick={() => setFilter('reviewStatus', 'ALL')}>Xem mọi trạng thái</button>}</div>}</div>}
 <p className="sf-secondary">Chỉ các khoản đã duyệt được tính vào lương. Phạt vắng theo chính sách hiện có; nghỉ có phép chọn “Không duyệt” và ghi chú.</p>
 <Modal isOpen={!!selected} onClose={() => { if (!review.isPending)
        setSelected(null); }} title={selected ? adjustmentLabels[selected.kind] : 'Chi tiết khoản phát sinh'} subtitle={selected ? `${selected.employee_name} · ${selected.employee_id} · ${selected.date}` : undefined} maxWidth="2xl">{selected && <form onSubmit={e => { e.preventDefault(); review.mutate(); }}><div className="sf-review-grid"><div className="sf-review-context"><h3 className="font-semibold mb-4">Căn cứ khoản phát sinh</h3><dl className="space-y-3"><div className="flex justify-between gap-3"><dt>Ngày làm việc</dt><dd>{selected.date}</dd></div><div className="flex justify-between gap-3"><dt>Khối lượng</dt><dd>{selected.hours} giờ</dd></div><div className="flex justify-between gap-3"><dt>Số tiền đề xuất</dt><dd className="sf-money font-semibold">{money(selected.amount)}</dd></div><div className="flex justify-between gap-3"><dt>Trạng thái</dt><dd>{statuses[selected.status]}</dd></div></dl><Link className="sf-button mt-5 w-full" to={location.pathname.startsWith('/app/employee') ? `/app/employee/attendance?date=${selected.date}` : `/app/manager/employees/${encodeURIComponent(selected.employee_id)}?tab=attendance&date=${selected.date}`}><ArrowUpRight size={16}/>Đối chiếu chấm công</Link><p className="sf-secondary mt-3">Mở nhật ký quét, cặp vào/ra và kết quả tính công của đúng ngày.</p></div><div className="space-y-4"><h3 className="font-semibold">Quyết định xét duyệt</h3>{canReviewAdjustment(selected) ? <><fieldset disabled={review.isPending} className="space-y-3"><legend className="sr-only">Chọn quyết định</legend><label className="sf-button w-full justify-start"><input type="radio" name="decision" checked={decision === 'APPROVED'} onChange={() => setDecision('APPROVED')}/><Check size={16}/>Duyệt khoản này</label><label className="sf-button w-full justify-start"><input type="radio" name="decision" checked={decision === 'REJECTED'} onChange={() => setDecision('REJECTED')}/><X size={16}/>Không duyệt</label></fieldset><label className="sf-field">Ghi chú xét duyệt<textarea className="sf-input" rows={4} maxLength={2000} value={note} disabled={review.isPending} onChange={e => setNote(e.target.value)} placeholder="Nêu căn cứ hoặc lý do (ví dụ: nghỉ có phép)…"/></label></> : <div className="sf-feedback"><Lock size={18}/><span>{selected.locked ? 'Ngày công hoặc kỳ lương đã khóa.' : selected.status === 'VOID' ? 'Khoản này không còn phát sinh.' : 'Bạn không có quyền xét duyệt khoản này.'}<p className="mt-2">{selected.note || 'Không có ghi chú.'}</p></span></div>}{selected.reviewed_by && <p className="sf-secondary">Người xét duyệt: {selected.reviewed_by}</p>}</div></div>{review.isError && <div className="sf-feedback error mt-4" role="alert">{review.error.message} Ghi chú của bạn vẫn được giữ; đóng và mở lại khoản để lấy dữ liệu mới trước khi thử lại.</div>}<div className="sf-footer"><button type="button" className="sf-button" disabled={review.isPending} onClick={() => setSelected(null)}>Đóng</button>{canReviewAdjustment(selected) && <button type="submit" className="sf-button primary" disabled={review.isPending}>{review.isPending ? 'Đang lưu quyết định…' : decision === 'APPROVED' ? 'Xác nhận duyệt' : 'Xác nhận không duyệt'}</button>}</div></form>}</Modal>
 </section>;
}
