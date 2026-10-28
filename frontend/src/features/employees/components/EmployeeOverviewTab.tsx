import { Avatar } from '../../../components/common/Avatar';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ScanFace,
  Fingerprint,
  Calendar,
  Clock,
  Sparkles,
  TrendingUp
} from 'lucide-react';
import { Employee } from '../../../types';
import { formatVNDate } from '../../../utils/dateUtils';
import { BiometricStatusBadge } from '@/features/biometrics';

interface EmployeeOverviewTabProps {
  currentEmp: Employee;
  hourlyRate: number;
  standardHours: number;
  overtimeHours: number;
  lateEarlyHours: number;
  currentNetSalary: number;
  workDays: number;
  onOpenEditModal: () => void;
}

export const EmployeeOverviewTab: React.FC<EmployeeOverviewTabProps> = ({
  currentEmp,
  hourlyRate,
  standardHours,
  overtimeHours,
  lateEarlyHours,
  currentNetSalary,
  workDays,
  onOpenEditModal,
}) => {
  const navigate = useNavigate();
  const currentMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  return (
    <div className="space-y-6">
      {/* KHỐI TRÊN: 2 CỘT (7 CỘT THÔNG TIN + 5 CỘT SINH TRẮC HỌC) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* CỘT TRÁI: THÔNG TIN HỒ SƠ NHÂN VIÊN (7 Cột) */}
        <div className="lg:col-span-7 bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-xl overflow-hidden shadow-xs flex flex-col justify-between transition-colors">
          <div className="divide-y divide-slate-100 dark:divide-[#21264b]">
            {/* Hàng 1: Avatar, Họ tên & Trạng thái */}
            <div className="p-5 bg-slate-50/70 dark:bg-[#0f1224]/70 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <div className="relative shrink-0">
                  <Avatar src={currentEmp.avatar} name={currentEmp.full_name} size={56}/>
                  <span
                    className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-[#13162b] ${currentEmp.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-slate-600'
                      }`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <h2
                      className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white font-heading truncate max-w-[180px] sm:max-w-[240px]"
                      title={currentEmp.full_name}
                    >
                      {currentEmp.full_name}
                    </h2>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono border shrink-0 ${currentEmp.status === 'ACTIVE'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                        }`}
                    >
                      {currentEmp.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm ngưng'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Hàng 2: Mã Nhân Viên & Phòng ban & Chức vụ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-[#21264b]">
              <div className="p-4 space-y-1 min-w-0">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Mã Nhân Viên:</span>
                <p className="text-sm font-mono font-bold text-blue-600 dark:text-blue-400 truncate" title={currentEmp.employee_id}>
                  {currentEmp.employee_id}
                </p>
              </div>
              <div className="p-4 space-y-1 min-w-0">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Phòng ban & Chức vụ:</span>
                <p
                  className="text-sm font-semibold text-slate-900 dark:text-white truncate"
                  title={`${currentEmp.department || 'Chung'} (${currentEmp.position || 'Nhân viên'})`}
                >
                  {currentEmp.department || 'Chung'}
                  <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1">
                    ({currentEmp.position || 'Nhân viên'})
                  </span>
                </p>
              </div>
            </div>

            {/* Hàng 3: Email & Số điện thoại */}
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-[#21264b]">
              <div className="p-4 space-y-1 min-w-0">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Email:</span>
                <p className="text-xs font-mono text-slate-800 dark:text-slate-200 truncate" title={currentEmp.email || 'Chưa cập nhật'}>
                  {currentEmp.email || 'Chưa cập nhật'}
                </p>
              </div>
              <div className="p-4 space-y-1 min-w-0">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Số điện thoại:</span>
                <p className="text-xs font-mono text-slate-800 dark:text-slate-200 truncate" title={currentEmp.phone || 'Chưa cập nhật'}>
                  {currentEmp.phone || 'Chưa cập nhật'}
                </p>
              </div>
            </div>

            {/* Hàng 4: Lương theo giờ & Ngày tham gia */}
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-[#21264b]">
              <div className="p-4 space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Lương theo giờ:</span>
                <p className="text-sm font-mono font-extrabold text-blue-600 dark:text-blue-400">
                  {hourlyRate.toLocaleString('vi-VN')} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">đ</span>
                </p>
              </div>
              <div className="p-4 space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Ngày tham gia:</span>
                <p className="text-xs font-mono text-slate-800 dark:text-slate-200">{formatVNDate(currentEmp.created_at)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: SINH TRẮC HỌC (5 Cột) */}
        <div className="lg:col-span-5 bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-xl overflow-hidden shadow-xs flex flex-col justify-between transition-colors">
          <div className="divide-y divide-slate-100 dark:divide-[#21264b]">
            {/* Hàng 1: Header Sinh trắc học */}
            <div className="p-5 bg-slate-50/70 dark:bg-[#0f1224]/70 flex items-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">
                Sinh trắc học
              </h3>
            </div>

            {/* Hàng 2: Nhận diện khuôn mặt (Face ID) */}
            <div className="p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ScanFace className={`w-4 h-4 ${currentEmp.face_enrolled ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Nhận diện khuôn mặt (Face ID)</span>
                </div>
                <BiometricStatusBadge enrolled={currentEmp.face_enrolled} />
              </div>

              <button
                type="button"
                onClick={() => navigate(`/app/manager/biometrics?employee_id=${currentEmp.employee_id}`)}
                className={`w-full py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${currentEmp.face_enrolled
                  ? 'bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1d2243] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#272d5a]'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-600/20'
                  }`}
              >
                <ScanFace className="w-3.5 h-3.5" />
                <span>{currentEmp.face_enrolled ? 'Chỉnh sửa' : 'Đăng ký'}</span>
              </button>
            </div>

            {/* Hàng 3: Cảm biến vân tay (FAP30) */}
            <div className="p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Fingerprint className={`w-4 h-4 ${currentEmp.fingerprint_enrolled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Cảm biến vân tay (FAP30)</span>
                </div>
                <BiometricStatusBadge enrolled={currentEmp.fingerprint_enrolled} />
              </div>

              <button
                type="button"
                onClick={() => navigate(`/app/manager/biometrics?employee_id=${currentEmp.employee_id}&tab=fingerprint`)}
                className={`w-full py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${currentEmp.fingerprint_enrolled
                  ? 'bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1d2243] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#272d5a]'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-600/20'
                  }`}
              >
                <Fingerprint className="w-3.5 h-3.5" />
                <span>{currentEmp.fingerprint_enrolled ? 'Chỉnh sửa' : 'Đăng ký'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* KHỐI DƯỚI: ĐÁNH GIÁ CHUNG (TRUNG BÌNH TRÊN MỘT THÁNG) - 4 CỘT */}
      <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-xl overflow-hidden shadow-xs transition-colors">
        {/* Tiêu đề bảng */}
        <div className="p-4 sm:p-5 bg-slate-50/70 dark:bg-[#0f1224]/70 border-b border-slate-100 dark:border-[#21264b] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-heading">
              Đánh giá chung (trung bình trên một tháng)
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Tổng hợp số ngày công, giờ tăng ca, thời gian đi trễ/về sớm và mức lương thực nhận
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-[#0f1224] px-3 py-1.5 rounded-xl border border-blue-200 dark:border-[#272d5a] self-start sm:self-auto">
            <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Kỳ: {currentMonthKey}</span>
          </div>
        </div>

        {/* 4 Cột Bento Thống kê */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-[#21264b]">
          {/* Cột 1: Tổng ngày công */}
          <div className="p-5 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Tổng ngày công</span>
              <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-900 dark:text-white">
                  {workDays}
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">/ 22 ngày</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Đạt ~{Math.min(100, Math.round((workDays / 22) * 100))}% chỉ tiêu tháng
              </p>
            </div>
          </div>

          {/* Cột 2: Giờ tăng ca (OT) */}
          <div className="p-5 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Giờ tăng ca (OT)</span>
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                  +{overtimeHours}
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">giờ</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Lương định mức: {standardHours} giờ chuẩn
              </p>
            </div>
          </div>

          {/* Cột 3: Đi trễ / Về sớm */}
          <div className="p-5 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Đi trễ / Về sớm</span>
              <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-2xl sm:text-3xl font-extrabold font-mono ${lateEarlyHours > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                  {lateEarlyHours}
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">giờ</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {lateEarlyHours === 0 ? 'Tuân thủ giờ làm việc xuất sắc' : 'Đã trừ vào khấu trừ chuyên cần'}
              </p>
            </div>
          </div>

          {/* Cột 4: Lương thực nhận */}
          <div className="p-5 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Lương thực nhận tạm tính</span>
              <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl sm:text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
                  {currentNetSalary.toLocaleString('vi-VN')}
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">đ</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Bao gồm lương cứng + OT + phụ cấp
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
