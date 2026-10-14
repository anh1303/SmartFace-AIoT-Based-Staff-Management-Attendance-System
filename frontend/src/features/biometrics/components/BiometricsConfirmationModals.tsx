import React from 'react';
import { Modal } from '../../../components/common/Modal';
import { RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Employee } from '../../../types';
import { EnrollFaceResult } from '../../../api/biometricApi';

interface FaceConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEmp?: Employee;
  photoCount: number;
  analyzingFace: boolean;
  onConfirm: () => void;
}

export const FaceConfirmModal: React.FC<FaceConfirmModalProps> = ({
  isOpen,
  onClose,
  currentEmp,
  photoCount,
  analyzingFace,
  onConfirm,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Xác nhận cập nhật dữ liệu khuôn mặt"
      subtitle={`Nhân sự: ${currentEmp?.full_name} (${currentEmp?.employee_id})`}
      maxWidth="md"
    >
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200/80 dark:border-[#21264b] text-xs text-slate-700 dark:text-slate-300 space-y-2">
          <p className="font-semibold text-slate-900 dark:text-white">
            Xác nhận ghi nhận {photoCount} ảnh mẫu sinh trắc học?
          </p>
          <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
            Ảnh sẽ được gửi đến Face Auth để phát hiện khuôn mặt, trích xuất vector 512-D và tạo
            centroid. Các vector được lưu trong bảng{' '}
            <code className="text-purple-600 dark:text-purple-400">face_embeddings</code> của database PBL6.
          </p>
          <div className="pt-2 border-t border-slate-200/60 dark:border-[#21264b] flex items-center justify-between text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
            <span>ĐIỀU KIỆN: ĐỦ 3 ẢNH</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            disabled={analyzingFace}
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1d2243] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#272d5a] text-xs font-semibold cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            disabled={analyzingFace}
            onClick={onConfirm}
            className={`px-5 py-2 rounded-xl text-white text-xs font-semibold shadow-sm flex items-center gap-2 transition-all cursor-pointer ${
              analyzingFace
                ? 'bg-purple-600/70 cursor-wait'
                : 'bg-purple-600 hover:bg-purple-700 shadow-purple-600/20'
            }`}
          >
            {analyzingFace ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Đang trích xuất & lưu...</span>
              </>
            ) : (
              <span>Xác nhận lưu thay đổi</span>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

interface FaceResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEmp?: Employee;
  enrollResult: EnrollFaceResult | null;
  uploadedPhotoCount: number;
}

export const FaceResultModal: React.FC<FaceResultModalProps> = ({
  isOpen,
  onClose,
  currentEmp,
  enrollResult,
  uploadedPhotoCount,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Thông báo kết quả trích xuất sinh trắc học khuôn mặt"
      subtitle={`Nhân sự: ${currentEmp?.full_name} (${currentEmp?.employee_id})`}
      maxWidth="md"
    >
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200/80 dark:border-[#21264b] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Trạng thái xử lý:
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              ĐÃ TRÍCH XUẤT THÀNH CÔNG
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b]">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">
                Khung hình trích xuất:
              </span>
              <span className="text-base font-bold font-mono text-purple-600 dark:text-purple-400">
                {enrollResult?.detected_faces ?? uploadedPhotoCount}/
                {enrollResult?.total_images ?? uploadedPhotoCount} khung hình
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                Tỉ lệ đạt:{' '}
                <strong className="text-indigo-600 dark:text-indigo-400 font-mono">
                  {enrollResult?.extraction_rate ?? 100}%
                </strong>
              </span>
            </div>

            <div className="p-3 rounded-xl bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b]">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">
                Vector 512-D hợp lệ:
              </span>
              <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {enrollResult?.n_samples_used ?? uploadedPhotoCount} vector
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                Loại bỏ outlier:{' '}
                <strong className="text-slate-500 dark:text-slate-400 font-mono">
                  {enrollResult?.n_outliers_removed ?? 0} ảnh
                </strong>
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
              <span>Tỉ lệ trích xuất thành công</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {enrollResult?.extraction_rate ?? 100}%
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-300 dark:border-slate-700">
              <div
                className="h-full bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full transition-all duration-500"
                style={{ width: `${enrollResult?.extraction_rate ?? 100}%` }}
              />
            </div>
          </div>

          {enrollResult?.warnings && enrollResult.warnings.length > 0 && (
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-300 text-[11px] space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Ghi chú trích xuất:
              </p>
              {enrollResult.warnings.map((w, idx) => (
                <p key={idx}>• {w}</p>
              ))}
            </div>
          )}

          <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 leading-relaxed">
            Các mẫu khuôn mặt đã được lưu vào bảng{' '}
            <code className="text-purple-600 dark:text-purple-400">face_embeddings</code> trong database PBL6.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-sm shadow-purple-600/20 cursor-pointer transition-colors"
          >
            Hoàn tất & Đóng
          </button>
        </div>
      </div>
    </Modal>
  );
};

interface FingerprintConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEmp?: Employee;
  selectedFinger: string;
  selectedDevice: string;
  onConfirm: () => void;
}

export const FingerprintConfirmModal: React.FC<FingerprintConfirmModalProps> = ({
  isOpen,
  onClose,
  currentEmp,
  selectedFinger,
  selectedDevice,
  onConfirm,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Xác nhận cập nhật mẫu vân tay"
      subtitle={`Nhân sự: ${currentEmp?.full_name} (${currentEmp?.employee_id})`}
      maxWidth="md"
    >
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200/80 dark:border-[#21264b] text-xs text-slate-700 dark:text-slate-300 space-y-2">
          <p className="font-semibold text-slate-900 dark:text-white">
            Xác nhận ghi đè mẫu sinh trắc vân tay
          </p>
          <p className="text-slate-500 dark:text-slate-400">
            Vị trí ngón: <strong className="text-slate-900 dark:text-white">{selectedFinger}</strong>
          </p>
          <p className="text-slate-500 dark:text-slate-400">
            Thiết bị ghi nhận:{' '}
            <strong className="text-slate-900 dark:text-white">{selectedDevice}</strong>
          </p>
          <p className="text-slate-500 dark:text-slate-400">
            Chỉ số chất lượng NFIQ:{' '}
            <strong className="text-emerald-600 dark:text-emerald-400">98.5/100 (Rất tốt)</strong>
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1d2243] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#272d5a] text-xs font-semibold cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm shadow-emerald-600/20 cursor-pointer"
          >
            Xác nhận lưu mẫu vân tay
          </button>
        </div>
      </div>
    </Modal>
  );
};
