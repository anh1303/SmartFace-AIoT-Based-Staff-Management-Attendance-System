import { ActionButton } from '@/components/common/ActionFeedback';
import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Fingerprint, Trash2 } from 'lucide-react';
import type { FingerprintDevice } from '../hooks/useFingerprintEnrollment';
import { useAuth } from '../../../context/AuthContext';
import { apiFetch } from '../../../api/client';

export type FingerprintStep = 'IDLE' | 'SENDING' | 'QUEUED' | 'WAITING_TOUCH_1' | 'LIFT_FINGER' | 'WAITING_TOUCH_2' | 'VERIFIED' | 'SYNCING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';
const labels: Record<FingerprintStep,string> = {
  IDLE: 'Chọn Pi và bắt đầu lấy mẫu', SENDING: 'Đang gửi yêu cầu…', QUEUED: 'Đang chờ Pi sẵn sàng',
  WAITING_TOUCH_1: 'Đặt ngón tay lên kính — lần 1', LIFT_FINGER: 'Nhấc hẳn ngón tay khỏi kính',
  WAITING_TOUCH_2: 'Đặt lại cùng ngón tay — lần 2', VERIFIED: 'Hai mẫu khớp; chờ xác nhận lưu',
  SYNCING: 'Đang đồng bộ xuống Pi; mẫu cũ vẫn có hiệu lực', COMPLETED: 'Đã lưu và đồng bộ thành công',
  FAILED: 'Lấy mẫu thất bại — kiểm tra thiết bị và thử lại', CANCELLED: 'Phiên đã hủy', EXPIRED: 'Phiên đã hết hạn',
};
interface Props {
  selectedDevice: string; onSelectDevice: (value: string) => void;
  selectedFinger?: string; onSelectFinger?: (value: string) => void;
  fingerprintStep: FingerprintStep; fingerQualityScore: number | null;
  devices: FingerprintDevice[]; error?: string | null; disabled?: boolean;
  hasEnrolledFingerprint?: boolean;
  onDeleteFingerprint?: () => void;
  onSendIoTTrigger: () => void; onOpenConfirmModal: () => void; onCancel: () => void;
}
export const FingerprintEnrollmentSection: React.FC<Props> = props => {
  const { role, currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [acceptanceDevice, setAcceptanceDevice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [configMessage, setConfigMessage] = useState('');
  const busy = !['IDLE','COMPLETED','FAILED','CANCELLED','EXPIRED'].includes(props.fingerprintStep);
  const device = props.devices.find(d => d.device_id === props.selectedDevice);
  // Match the enrollment API heartbeat window.
  const online = Boolean(device && Date.now() - +new Date(device.last_seen) <= 90_000 && device.ready);
  const available = online && (device?.wak_verified || device?.polling_fallback);
  const enrolling = busy || device?.enrollment_active === true;
  const canAttend = available && device?.roundtrip_verified;
  const mode = enrolling ? 'Đang lấy mẫu hoặc đồng bộ'
    : !device ? 'Chưa chọn Pi'
    : !available ? 'Cảm biến chưa sẵn sàng'
    : !device.attendance_enabled ? 'Chế độ lấy mẫu'
    : canAttend ? 'Sẵn sàng chấm công' : 'Chấm công chưa sẵn sàng';
  const canSwitch = Boolean(device && !enrolling && !saving && !props.disabled &&
    (device.attendance_enabled || canAttend));

  async function configure(data: Record<string, boolean>) {
    if (!device || saving) return;
    setSaving(true);
    setConfigMessage('');
    const key = ['fingerprint-devices', currentUser?.username];
    try {
      const { data: updated } = await apiFetch<FingerprintDevice>(
        `/api/biometrics/fingerprint-devices/${encodeURIComponent(device.device_id)}`,
        { method: 'PATCH', body: JSON.stringify(data) },
      );
      if (updated) {
        queryClient.setQueryData<FingerprintDevice[]>(key, old =>
          old?.map(item => item.device_id === updated.device_id ? { ...item, ...updated } : item));
      }
      setAcceptanceDevice(null);
      setConfigMessage('Đã lưu chế độ trên hệ thống. Pi nhận thay đổi ở lần đồng bộ tiếp theo.');
      void queryClient.invalidateQueries({ queryKey: key });
    } catch (error) {
      setConfigMessage(error instanceof Error ? error.message : 'Chưa cập nhật được cấu hình vân tay.');
    } finally {
      setSaving(false);
    }
  }
  return <div className="space-y-5">
    <div className="grid md:grid-cols-2 gap-5">
      <div className="space-y-4">
        <label className="block text-sm">Pi ghi nhận
          <select className="block w-full mt-2 rounded-lg border p-2 bg-white dark:bg-slate-900" disabled={busy || saving || props.disabled}
            value={props.selectedDevice} onChange={e => { setAcceptanceDevice(null); setConfigMessage(''); props.onSelectDevice(e.target.value); }}>
            <option value="">Chọn Pi đã kết nối cảm biến</option>
            {props.devices.map(d => <option key={d.device_id} value={d.device_id}>{d.device_id} — {d.capacity} mẫu {d.ready ? '' : '(chưa sẵn sàng)'}</option>)}
          </select>
        </label>
        <section aria-label="Chế độ cảm biến vân tay" className="rounded-xl border border-slate-300/60 dark:border-slate-700 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div aria-live="polite">
              <p className="text-xs text-slate-500 dark:text-slate-400">Chế độ cảm biến</p>
              <p className={`font-semibold ${canAttend && device?.attendance_enabled && !enrolling ? 'text-emerald-700 dark:text-emerald-400' : ''}`}>{mode}</p>
            </div>
            {role === 'admin' && device && (
              <button type="button" className="rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-40" disabled={!canSwitch}
                onClick={() => device.attendance_enabled
                  ? void configure({ attendance_enabled: false })
                  : setAcceptanceDevice(device.device_id)}>
                {saving ? 'Đang lưu…' : device.attendance_enabled ? 'Chuyển sang lấy mẫu' : 'Chuyển sang chấm công'}
              </button>
            )}
          </div>
          {available && !enrolling && device && !device.attendance_enabled && (
            <p className="text-xs text-slate-500 dark:text-slate-400">Có thể đăng ký mẫu. Chấm công vân tay đang tắt.</p>
          )}
          {enrolling && <p className="text-xs text-slate-500 dark:text-slate-400">Chấm công tạm dừng đến khi phiên kết thúc.</p>}
          {role === 'admin' && device && acceptanceDevice === device.device_id && (
            <div className="space-y-2 border-t border-slate-300/60 dark:border-slate-700 pt-3 text-sm">
              <p>Xác nhận thiết bị đã đạt nghiệm thu trước khi bật chấm công thật. Cần 18/20 lượt ngón đúng trong 5 giây, từ chối 20/20 ngón khác, đủ 20 chu kỳ WAK và không timeout UART.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="rounded-lg bg-emerald-700 text-white px-3 py-2 disabled:opacity-40" disabled={!canSwitch}
                  onClick={() => void configure({ attendance_enabled: true, acceptance_verified: true })}>Xác nhận nghiệm thu và bật</button>
                <button type="button" className="rounded-lg border px-3 py-2" disabled={saving} onClick={() => setAcceptanceDevice(null)}>Hủy</button>
              </div>
            </div>
          )}
          {configMessage && <p role="status" className="text-sm">{configMessage}</p>}
        </section>
        <p className="text-sm text-slate-500">Đăng ký hai lần cùng một ngón tay bất kỳ, nhấc tay giữa hai lần. Pi tạm dừng chấm công trong lúc đăng ký. Mẫu chỉ dùng tại Pi được chọn.</p>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <ActionButton busyLabel="Đang gửi yêu cầu…" className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-40 transition-colors" disabled={props.disabled || enrolling || saving || !available}
            onClick={props.onSendIoTTrigger}>
            {props.hasEnrolledFingerprint ? 'Đăng ký lại vân tay mới' : 'Bắt đầu lấy mẫu thật'}
          </ActionButton>
          {props.hasEnrolledFingerprint && props.onDeleteFingerprint && (
            <ActionButton busyLabel="Đang thu hồi…"
              type="button"
              className="rounded-lg border border-red-500/40 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 px-3.5 py-2 text-sm font-medium disabled:opacity-40 flex items-center gap-1.5 transition-colors cursor-pointer"
              disabled={props.disabled || busy}
              onClick={props.onDeleteFingerprint}
            >
              <Trash2 className="w-4 h-4" />
              <span>Xóa vân tay</span>
            </ActionButton>
          )}
        </div>
      </div>
      <div className="rounded-xl border p-5 space-y-3" aria-live="polite">
        <p className="text-sm">{online ? 'Pi đang kết nối' : 'Pi chưa sẵn sàng hoặc mất kết nối'}</p>
        <Fingerprint className={`h-12 w-12 ${online ? 'text-emerald-600' : 'text-slate-400'}`} />
        <p className="font-semibold">{labels[props.fingerprintStep]}</p>
        {props.fingerQualityScore !== null && <p>Điểm so khớp hai mẫu: <strong>{props.fingerQualityScore}</strong></p>}
        {device && !device.wak_verified && !device.polling_fallback && <p className="text-sm">Cần kiểm tra WAK/Vt: chạm rồi nhấc tay để Pi xác nhận tín hiệu.</p>}
        {props.error && props.fingerprintStep === 'FAILED' && <p role="alert" className="text-red-600 text-sm">{props.error}</p>}
        {busy && <ActionButton busyLabel="Đang hủy…" className="underline text-sm" onClick={props.onCancel} disabled={props.disabled || props.fingerprintStep === 'SENDING'}>Hủy phiên</ActionButton>}
      </div>
    </div>
    <button className="rounded-lg bg-emerald-600 text-white px-4 py-2 disabled:opacity-40" onClick={props.onOpenConfirmModal}
      disabled={props.disabled || props.fingerprintStep !== 'VERIFIED'}>Xác nhận lưu mẫu</button>
    {role === 'admin' && device && <details className="border rounded-lg p-3 text-sm space-y-3">
      <summary>Cấu hình vận hành vân tay</summary>
      <ActionButton busyLabel="Đang lưu…" type="button" className="border rounded p-2 disabled:opacity-40" disabled={saving || enrolling || props.disabled}
        onClick={() => configure({ polling_fallback: !device.polling_fallback })}>
        {device.polling_fallback ? 'Tắt đọc định kỳ dự phòng' : 'Bật đọc định kỳ khi WAK lỗi'}</ActionButton>
    </details>}
  </div>;
};
