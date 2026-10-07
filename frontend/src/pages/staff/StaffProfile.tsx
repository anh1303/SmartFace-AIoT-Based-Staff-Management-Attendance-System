import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useEmployees } from '../../hooks/useEmployees';
import {
  User,
  Mail,
  Phone,
  Briefcase,
  Calendar,
  ShieldCheck,
  ScanFace,
  Fingerprint,
  Lock,
  Building2,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

export const StaffProfile: React.FC = () => {
  const { currentUser } = useAuth();
  const { employees } = useEmployees();

  const currentEmployee = employees.find(
    e => e.employee_id === currentUser?.employee_id || e.id === currentUser?.employee_id
  );

  const formatDisplayDate = (dateStr?: string) => {
    if (!dateStr) return '15/01/2024';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Bento Header Banner with Continuous Shifting Gradient & Floating Blobs */}
      <div className="bento-hero-gradient rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all">
        {/* Ambient Floating & Morphing Blurred Blobs */}
        <div className="absolute -top-14 -right-10 w-72 h-72 bg-gradient-to-br from-purple-500/30 to-fuchsia-500/25 dark:from-purple-600/35 dark:to-fuchsia-600/25 rounded-full blur-3xl pointer-events-none animate-blob-1" />
        <div className="absolute -bottom-16 left-1/4 w-64 h-64 bg-gradient-to-tr from-indigo-500/30 to-blue-500/20 dark:from-indigo-600/30 dark:to-blue-600/20 rounded-full blur-3xl pointer-events-none animate-blob-2" />
        <div className="absolute top-1/4 right-1/3 w-48 h-48 bg-gradient-to-r from-violet-400/25 to-pink-400/25 dark:from-violet-500/25 dark:to-pink-500/20 rounded-full blur-2xl pointer-events-none animate-blob-3" />

        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-heading tracking-tight">
              Hồ sơ Cá nhân & Dữ liệu Sinh trắc
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-medium flex items-center gap-1">
              <Lock className="w-3 h-3" /> Chế độ chỉ đọc (Read-only)
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Thông tin nhân sự và dữ liệu sinh trắc học được đồng bộ an toàn từ phòng Nhân sự (HR).
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/80 dark:bg-[#0f1224] border border-purple-200/80 dark:border-[#272d5a] text-purple-600 dark:text-purple-400 text-xs font-mono shadow-xs backdrop-blur-sm">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>AES-256 SECURED BIOMETRICS</span>
        </div>
      </div>

      {/* Main Profile Grid */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Left Column: Avatar & Biometric status */}
        <div className="lg:col-span-4 space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] shadow-xs text-center flex flex-col items-center">
            <div className="relative mb-4">
              <img
                src={currentUser?.avatar || currentEmployee?.avatar || "https://lh3.googleusercontent.com/aida-public/AB6AXuA0KS6nUhHdsndSeZ0LOeLkOfZAEfZAfm63Txsb3ryYsAUsiH0gLZ9VIT3CcW3uMw_MkVbDlsl53kBdUR8_KlS0J9tew5ToWiUd-q4Ct0wcosdejjVyvTptYjYHD0OY6LKozVPucFXEEHhfJqTf9_78zsEhE0xrMlMTYy2M9jxhP8ZrayoGhJz_E9WrMsLfaZlj-stHu3rWBibcwNnFos3o70DrOeSmxACoW5JdNeIoP3zwcbW4dK42"}
                alt={currentUser?.full_name}
                className="w-28 h-28 rounded-2xl object-cover border-2 border-purple-500 shadow-lg"
              />
              <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1 rounded-full border-2 border-white dark:border-[#13162b]">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>

            <h2 className="text-lg font-bold text-slate-900 dark:text-white font-heading">{currentUser?.full_name || currentEmployee?.full_name}</h2>
            <p className="text-xs font-mono text-purple-600 dark:text-purple-400 mt-0.5">{currentUser?.employee_id}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{currentUser?.position || currentEmployee?.position}</p>
            <span className="mt-3 inline-block px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold">
              ĐANG HOẠT ĐỘNG (ACTIVE)
            </span>
          </div>

          {/* Biometric Registry */}
          <div className="p-6 rounded-2xl bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-heading">
              Trạng thái Sinh trắc học
            </h3>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <ScanFace className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">Face ID 512-D</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Góc thẳng, nghiêng 15°, 30°</p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 font-bold">
                ĐÃ ĐĂNG KÝ
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Fingerprint className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">Vân tay FAP30</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Ngón trỏ trái & phải</p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 font-bold">
                ĐÃ ĐĂNG KÝ
              </span>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <span>
                Cần cập nhật lại dữ liệu khuôn mặt? Vui lòng liên hệ trực tiếp Bộ phận Kỹ thuật & IT để thu thập lại mẫu tại phòng Lab.
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Detailed Read-Only Specs */}
        <div className="lg:col-span-8 space-y-6">
          {/* General Information */}
          <div className="p-6 rounded-2xl bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-heading">
              Thông tin công tác & Liên hệ
            </h3>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a]">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" /> Chức vụ
                </span>
                <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
                  {currentUser?.department || currentEmployee?.department || 'Nhân viên'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a]">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" /> Vị trí công việc
                </span>
                <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
                  {currentUser?.position || currentEmployee?.position || 'AI Engineer Lead'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a]">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" /> Email doanh nghiệp
                </span>
                <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1 font-mono">
                  {currentUser?.email || currentEmployee?.email || 'anv@aiot.corp'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a]">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" /> Số điện thoại
                </span>
                <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1 font-mono">
                  {currentEmployee?.phone || '0987.654.321'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a]">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" /> Ngày gia nhập công ty
                </span>
                <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1 font-mono">
                  {currentEmployee?.created_at ? formatDisplayDate(currentEmployee.created_at) : '15/01/2024'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a]">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" /> Phân cấp quyền hạn
                </span>
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                  {currentUser?.role === 'manager' ? 'ROLE_MANAGER • LEVEL 1' : 'ROLE_STAFF • LEVEL 2'}
                </p>
              </div>
            </div>
          </div>

          {/* Contractual and Shift Info */}
          <div className="p-6 rounded-2xl bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-heading">
              Quy định ca làm việc tiêu chuẩn
            </h3>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex justify-between items-center py-2.5 border-b border-slate-200 dark:border-[#21264b]">
                <span>Khung giờ ca chính</span>
                <span className="font-mono text-slate-900 dark:text-white font-semibold">08:00 - 17:30 (Nghỉ trưa 12:00 - 13:30)</span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-slate-200 dark:border-[#21264b]">
                <span>Thời gian cho phép muộn</span>
                <span className="font-mono text-slate-900 dark:text-white font-semibold">&le; 15 phút (Sau 08:15 tính vi phạm trễ)</span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-slate-200 dark:border-[#21264b]">
                <span>Hệ số làm thêm giờ (OT)</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">150% (Ngày thường) • 200% (Cuối tuần)</span>
              </div>
              <div className="flex justify-between items-center py-2.5">
                <span>Thiết bị điểm danh mặc định</span>
                <span className="font-mono text-purple-600 dark:text-purple-400 font-semibold">FaceCam-01 (Cổng chính - Tầng 1)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};