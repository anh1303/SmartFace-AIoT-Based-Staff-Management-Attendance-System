import React from 'react';
import { Modal } from '../../../components/common/Modal';
import { Award, FileSpreadsheet, Users, Check, Download } from 'lucide-react';

export type ExportReportType = 'attendance' | 'payroll' | 'employees';

interface ExportReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  exportType: ExportReportType;
  onSelectExportType: (type: ExportReportType) => void;
  onExecuteExport: () => void;
}

export const ExportReportsModal: React.FC<ExportReportsModalProps> = ({
  isOpen,
  onClose,
  exportType,
  onSelectExportType,
  onExecuteExport,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Xuất báo cáo hệ thống (CSV / Excel)"
      subtitle="Chọn loại báo cáo bạn muốn tải xuống với đầy đủ dữ liệu cập nhật"
      maxWidth="md"
    >
      <div className="space-y-4">
        <div className="space-y-2.5">
          {/* Option 1: Attendance */}
          <div
            onClick={() => onSelectExportType('attendance')}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
              exportType === 'attendance'
                ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-400 dark:border-purple-500 text-slate-900 dark:text-white shadow-xs'
                : 'bg-slate-50 dark:bg-[#0f1224] border-slate-200 dark:border-[#272d5a] hover:border-purple-300 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div
              className={`p-2 rounded-xl mt-0.5 ${
                exportType === 'attendance'
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Award className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  1. Báo cáo Tổng hợp Chuyên cần (Attendance Summary)
                </p>
                {exportType === 'attendance' && (
                  <Check className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Xuất dữ liệu: Mã NV, Họ tên, Phòng ban, Tổng lượt điểm danh, Số lượt đúng giờ, Đi
                muộn/Về sớm, Tỷ lệ đúng giờ (%), Xếp loại thi đua.
              </p>
            </div>
          </div>

          {/* Option 2: Payroll */}
          <div
            onClick={() => onSelectExportType('payroll')}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
              exportType === 'payroll'
                ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-400 dark:border-purple-500 text-slate-900 dark:text-white shadow-xs'
                : 'bg-slate-50 dark:bg-[#0f1224] border-slate-200 dark:border-[#272d5a] hover:border-purple-300 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div
              className={`p-2 rounded-xl mt-0.5 ${
                exportType === 'payroll'
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  2. Báo cáo Chi phí Lương (Payroll Report)
                </p>
                {exportType === 'payroll' && (
                  <Check className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Xuất dữ liệu: Mã NV, Họ tên, Kỳ lương, Lương theo giờ, Giờ làm việc, Giờ tăng ca, Giờ
                trễ/sớm, Phụ cấp, Lương thực lĩnh Net, Trạng thái chốt sổ.
              </p>
            </div>
          </div>

          {/* Option 3: Employees & Biometrics */}
          <div
            onClick={() => onSelectExportType('employees')}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
              exportType === 'employees'
                ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-400 dark:border-purple-500 text-slate-900 dark:text-white shadow-xs'
                : 'bg-slate-50 dark:bg-[#0f1224] border-slate-200 dark:border-[#272d5a] hover:border-purple-300 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div
              className={`p-2 rounded-xl mt-0.5 ${
                exportType === 'employees'
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Users className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  3. Hồ sơ & Đăng ký Sinh trắc (Employee Biometrics)
                </p>
                {exportType === 'employees' && (
                  <Check className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Xuất danh sách: Mã NV, Họ tên, Phòng ban, Chức vụ, Email, Trạng thái, Lương cơ bản,
                Trạng thái Face ID 512D, Vân tay.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-3 flex justify-end gap-2 border-t border-slate-200 dark:border-[#21264b]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1a1e3a] border border-slate-200 dark:border-[#272d5a] cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={onExecuteExport}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-sm shadow-purple-500/20 flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Tải file CSV ngay</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
