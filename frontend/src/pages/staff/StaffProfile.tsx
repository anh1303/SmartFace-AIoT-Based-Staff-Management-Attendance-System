import React from 'react';
import { useApp } from '../../context/AppContext';
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
  const { currentUser } = useApp();

  return (
    <div className="space-y-6">
      {/* Bento Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900 border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white font-heading tracking-tight">
              Hồ sơ Cá nhân & Dữ liệu Sinh trắc
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium flex items-center gap-1">
              <Lock className="w-3 h-3" /> Chế độ chỉ đọc (Read-only)
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Thông tin nhân sự và dữ liệu sinh trắc học được đồng bộ an toàn từ phòng Nhân sự (HR).
          </p>
        </div>

        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-blue-400 text-xs font-mono">
          <ShieldCheck className="w-4 h-4 text-green-500" />
          <span>AES-256 SECURED BIOMETRICS</span>
        </div>
      </div>

      {/* Main Profile Grid */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Left Column: Avatar & Biometric status */}
        <div className="lg:col-span-4 space-y-6">
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 text-center flex flex-col items-center">
            <div className="relative mb-4">
              <img
                src={currentUser?.avatar || "https://lh3.googleusercontent.com/aida-public/AB6AXuA0KS6nUhHdsndSeZ0LOeLkOfZAEfZAfm63Txsb3ryYsAUsiH0gLZ9VIT3CcW3uMw_MkVbDlsl53kBdUR8_KlS0J9tew5ToWiUd-q4Ct0wcosdejjVyvTptYjYHD0OY6LKozVPucFXEEHhfJqTf9_78zsEhE0xrMlMTYy2M9jxhP8ZrayoGhJz_E9WrMsLfaZlj-stHu3rWBibcwNnFos3o70DrOeSmxACoW5JdNeIoP3zwcbW4dK42"}
                alt={currentUser?.full_name}
                className="w-28 h-28 rounded-2xl object-cover border-2 border-blue-500 shadow-xl"
              />
              <div className="absolute -bottom-1 -right-1 bg-green-500 text-white p-1 rounded-full border-2 border-slate-900">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>

            <h2 className="text-lg font-bold text-white font-heading">{currentUser?.full_name}</h2>
            <p className="text-xs font-mono text-blue-400 mt-0.5">{currentUser?.employee_id}</p>
            <p className="text-xs text-slate-400 mt-1">{currentUser?.position}</p>
            <span className="mt-3 inline-block px-3 py-1 rounded-full bg-green-500/10 text-green-500 border border-green-500/20 text-[11px] font-semibold">
              ĐANG HOẠT ĐỘNG (ACTIVE)
            </span>
          </div>

          {/* Biometric Registry */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-heading">
              Trạng thái Sinh trắc học
            </h3>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                  <ScanFace className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">Face ID 512-D</p>
                  <p className="text-[10px] text-slate-400">Góc thẳng, nghiêng 15°, 30°</p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-green-500 bg-green-500/10 px-2 py-0.5 rounded-md border border-green-500/20 font-bold">
                ĐÃ ĐĂNG KÝ
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-green-500/10 text-green-500 flex items-center justify-center">
                  <Fingerprint className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">Vân tay FAP30</p>
                  <p className="text-[10px] text-slate-400">Ngón trỏ trái & phải</p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-green-500 bg-green-500/10 px-2 py-0.5 rounded-md border border-green-500/20 font-bold">
                ĐÃ ĐĂNG KÝ
              </span>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <span>
                Cần cập nhật lại dữ liệu khuôn mặt? Vui lòng liên hệ trực tiếp Bộ phận Kỹ thuật & IT để thu thập lại mẫu tại phòng Lab.
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Detailed Read-Only Specs */}
        <div className="lg:col-span-8 space-y-6">
          {/* General Information */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-heading">
              Thông tin công tác & Liên hệ
            </h3>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-400" /> Phòng ban
                </span>
                <p className="text-sm font-semibold text-white mt-1">
                  {currentUser?.department || 'Kỹ thuật AI'}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-blue-400" /> Vị trí công việc
                </span>
                <p className="text-sm font-semibold text-white mt-1">
                  {currentUser?.position || 'AI Engineer Lead'}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-400" /> Email doanh nghiệp
                </span>
                <p className="text-sm font-semibold text-white mt-1 font-mono">
                  {currentUser?.email || 'anv@aiot.corp'}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-blue-400" /> Số điện thoại
                </span>
                <p className="text-sm font-semibold text-white mt-1 font-mono">
                  0987.654.321
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" /> Ngày gia nhập công ty
                </span>
                <p className="text-sm font-semibold text-white mt-1 font-mono">
                  15/01/2024
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-blue-400" /> Phân cấp quyền hạn
                </span>
                <p className="text-sm font-semibold text-green-500 mt-1 font-mono">
                  ROLE_STAFF • LEVEL 2
                </p>
              </div>
            </div>
          </div>

          {/* Contractual and Shift Info */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-heading">
              Quy định ca làm việc tiêu chuẩn
            </h3>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="flex justify-between items-center py-2.5 border-b border-slate-800">
                <span>Khung giờ ca chính</span>
                <span className="font-mono text-white font-semibold">08:00 - 17:30 (Nghỉ trưa 12:00 - 13:30)</span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-slate-800">
                <span>Thời gian cho phép muộn</span>
                <span className="font-mono text-white font-semibold">&le; 15 phút (Sau 08:15 tính vi phạm trễ)</span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-slate-800">
                <span>Hệ số làm thêm giờ (OT)</span>
                <span className="font-mono text-green-500 font-semibold">150% (Ngày thường) • 200% (Cuối tuần)</span>
              </div>
              <div className="flex justify-between items-center py-2.5">
                <span>Thiết bị điểm danh mặc định</span>
                <span className="font-mono text-blue-400 font-semibold">FaceCam-01 (Cổng chính Tòa nhà A)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
