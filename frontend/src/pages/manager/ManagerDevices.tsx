import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Server, Wifi, WifiOff, Wrench, Info, ArrowLeft, CheckCircle, Clock, RotateCcw, Trash2, Pencil } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../../components/common/Modal';
import { PageHeaderBanner } from '../../components/common/PageHeaderBanner';
import { deviceApi, validDeviceIp, type Device, type DeviceInput, type DeviceStatus, type AttendanceMode } from '../../features/devices/deviceApi';
import { confirmsRequestedMode } from '../../features/devices/deviceModeState';
import { useDeviceRealtime } from '../../features/devices/useDeviceRealtime';
const labels = { ONLINE: 'Trực tuyến', OFFLINE: 'Ngoại tuyến', MAINTENANCE: 'Bảo trì' };
const time = (value: string | null) => value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Chưa ghi nhận';
function Status({ status }: {
    status: DeviceStatus;
}) { const Icon = status === 'ONLINE' ? Wifi : status === 'MAINTENANCE' ? Wrench : WifiOff; return <span className={`sf-badge ${status === 'ONLINE' ? 'success' : status === 'MAINTENANCE' ? 'warning' : ''}`}><Icon size={14}/>{labels[status]}</span>; }
export const ManagerDevices: React.FC = () => {
    const { role } = useAuth();
    return role === 'admin' ? <DeviceManagement/> : <p className="sf-feedback warning">Chỉ Admin được quản lý và điều khiển thiết bị dùng chung.</p>;
};

const DeviceManagement: React.FC = () => {
    const { id } = useParams();
    const [params, setParams] = useSearchParams();
    const navigate = useNavigate();
    const { role } = useAuth();
    const { showToast } = useToast();
    const client = useQueryClient();
    useDeviceRealtime();
    const list = useQuery({ queryKey: ['devices'], queryFn: deviceApi.list, refetchInterval: 30000 });
    const detail = useQuery({ queryKey: ['device', id], queryFn: () => deviceApi.get(id!), enabled: !!id, retry: 1 });
    const mode = useQuery({ queryKey: ['deviceMode', id], queryFn: () => deviceApi.mode(id!), enabled: !!id, refetchInterval: 5000 });
    const [form, setForm] = useState<{
        device?: Device;
    } | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [requested, setRequested] = useState<{
        mode: AttendanceMode;
        time: number;
    } | null>(null);
    const refresh = () => { for (const key of ['devices', 'device', 'deviceMode'])
        client.invalidateQueries({ queryKey: [key] }); };
    const save = useMutation({ mutationFn: ({ input, device }: {
            input: DeviceInput;
            device?: Device;
        }) => device ? deviceApi.update(device.id, input) : deviceApi.create(input), onSuccess: (device) => { setForm(null); refresh(); showToast('Đã lưu thông tin đăng ký thiết bị.', 'success'); navigate(`/app/manager/devices/${device.id}?${params}`); } });
    const remove = useMutation({ mutationFn: () => deviceApi.remove(id!), onSuccess: () => { setDeleting(false); refresh(); showToast('Đã xóa bản ghi thiết bị.', 'success'); navigate(`/app/manager/devices?${params}`); } });
    const command = useMutation({ mutationFn: (value: AttendanceMode) => deviceApi.setMode(id!, value), onSuccess: (data) => { client.setQueryData(['deviceMode', id], data); refresh(); } });
    useEffect(() => { setRequested(null); command.reset(); setForm(null); setDeleting(false); }, [id]);
    const setFilter = (key: string, value: string) => setParams(previous => { const p = new URLSearchParams(previous); value ? p.set(key, value) : p.delete(key); p.delete('page'); return p; }, { replace: true });
    const q = params.get('q') || '', status = params.get('status') || 'ALL';
    const all = list.data || [];
    const filtered = all.filter(d => (status === 'ALL' || d.status === status) && `${d.name} ${d.location}`.toLocaleLowerCase('vi-VN').includes(q.toLocaleLowerCase('vi-VN')));
    const pages = Math.max(1, Math.ceil(filtered.length / 10));
    const page = Math.min(pages, Math.max(1, Number(params.get('page')) || 1));
    const visible = filtered.slice((page - 1) * 10, page * 10);
    const device = detail.data;
    const ack = confirmsRequestedMode(mode.data, requested);
    const modeConfirmed = !!mode.data?.confirmed && (!requested || ack);
    const send = (value: AttendanceMode) => { command.reset(); setRequested({ mode: value, time: Date.now() }); command.mutate(value); };
    return <div className="space-y-6">{id ? <><Link className="inline-flex gap-2 text-blue-700 items-center text-sm" to={`/app/manager/devices?${params}`}><ArrowLeft size={16}/>Danh sách thiết bị</Link><PageHeaderBanner title={device?.name || 'Chi tiết thiết bị'} subtitle="Thông tin đăng ký, kết nối và chế độ chấm công" actions={device && <><button className="sf-button" onClick={() => { save.reset(); setForm({ device }); }}><Pencil size={16}/>Sửa thông tin</button>{role === 'admin' && <button className="sf-button danger" onClick={() => { remove.reset(); setDeleting(true); }}><Trash2 size={16}/>Xóa</button>}</>}/>{detail.isPending ? <div role="status" className="sf-empty">Đang tải thiết bị…</div> : detail.isError ? <div className="sf-feedback error" role="alert"><span>{detail.error.message}<p className="mt-2">Thiết bị xuất hiện từ ThingsBoard có thể chưa có bản ghi quản lý tương ứng trong hệ thống.</p><button className="sf-button mt-3" onClick={() => detail.refetch()}>Thử lại</button></span></div> : device && <div className="sf-detail-grid"><section className="sf-panel"><h2 className="p-5 border-b border-slate-200 font-semibold">Thông tin đăng ký</h2><dl className="sf-definition"><dt>Tên thiết bị</dt><dd>{device.name}</dd><dt>Vị trí</dt><dd>{device.location}</dd><dt>Địa chỉ IP</dt><dd>{device.ip || 'Chưa khai báo'}</dd><dt>Kết nối</dt><dd><Status status={device.status}/></dd><dt>Liên lạc cuối</dt><dd>{time(device.lastSeen)}</dd><dt>Ngày đăng ký</dt><dd>{time(device.createdAt)}</dd><dt>Mã thiết bị</dt><dd className="text-xs">{device.id}</dd></dl></section><section className="sf-panel p-5 space-y-4"><h2 className="font-semibold">Chế độ chấm công</h2>{mode.isPending ? <p role="status">Đang đọc chế độ…</p> : mode.isError ? <div className="sf-feedback error" role="alert">{mode.error.message}<button onClick={() => mode.refetch()} className="underline">Thử lại</button></div> : <><p className="text-sm">{modeConfirmed ? 'Thiết bị đã xác nhận:' : 'Chế độ chưa xác nhận:'} <strong>{mode.data?.mode ? (mode.data.mode === 'CHECK_IN' ? 'Vào ca (CHECK_IN)' : 'Ra ca (CHECK_OUT)') : 'Chưa xác định'}</strong></p><p className="sf-secondary">{modeConfirmed ? 'Đã nhận xác nhận từ thiết bị' : 'Chưa nhận xác nhận từ thiết bị'}{mode.data?.lastUpdated && ` · ${time(mode.data.lastUpdated)}`}</p></>}<div className="flex flex-wrap gap-2">{(['CHECK_IN', 'CHECK_OUT'] as const).map(value => <button key={value} className={`sf-button ${modeConfirmed && mode.data?.mode === value ? 'primary' : ''}`} disabled={command.isPending} onClick={() => send(value)}>{value === 'CHECK_IN' ? 'Chuyển sang Vào ca' : 'Chuyển sang Ra ca'}</button>)}</div>{command.isPending ? <div className="sf-feedback" role="status"><Clock size={18}/>Đang gửi lệnh tới thiết bị…</div> : command.isError ? <div className="sf-feedback error" role="alert">{command.error.message}</div> : requested && !ack ? <div className="sf-feedback warning" role="status"><Clock size={18}/><span>Đã gửi lệnh {requested.mode === 'CHECK_IN' ? 'Vào ca' : 'Ra ca'} · Chờ Pi xác nhận. <button className="underline" onClick={() => mode.refetch()}>Kiểm tra lại</button></span></div> : ack ? <div className="sf-feedback" role="status"><CheckCircle size={18}/>Thiết bị đã xác nhận chế độ.</div> : null}<p className="sf-secondary">Trực tuyến không đồng nghĩa lệnh đã thực thi. Kết quả xác nhận thể hiện trạng thái thiết bị báo về; backend chưa có mã lệnh để đối chiếu các yêu cầu đồng thời.</p></section></div>}</> : <><PageHeaderBanner title="Thiết bị" subtitle="Quản lý thông tin đăng ký và trạng thái kết nối" actions={<button className="sf-button primary" onClick={() => { save.reset(); setForm({}); }}><Plus size={18}/>Thêm thiết bị</button>}/><div className="sf-summary"><span><strong>{all.length}</strong> thiết bị</span>{(Object.keys(labels) as DeviceStatus[]).map(s => <span key={s}><strong>{all.filter(d => d.status === s).length}</strong> {labels[s].toLocaleLowerCase('vi-VN')}</span>)}</div><div className="sf-toolbar"><label className="sf-field sf-search">Tìm kiếm<input className="sf-input" placeholder="Tìm theo tên hoặc vị trí" value={q} onChange={e => setFilter('q', e.target.value)}/></label><label className="sf-field">Trạng thái<select className="sf-input" value={status} onChange={e => setFilter('status', e.target.value)}><option value="ALL">Tất cả trạng thái</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><button className="sf-button" disabled={list.isFetching} onClick={() => list.refetch()}><RotateCcw size={16}/>Tải lại</button></div>{list.isPending ? <div className="sf-empty" role="status">Đang tải danh sách thiết bị…</div> : list.isError ? <div className="sf-feedback error" role="alert">{list.error.message}<button className="underline" onClick={() => list.refetch()}>Thử lại</button></div> : <div className="sf-panel"><table className="sf-table sf-responsive"><thead><tr><th>Tên thiết bị</th><th>Vị trí</th><th>Địa chỉ IP</th><th>Trạng thái</th><th>Liên lạc cuối</th><th>Thao tác</th></tr></thead><tbody>{visible.map(d => <tr key={d.id}><td><span className="inline-flex gap-3 items-center font-semibold"><Server size={20} className="text-slate-500"/>{d.name}</span></td><td data-label="Vị trí">{d.location}</td><td data-label="IP">{d.ip || '—'}</td><td data-label="Trạng thái"><Status status={d.status}/></td><td data-label="Liên lạc cuối" className="text-xs">{time(d.lastSeen)}</td><td><Link className="sf-button" to={`/app/manager/devices/${d.id}?${params}`}>Xem chi tiết</Link></td></tr>)}</tbody></table>{!visible.length && <div className="sf-empty"><Server size={32}/><p className="font-semibold">{all.length ? 'Không tìm thấy thiết bị phù hợp' : 'Chưa có thiết bị đăng ký'}</p><p className="sf-secondary">{all.length ? 'Thử thay đổi từ khóa hoặc bộ lọc.' : 'Thêm thông tin thiết bị để bắt đầu quản lý.'}</p></div>}<div className="flex flex-wrap justify-between items-center gap-3 p-4 border-t border-slate-200"><span className="sf-secondary">{filtered.length ? `${(page - 1) * 10 + 1}–${Math.min(page * 10, filtered.length)}` : '0'} trong {filtered.length} thiết bị</span><div className="flex items-center gap-2"><button className="sf-button" disabled={page <= 1} onClick={() => setParams(p => { p.set('page', String(page - 1)); return p; })}>Trước</button><span className="text-xs">{page}/{pages}</span><button className="sf-button" disabled={page >= pages} onClick={() => setParams(p => { p.set('page', String(page + 1)); return p; })}>Sau</button></div></div></div>}</>}
 <div className="sf-feedback"><Info size={18}/><span>Đăng ký thiết bị chỉ lưu thông tin quản lý. Pi, ThingsBoard và luồng camera cần được cấu hình riêng.</span></div>
 {form && <DeviceForm device={form.device} busy={save.isPending} error={save.error?.message} onClose={() => { if (!save.isPending)
        setForm(null); }} onSave={input => save.mutate({ input, device: form.device })}/>}
 <Modal isOpen={deleting && role === 'admin'} onClose={() => { if (!remove.isPending)
        setDeleting(false); }} title="Xóa bản ghi thiết bị" subtitle={device?.name}><p>Thông tin đăng ký này sẽ bị xóa khỏi hệ thống. Thao tác không thay thế việc cấu hình hoặc ngắt kết nối Pi.</p>{remove.isError && <div role="alert" className="sf-feedback error mt-4">{remove.error.message}</div>}<div className="sf-footer"><button className="sf-button" disabled={remove.isPending} onClick={() => setDeleting(false)}>Hủy</button><button className="sf-button danger" disabled={remove.isPending} onClick={() => remove.mutate()}>{remove.isPending ? 'Đang xóa…' : 'Xác nhận xóa'}</button></div></Modal>
 </div>;
};
function DeviceForm({ device, busy, error, onClose, onSave }: {
    device?: Device;
    busy: boolean;
    error?: string;
    onClose: () => void;
    onSave: (input: DeviceInput) => void;
}) { const [name, setName] = useState(device?.name || ''); const [location, setLocation] = useState(device?.location || ''); const [ip, setIp] = useState(device?.ip || ''); const [maintenance, setMaintenance] = useState(device?.status === 'MAINTENANCE'); const [validation, setValidation] = useState(''); return <Modal isOpen onClose={onClose} title={device ? 'Sửa thông tin thiết bị' : 'Thêm thiết bị'} subtitle="Đăng ký thông tin quản lý; kết nối thiết bị được xác nhận riêng."><form className="space-y-4" onSubmit={e => { e.preventDefault(); if (name.trim().length < 2 || location.trim().length < 2) {
    setValidation('Tên và vị trí cần ít nhất 2 ký tự.');
    return;
} if (!validDeviceIp(ip.trim())) {
    setValidation('Địa chỉ IP chưa hợp lệ. Nhập IPv4 hoặc IPv6, hoặc để trống.');
    return;
} const input: DeviceInput = { name: name.trim(), location: location.trim(), ip: ip.trim() || null }; if (maintenance)
    input.status = 'MAINTENANCE';
else if (device?.status === 'MAINTENANCE')
    input.status = 'OFFLINE'; onSave(input); }}><label className="sf-field">Tên thiết bị<input className="sf-input" required minLength={2} value={name} disabled={busy} onChange={e => setName(e.target.value)} placeholder="Ví dụ: Pi Sảnh A"/></label><label className="sf-field">Vị trí lắp đặt<input className="sf-input" required minLength={2} value={location} disabled={busy} onChange={e => setLocation(e.target.value)} placeholder="Ví dụ: Sảnh tầng 1"/></label><label className="sf-field">Địa chỉ IP (không bắt buộc)<input className="sf-input" value={ip} disabled={busy} onChange={e => setIp(e.target.value)} placeholder="Để trống nếu chưa khai báo"/><small>Chỉ lưu thông tin; không tự cấu hình địa chỉ trên Pi.</small></label><label className="flex gap-2 items-center"><input type="checkbox" checked={maintenance} disabled={busy} onChange={e => setMaintenance(e.target.checked)}/>Đặt thiết bị ở trạng thái bảo trì</label><p className="sf-secondary">Thiết bị mới mặc định ngoại tuyến. Trạng thái trực tuyến do hệ thống ghi nhận, không được xác lập bằng form này.</p>{(validation || error) && <div className="sf-feedback error" role="alert">{error || validation}</div>}<div className="sf-footer"><button className="sf-button" type="button" disabled={busy} onClick={onClose}>Hủy</button><button className="sf-button primary" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu thông tin thiết bị'}</button></div></form></Modal>; }
