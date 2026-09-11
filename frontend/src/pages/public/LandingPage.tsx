import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { 
  ScanFace, 
  ShieldCheck, 
  Zap, 
  Clock, 
  Users, 
  Building2, 
  Cpu, 
  CheckCircle2, 
  ChevronRight, 
  Sparkles, 
  ArrowRight,
  Award,
  Lock,
  DollarSign
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [trialName, setTrialName] = useState('');
  const [trialEmail, setTrialEmail] = useState('');
  const [trialCompany, setTrialCompany] = useState('');
  const [trialSubmitted, setTrialSubmitted] = useState(false);

  const handleTrialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTrialSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <ScanFace className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="font-heading font-bold text-white text-lg tracking-wider">
                AIoT ATTENDANCE
              </span>
              <span className="hidden sm:inline-block ml-2 text-[10px] font-semibold bg-blue-500/10 text-blue-400 px-2.5 py-0.5 rounded-full border border-blue-500/20">
                ENTERPRISE
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <a href="#benefits" className="hover:text-white transition-colors">Lợi ích</a>
            <a href="#features" className="hover:text-white transition-colors">Tính năng AI</a>
            <a href="#pricing" className="hover:text-white transition-colors">Bảng giá</a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md transition-all flex items-center gap-2"
            >
              <span>Đăng nhập hệ thống (Portal)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-24 px-6 border-b border-slate-800">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10 grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5 text-blue-300" />
              <span>Công nghệ Nhận diện Khuôn mặt AI 512-D Landmark</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.15] font-heading">
              Hệ thống Chấm công & <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-indigo-400">
                Quản lý Nhân sự AIoT
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-400 max-w-2xl leading-relaxed">
              Nhận diện dưới 0.2 giây • Độ chính xác 99.8% • Chống giả mạo 3D Liveness • Tự động đồng bộ ca trực và bảng lương thời gian thực.
            </p>

            {/* Portal Login CTA Button */}
            <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-4">
              <button
                onClick={() => navigate('/login')}
                className="px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-xl shadow-blue-500/20 flex items-center gap-2 group transition-all"
              >
                <span>Đăng nhập Cổng Quản trị & Nhân sự</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* Bento Metrics */}
            <div className="pt-8 grid grid-cols-3 gap-4 border-t border-slate-800">
              <div>
                <p className="text-2xl sm:text-3xl font-bold font-mono text-white">99.8%</p>
                <p className="text-xs text-slate-400 mt-1">Độ chính xác nhận diện</p>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-bold font-mono text-green-500">&lt; 0.2s</p>
                <p className="text-xs text-slate-400 mt-1">Tốc độ điểm danh</p>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-bold font-mono text-amber-400">0%</p>
                <p className="text-xs text-slate-400 mt-1">Chấm công hộ / Gian lận</p>
              </div>
            </div>
          </div>

          {/* Hero Visual Bento Mockup */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-md bg-slate-900 rounded-3xl border border-slate-800 p-5 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 text-xs">
                <span className="flex items-center gap-2 font-mono text-green-500 font-medium">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
                  LIVE CAMERA SCAN HUD
                </span>
                <span className="text-slate-500 font-mono">Edge AI Hub #01</span>
              </div>

              {/* Camera Scanner View */}
              <div className="relative aspect-4/3 rounded-2xl overflow-hidden mt-4 bg-slate-950 border border-slate-800 flex items-center justify-center">
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuA0KS6nUhHdsndSeZ0LOeLkOfZAEfZAfm63Txsb3ryYsAUsiH0gLZ9VIT3CcW3uMw_MkVbDlsl53kBdUR8_KlS0J9tew5ToWiUd-q4Ct0wcosdejjVyvTptYjYHD0OY6LKozVPucFXEEHhfJqTf9_78zsEhE0xrMlMTYy2M9jxhP8ZrayoGhJz_E9WrMsLfaZlj-stHu3rWBibcwNnFos3o70DrOeSmxACoW5JdNeIoP3zwcbW4dK42"
                  alt="AI Face Scan preview"
                  className="w-full h-full object-cover opacity-60"
                />
                
                {/* HUD Vector Overlay */}
                <div className="absolute inset-4 border border-dashed border-blue-500/70 rounded-2xl flex flex-col justify-between p-3 pointer-events-none">
                  <div className="flex justify-between text-[10px] font-mono text-blue-400">
                    <span>512-VECTOR MATCH</span>
                    <span className="text-green-400 font-bold">LIVENESS PASS</span>
                  </div>
                  <div className="w-16 h-16 border-2 border-blue-500 rounded-full mx-auto animate-pulse flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                  </div>
                  <div className="text-center font-mono text-xs text-white bg-slate-950/80 border border-slate-800 py-1 px-2 rounded-lg">
                    NV-001 • Nguyễn Văn A (99.8%)
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-white">Chấm công Thành Công</p>
                  <p className="text-slate-400 text-[11px]">Hôm nay • 08:02:14 • Đúng giờ</p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-green-500/10 text-green-500 font-semibold font-mono text-[11px] border border-green-500/20">
                  ON TIME
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Bento Section */}
      <section id="benefits" className="py-20 px-6 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white font-heading tracking-tight">
            Giải pháp chuyên biệt cho từng phòng ban
          </h2>
          <p className="text-slate-400 mt-3 text-sm sm:text-base">
            Tối ưu hoá quy trình từ nhân viên, trưởng nhóm nhân sự đến chủ doanh nghiệp.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all shadow-lg">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-5">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-3 font-heading">Cho Nhân viên (Staff)</h3>
            <ul className="space-y-3 text-xs sm:text-sm text-slate-400">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                <span>Không cần thẻ nhựa, không sợ quên mang thẻ hay dính vân tay.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                <span>Xem lịch làm việc cá nhân, đổi ca trực, gửi đơn giải trình 1 chạm.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                <span>Tra cứu lương tạm tính và lịch sử phiếu lương minh bạch hàng tháng.</span>
              </li>
            </ul>
          </div>

          <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all shadow-lg">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-5">
              <Building2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-3 font-heading">Cho Quản lý & HR (Manager)</h3>
            <ul className="space-y-3 text-xs sm:text-sm text-slate-400">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span>Bảng sắp xếp lịch làm việc trực quan theo tuần và phòng ban.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span>Giám sát điểm danh thời gian thực, phát hiện đi trễ/vắng mặt tức thì.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span>Chốt bảng lương kỳ, tự động tính trừ phạt và xuất báo cáo CSV nhanh gọn.</span>
              </li>
            </ul>
          </div>

          <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all shadow-lg">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-5">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-3 font-heading">Cho Chủ Doanh nghiệp</h3>
            <ul className="space-y-3 text-xs sm:text-sm text-slate-400">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>Triệt tiêu hoàn toàn gian lận chấm công, tiết kiệm 95% chi phí thất thoát.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>Bảo mật dữ liệu sinh trắc học chuẩn mã hoá AES-256 nội bộ.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>Dễ dàng mở rộng cho chuỗi cửa hàng, xưởng sản xuất quy mô hàng ngàn người.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Pricing Bento Section */}
      <section id="pricing" className="py-20 px-6 bg-slate-950 border-t border-b border-slate-800">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white font-heading tracking-tight">
              Bảng giá giải pháp linh hoạt
            </h2>
            <p className="text-slate-400 mt-3 text-sm sm:text-base">
              Phù hợp cho mọi quy mô từ startup đến tập đoàn sản xuất lớn.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Starter */}
            <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-colors shadow-xl">
              <div>
                <h3 className="text-xl font-bold text-white font-heading">Khởi Nghiệp (Starter)</h3>
                <p className="text-xs text-slate-400 mt-1">Dành cho văn phòng nhỏ dưới 30 người</p>
                <div className="my-6">
                  <span className="text-3xl font-extrabold text-white font-mono">1.200.000₫</span>
                  <span className="text-xs text-slate-500"> / tháng</span>
                </div>
                <ul className="space-y-3 text-xs text-slate-300">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-green-500" /> Tối đa 30 nhân sự
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-green-500" /> 01 Camera AIoT điểm danh
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-green-500" /> Quản lý ca trực cơ bản
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-green-500" /> Xuất báo cáo Excel / CSV
                  </li>
                </ul>
              </div>
              <button
                onClick={() => navigate('/login')}
                className="mt-8 w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors"
              >
                Đăng nhập dùng thử
              </button>
            </div>

            {/* Business */}
            <div className="p-8 rounded-3xl bg-slate-900 border-2 border-blue-500/80 relative flex flex-col justify-between shadow-2xl shadow-blue-500/15">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-blue-600 text-white font-bold text-[10px] uppercase tracking-wider px-3.5 py-1 rounded-full">
                Phổ biến nhất
              </div>
              <div>
                <h3 className="text-xl font-bold text-white font-heading">Doanh Nghiệp (Pro)</h3>
                <p className="text-xs text-slate-400 mt-1">Dành cho công ty từ 30 - 200 nhân viên</p>
                <div className="my-6">
                  <span className="text-3xl font-extrabold text-white font-mono">3.800.000₫</span>
                  <span className="text-xs text-slate-500"> / tháng</span>
                </div>
                <ul className="space-y-3 text-xs text-slate-300">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-400" /> Không giới hạn nhân sự
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-400" /> Kết nối tới 06 Camera AI Edge
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-400" /> Sắp xếp ca xoay, ca gãy, tăng ca OT
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-400" /> Tự động tính lương & chốt kỳ
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-400" /> Cổng tự phục vụ cho nhân viên
                  </li>
                </ul>
              </div>
              <button
                onClick={() => navigate('/login')}
                className="mt-8 w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-500/25 transition-all"
              >
                Đăng nhập gói Doanh Nghiệp
              </button>
            </div>

            {/* Enterprise */}
            <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-colors shadow-xl">
              <div>
                <h3 className="text-xl font-bold text-white font-heading">Chuỗi & Nhà Máy</h3>
                <p className="text-xs text-slate-400 mt-1">Dành cho chuỗi bán lẻ, xưởng quy mô lớn</p>
                <div className="my-6">
                  <span className="text-3xl font-extrabold text-white font-mono">Liên hệ</span>
                  <span className="text-xs text-slate-500"> / gói giải pháp</span>
                </div>
                <ul className="space-y-3 text-xs text-slate-300">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-green-500" /> Tích hợp cổng Turnstile & Barie
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-green-500" /> Triển khai On-Premise hoặc Private Cloud
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-green-500" /> Tích hợp ERP (SAP, Oracle, Odoo)
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-green-500" /> SLA Hỗ trợ kỹ thuật 24/7 chuyên biệt
                  </li>
                </ul>
              </div>
              <button
                onClick={() => navigate('/login')}
                className="mt-8 w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors"
              >
                Đăng ký tư vấn giải pháp
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Trial Lead Bento Card */}
      <section className="py-20 px-6 max-w-4xl mx-auto w-full">
        <div className="p-8 sm:p-12 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl">
          <div className="text-center max-w-xl mx-auto mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-white font-heading tracking-tight">
              Đăng ký dùng thử miễn phí 30 ngày
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-2">
              Kỹ sư AIoT sẽ tư vấn cấu hình camera và hướng dẫn thiết lập hệ thống cho doanh nghiệp của bạn.
            </p>
          </div>

          {trialSubmitted ? (
            <div className="p-6 bg-slate-950 border border-green-500/30 rounded-2xl text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
              <h3 className="text-lg font-bold text-white font-heading">Đăng ký thành công!</h3>
              <p className="text-xs text-slate-400">
                Chuyên viên AIoT sẽ liên hệ với bạn qua email <strong>{trialEmail}</strong> trong vòng 2 giờ làm việc.
              </p>
            </div>
          ) : (
            <form onSubmit={handleTrialSubmit} className="space-y-4 max-w-lg mx-auto">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Họ và tên người đại diện</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Minh Anh"
                  value={trialName}
                  onChange={e => setTrialName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email doanh nghiệp</label>
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={trialEmail}
                  onChange={e => setTrialEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Tên công ty / Cơ sở</label>
                <input
                  type="text"
                  required
                  placeholder="Công ty Cổ phần Công nghệ AIoT..."
                  value={trialCompany}
                  onChange={e => setTrialCompany(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-500/25 transition-all"
              >
                Gửi thông tin đăng ký
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto py-10 px-6 border-t border-slate-800 bg-slate-950 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ScanFace className="w-5 h-5 text-blue-500" />
            <span className="font-heading font-bold text-slate-300">AIoT ATTENDANCE SYSTEM</span>
          </div>
          <p>© 2026 AIoT Enterprise System. Bản quyền thuộc về Giải pháp Chấm công Khuôn mặt Thông minh.</p>
          <div className="flex items-center gap-4">
            <span className="hover:text-slate-300 cursor-pointer">Điều khoản</span>
            <span className="hover:text-slate-300 cursor-pointer">Bảo mật</span>
            <span className="hover:text-slate-300 cursor-pointer">Hỗ trợ kỹ thuật</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
