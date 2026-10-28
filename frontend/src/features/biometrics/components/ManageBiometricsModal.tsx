import React from 'react';
import { ScanFace, Fingerprint, Upload, Camera, Trash2, Radio } from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import { BiometricStatusBadge } from './BiometricStatusBadge';
import { Employee } from '../../../types';

interface ManageBiometricsModalProps {
  employee: Employee | null;
  onClose: () => void;
  onStartEditFace: (emp: Employee) => void;
  onStartCameraEkyc: (emp: Employee) => void;
  onDeleteFaceId: (emp: Employee) => void;
  onStartEditFingerprint: (emp: Employee) => void;
  onDeleteFingerprint: (emp: Employee) => void;
}

export const ManageBiometricsModal: React.FC<ManageBiometricsModalProps> = ({
  employee,
  onClose,
  onStartEditFace,
  onStartCameraEkyc,
  onDeleteFaceId,
  onStartEditFingerprint,
  onDeleteFingerprint,
}) => {
  if (!employee) return null;

  return (
    <Modal
      isOpen={Boolean(employee)}
      onClose={onClose}
      title="Quản Lý Sinh Trắc Học Nhân Viên"
      subtitle={`Nhân sự: ${employee.full_name} (${employee.employee_id})`}
      maxWidth="2xl"
    >
      <div className="space-y-5">
        {/* Employee Profile Header Card */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200/80 dark:border-[#21264b] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            <img
              src={
                employee.avatar ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120'
              }
              alt={employee.full_name}
              className="w-12 h-12 rounded-xl object-cover border border-blue-200 dark:border-blue-800 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white max-w-[150px] sm:max-w-[180px] truncate" title={employee.full_name}>
                {employee.full_name}
              </h4>
              <p className="text-xs font-mono text-blue-600 dark:text-blue-400 max-w-[150px] sm:max-w-[180px] truncate" title={employee.employee_id}>
                {employee.employee_id}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-[150px] sm:max-w-[180px] truncate" title={`${employee.department} • ${employee.position}`}>
                {employee.department} • {employee.position}
              </p>
            </div>
          </div>
        </div>

        {/* Section 1: Face ID Management */}
        <div className="p-5 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200/80 dark:border-[#21264b] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <ScanFace className="w-4 h-4" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Khuôn mặt (Face ID)
                </h5>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Nhận diện khuôn mặt 512-D qua camera AIoT
                </p>
              </div>
            </div>

            <BiometricStatusBadge enrolled={employee.face_enrolled} uppercase size="sm" />
          </div>

          <div className="flex items-center justify-between gap-2.5 pt-3 border-t border-slate-200/60 dark:border-[#21264b]">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => onStartEditFace(employee)}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm shadow-blue-600/20 whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>
                  {employee.face_enrolled ? 'Chỉnh sửa / Tải ảnh mới' : 'Đăng ký tải ảnh Face ID'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onStartCameraEkyc(employee)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#13162b] dark:hover:bg-[#1d2243] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#272d5a] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Camera className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                <span>Chụp bằng Camera eKYC</span>
              </button>
            </div>

            {employee.face_enrolled && (
              <button
                type="button"
                onClick={() => onDeleteFaceId(employee)}
                className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-600 text-rose-600 hover:text-white dark:text-rose-300 dark:hover:text-white border border-rose-200 dark:border-rose-800/50 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa Face ID</span>
              </button>
            )}
          </div>
        </div>

        {/* Section 2: Fingerprint Management */}
        <div className="p-5 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200/80 dark:border-[#21264b] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Fingerprint className="w-4 h-4" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Vân tay (FAP30)
                </h5>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Ghi nhận mẫu vân tay quang học 500 DPI qua IoT
                </p>
              </div>
            </div>

            <BiometricStatusBadge enrolled={employee.fingerprint_enrolled} uppercase size="sm" />
          </div>

          <div className="flex items-center justify-between gap-2.5 pt-3 border-t border-slate-200/60 dark:border-[#21264b]">
            <button
              type="button"
              onClick={() => onStartEditFingerprint(employee)}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm shadow-emerald-600/20 whitespace-nowrap"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>
                {employee.fingerprint_enrolled
                  ? 'Chỉnh sửa / Lấy lại mẫu IoT'
                  : 'Ghi nhận mẫu vân tay IoT'}
              </span>
            </button>

            {employee.fingerprint_enrolled && (
              <button
                type="button"
                onClick={() => onDeleteFingerprint(employee)}
                className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-600 text-rose-600 hover:text-white dark:text-rose-300 dark:hover:text-white border border-rose-200 dark:border-rose-800/50 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa Vân tay</span>
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 dark:border-[#21264b] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1d2243] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#272d5a] text-xs font-semibold transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </Modal>
  );
};
