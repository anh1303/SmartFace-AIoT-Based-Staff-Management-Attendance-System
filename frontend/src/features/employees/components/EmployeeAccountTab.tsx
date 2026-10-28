import React, { useState } from 'react';
import {
  ShieldCheck,
  User,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Power
} from 'lucide-react';
import { Employee } from '../../../types';
import { resetEmployeePasswordApi } from '../../../api/employeeApi';

interface EmployeeAccountTabProps {
  currentEmp: Employee;
  onUpdateStatus: (newStatus: 'ACTIVE' | 'INACTIVE') => Promise<void> | void;
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const EmployeeAccountTab: React.FC<EmployeeAccountTabProps> = ({
  currentEmp,
  onUpdateStatus,
  showToast,
}) => {
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const isActive = currentEmp.status === 'ACTIVE';
  const username = currentEmp.username || currentEmp.employee_id;

  const handleToggleStatus = async () => {
    const nextStatus: 'ACTIVE' | 'INACTIVE' = isActive ? 'INACTIVE' : 'ACTIVE';
    try {
      await onUpdateStatus(nextStatus);
      showToast(
        nextStatus === 'ACTIVE'
          ? `Tài khoản ${currentEmp.full_name} đã chuyển sang trạng thái Hoạt động`
          : `Tài khoản ${currentEmp.full_name} đã tạm ngưng hoạt động`,
        'success'
      );
    } catch {
      showToast('Có lỗi xảy ra khi cập nhật trạng thái tài khoản', 'error');
    }
  };

  const handleResetPassword = async () => {
    if (!currentEmp.email) {
      showToast('Nhân viên chưa có email. Vui lòng cập nhật email trước khi đặt lại mật khẩu!', 'warning');
      setIsConfirmModalOpen(false);
      return;
    }

    setIsResetting(true);
    try {
      const res = await resetEmployeePasswordApi(currentEmp.id || currentEmp.employee_id);
      setIsConfirmModalOpen(false);
      showToast(res?.message || 'Đã đặt lại mật khẩu và gửi email thành công!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Đặt lại mật khẩu thất bại, vui lòng thử lại', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Account Settings Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        {/* CARD 1: Thông tin đăng nhập */}
        <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-2xl p-6 shadow-xs flex flex-col justify-between transition-colors">
          <div>
            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-[#21264b]">
              <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Thông tin Tài khoản Đăng nhập
              </h3>
            </div>

            <div className="space-y-4 mt-5">
              {/* Tên tài khoản */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Tên tài khoản</span>
                </label>
                <input
                  type="text"
                  value={username}
                  readOnly
                  disabled
                  className="w-full px-3.5 py-2.5 bg-slate-100/80 dark:bg-[#0c0e1e] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-slate-200 cursor-not-allowed select-all"
                />
              </div>

              {/* Mật khẩu */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                  <span>Mật khẩu</span>
                </label>
                <input
                  type="password"
                  value="••••••••••••"
                  readOnly
                  disabled
                  className="w-full px-3.5 py-2.5 bg-slate-100/80 dark:bg-[#0c0e1e] border border-slate-200 dark:border-[#272d5a] rounded-xl text-sm font-mono tracking-widest text-slate-500 dark:text-slate-400 cursor-not-allowed select-none"
                />
              </div>
            </div>
          </div>

          {/* Nút đặt lại mật khẩu */}
          <div className="pt-6 mt-6 border-t border-slate-100 dark:border-[#21264b]">
            <button
              type="button"
              onClick={() => setIsConfirmModalOpen(true)}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm shadow-blue-600/25 cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
              <span>Đặt lại mật khẩu</span>
            </button>
          </div>
        </div>

        {/* CARD 2: Trạng thái & Quyền hoạt động */}
        <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-2xl p-6 shadow-xs flex flex-col justify-between transition-colors">
          <div>
            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-[#21264b]">
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/40">
                <Power className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Trạng thái Hoạt động
              </h3>
            </div>

            {/* Công tắc Hoạt động <-> Tạm ngưng */}
            <div className="mt-6 p-4 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200/80 dark:border-[#272d5a] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    Trạng thái tài khoản
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {isActive
                      ? 'Tài khoản đang Hoạt động bình thường'
                      : 'Tài khoản đang bị Tạm ngưng hoạt động'}
                  </p>
                </div>

                {/* Switch Toggle */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={isActive}
                  onClick={handleToggleStatus}
                  className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${isActive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  title={isActive ? 'Nhấp để tạm ngưng hoạt động' : 'Nhấp để kích hoạt tài khoản'}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${isActive ? 'translate-x-6' : 'translate-x-0'
                      }`}
                  />
                </button>
              </div>

              {/* Status Indicator Pill */}
              <div className="flex items-center gap-2 pt-3 border-t border-slate-200/60 dark:border-[#1d2243]">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Hiện tại:</span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono border ${isActive
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/50'
                    }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  {isActive ? 'Hoạt động' : 'Tạm ngưng'}
                </span>
              </div>
            </div>

            {/* Thông tin giải thích */}
            <div className="mt-4 space-y-2 text-[11px] text-slate-500 dark:text-slate-400">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  <b>Hoạt động:</b> Nhân viên được phép đăng nhập, chấm công và nhận lịch làm việc.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                <span>
                  <b>Tạm ngưng:</b> Ngắt toàn bộ phiên đăng nhập, khóa quyền đăng nhập vào hệ thống và từ chối xác thực tại cổng kiểm soát.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL XÁC NHẬN ĐẶT LẠI MẬT KHẨU */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => !isResetting && setIsConfirmModalOpen(false)}
          />

          <div className="relative bg-white dark:bg-[#13162b] border border-slate-200 dark:border-[#21264b] rounded-2xl p-6 max-w-md w-full shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40 shrink-0 flex items-center justify-center">
                <KeyRound className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                Xác nhận đặt lại mật khẩu?
              </h4>
            </div>

            <div className="mt-4 p-3.5 bg-slate-50 dark:bg-[#0f1224] border border-slate-200/80 dark:border-[#272d5a] rounded-xl text-xs space-y-2">
              <div className="flex justify-between text-slate-700 dark:text-slate-300">
                <span className="text-slate-500 dark:text-slate-400">Nhân viên:</span>
                <span className="font-semibold">{currentEmp.full_name} ({currentEmp.employee_id})</span>
              </div>
              <div className="flex justify-between text-slate-700 dark:text-slate-300">
                <span className="text-slate-500 dark:text-slate-400">Tài khoản:</span>
                <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">{username}</span>
              </div>
              <div className="flex justify-between text-slate-700 dark:text-slate-300">
                <span className="text-slate-500 dark:text-slate-400">Gửi về email:</span>
                <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[200px]" title={currentEmp.email}>
                  {currentEmp.email || '(Chưa có email)'}
                </span>
              </div>
            </div>

            {!currentEmp.email && (
              <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Nhân viên chưa có địa chỉ email. Vui lòng cập nhật email trước!</span>
              </div>
            )}

            <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
              Sau khi xác nhận, hệ thống sẽ tự động tạo mật khẩu ngẫu nhiên mới và gửi thư thông báo đến email của nhân viên.
            </p>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-[#21264b]">
              <button
                type="button"
                disabled={isResetting}
                onClick={() => setIsConfirmModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1a1e3a] transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isResetting || !currentEmp.email}
                onClick={handleResetPassword}
                className={`px-4 py-2 rounded-xl text-xs font-semibold text-white flex items-center gap-2 transition-all cursor-pointer ${isResetting || !currentEmp.email
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/25'
                  }`}
              >
                {isResetting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang xử lý...</span>
                  </>
                ) : (
                  <span>Xác nhận đặt lại</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
