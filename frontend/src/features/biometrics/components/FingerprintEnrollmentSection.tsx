import React from 'react';
import { Fingerprint, Radio, Send, CheckCheck, Check } from 'lucide-react';

export type FingerprintStep = 'IDLE' | 'SENDING' | 'WAITING_TOUCH' | 'CAPTURED' | 'VERIFIED';

interface FingerprintEnrollmentSectionProps {
  selectedDevice: string;
  onSelectDevice: (device: string) => void;
  selectedFinger: string;
  onSelectFinger: (finger: string) => void;
  fingerprintStep: FingerprintStep;
  fingerQualityScore: number | null;
  disabled?: boolean;
  onSendIoTTrigger: () => void;
  onOpenConfirmModal: () => void;
}

export const FingerprintEnrollmentSection: React.FC<FingerprintEnrollmentSectionProps> = ({
  selectedDevice,
  onSelectDevice,
  selectedFinger,
  onSelectFinger,
  fingerprintStep,
  fingerQualityScore,
  disabled = false,
  onSendIoTTrigger,
  onOpenConfirmModal,
}) => {
  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Select Device & Finger */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Chọn thiết bị Edge IoT ghi nhận:
            </label>
            <select
              value={selectedDevice}
              onChange={(e) => onSelectDevice(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="FaceCam-01 (Máy chấm công Face_ID Vào ca)">
                FaceCam-01 (Máy chấm công Face_ID Vào ca)
              </option>
              <option value="FaceCam-02 (Máy chấm công Face_ID Tan ca)">
                FaceCam-02 (Máy chấm công Face_ID Tan ca)
              </option>
              <option value="Fingerprint-01 (Máy chấm công vân tay Vào ca)">
                Fingerprint-01 (Máy chấm công vân tay Vào ca)
              </option>
              <option value="Fingerprint-02 (Máy chấm công vân tay Tan ca)">
                Fingerprint-02 (Máy chấm công vân tay Tan ca)
              </option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Vị trí ngón tay lấy mẫu:
            </label>
            <select
              value={selectedFinger}
              onChange={(e) => onSelectFinger(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="Ngón trỏ phải (Right Index)">
                Ngón trỏ phải (Right Index) - Khuyên dùng
              </option>
              <option value="Ngón cái phải (Right Thumb)">
                Ngón cái phải (Right Thumb)
              </option>
              <option value="Ngón trỏ trái (Left Index)">
                Ngón trỏ trái (Left Index)
              </option>
              <option value="Ngón cái trái (Left Thumb)">
                Ngón cái trái (Left Thumb)
              </option>
            </select>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200/80 dark:border-[#21264b] space-y-2 text-xs text-slate-500 dark:text-slate-400">
            <p className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Giao thức IoT Sensor:
            </p>
            <p>
              • Lệnh điều khiển gửi qua MQTT topic:{' '}
              <code className="text-emerald-600 dark:text-emerald-400 font-mono">
                edge/devices/fap30/enroll
              </code>
            </p>
            <p>• Độ phân giải cảm biến: 500 DPI optical FAP30 với công nghệ chống vân tay giả Silicon.</p>
          </div>

          {/* Trigger IoT Signal Button */}
          <button
            type="button"
            disabled={
              disabled ||
              fingerprintStep === 'SENDING' ||
              fingerprintStep === 'WAITING_TOUCH' ||
              fingerprintStep === 'CAPTURED'
            }
            onClick={onSendIoTTrigger}
            className={`w-full py-3 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all ${
              disabled ||
              fingerprintStep === 'SENDING' ||
              fingerprintStep === 'WAITING_TOUCH' ||
              fingerprintStep === 'CAPTURED'
                ? 'bg-slate-300 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-60'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20 cursor-pointer'
            }`}
            title={disabled ? 'Không thể tự cập nhật dữ liệu nhận diện của bản thân' : undefined}
          >
            <Send className="w-4 h-4" />
            <span>Gửi tín hiệu tới thiết bị để lấy mẫu (IoT Trigger)</span>
          </button>
        </div>

        {/* Device Feedback HUD */}
        <div className="p-5 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200/80 dark:border-[#21264b] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-[#21264b] text-xs">
              <span className="font-mono text-slate-500 dark:text-slate-400 font-medium">
                TRẠNG THÁI KẾT NỐI THIẾT BỊ
              </span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                ONLINE
              </span>
            </div>

            <div className="mt-6 text-center space-y-3">
              <div
                className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center border-2 transition-all ${
                  fingerprintStep === 'IDLE'
                    ? 'border-slate-300 dark:border-slate-700 text-slate-400'
                    : fingerprintStep === 'SENDING'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400 animate-pulse'
                    : fingerprintStep === 'WAITING_TOUCH'
                    ? 'border-amber-400 text-amber-500 animate-bounce'
                    : 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40'
                }`}
              >
                <Fingerprint className="w-10 h-10" />
              </div>

              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white font-heading">
                  {fingerprintStep === 'IDLE' && 'Thiết bị đang ở chế độ chờ'}
                  {fingerprintStep === 'SENDING' && 'Đang gửi gói tin IoT kích hoạt cảm biến...'}
                  {fingerprintStep === 'WAITING_TOUCH' && 'Đèn cảm biến bật sáng - Chờ nhân viên đặt ngón tay...'}
                  {fingerprintStep === 'CAPTURED' && 'Đã đọc vân tay 500 DPI - Đang phân tích...'}
                  {fingerprintStep === 'VERIFIED' && 'Lấy mẫu thành công! NFIQ 2.0: 98.5%'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {fingerprintStep === 'VERIFIED'
                    ? `Mẫu đã sẵn sàng lưu cho ${selectedFinger}`
                    : `Mục tiêu: ${selectedDevice}`}
                </p>
              </div>
            </div>
          </div>

          {/* Quality score badge */}
          {fingerQualityScore && fingerprintStep === 'VERIFIED' && (
            <div className="mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-semibold">
                <CheckCheck className="w-4 h-4" />
                Chuẩn FAP30 500DPI hợp lệ
              </span>
              <span className="font-mono font-bold">Điểm: {fingerQualityScore}/100</span>
            </div>
          )}
        </div>
      </div>

      {/* Explicit Confirm Button for Fingerprint */}
      <div className="pt-4 border-t border-slate-100 dark:border-[#21264b] flex justify-end">
        <button
          type="button"
          disabled={disabled || fingerprintStep !== 'VERIFIED'}
          onClick={onOpenConfirmModal}
          className={`px-6 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all ${
            fingerprintStep === 'VERIFIED' && !disabled
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20 cursor-pointer'
              : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
          }`}
        >
          <Check className="w-4 h-4" />
          <span>Xác nhận lưu mẫu vân tay vào hồ sơ</span>
        </button>
      </div>
    </div>
  );
};
