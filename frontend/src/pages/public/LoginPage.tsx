import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { 
  ScanFace, 
  ShieldCheck, 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  CheckCircle2
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useApp();
  const [emailOrId, setEmailOrId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!emailOrId.trim()) {
      setErrorMsg('Vui lòng nhập Email, Username hoặc Mã nhân viên');
      return;
    }

    if (!password) {
      setErrorMsg('Vui lòng nhập mật khẩu');
      return;
    }

    setLoading(true);
    const res = await login(emailOrId, password);
    setLoading(false);

    if (res.success && res.role) {
      navigate(res.role === 'manager' ? '/app/manager/dashboard' : '/app/employee/dashboard');
    } else {
      setErrorMsg(res.message || 'Xác thực thất bại. Vui lòng kiểm tra lại tài khoản hoặc mật khẩu.');
    }
  };



  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans">
      <div className="w-full max-w-4xl bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden grid lg:grid-cols-12">
        {/* Left Visual Bento Panel */}
        <div className="lg:col-span-5 bg-slate-950 p-8 sm:p-10 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800 relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none" />

          {/* Brand Top */}
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                <ScanFace className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-heading font-extrabold text-white text-lg tracking-wider">
                  AIoT ATTENDANCE
                </h1>
              </div>
            </div>

            <div className="mt-8 space-y-3">
              <h2 className="text-2xl font-bold text-white font-heading leading-snug tracking-tight">
                Hệ thống chấm công & quản trị sinh trắc học AIoT
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Nhận diện khuôn mặt và vân tay phân tán tại các Edge Devices với mã hóa chuẩn AES-256, tự động đồng bộ thời gian thực.
              </p>
            </div>
          </div>

          {/* Key bullets */}
          <div className="relative z-10 py-6 space-y-3">
            <div className="flex items-center gap-2.5 text-xs text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
              <span>Chấm công thời gian thực qua 12 Edge AI Cams</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
              <span>Cập nhật sinh trắc học & gửi tín hiệu IoT FAP30</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
              <span>Quản lý lịch làm, bảng lương & báo cáo minh bạch</span>
            </div>
          </div>

          {/* Security badge */}
          <div className="relative z-10 pt-4 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500 font-mono">
            <span>EDGE NODE 01 • ACTIVE</span>
            <span className="text-green-500 flex items-center gap-1 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" /> TLS 1.3 SECURE
            </span>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="lg:col-span-7 p-8 sm:p-12 flex flex-col justify-center bg-slate-900">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white font-heading tracking-tight">Đăng nhập tài khoản</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Nhập thông tin xác thực để truy cập vào hệ thống
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                Về trang chủ
              </button>
            </div>

            {/* Error feedback if any */}
            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <span className="font-semibold">⚠️</span>
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Standard Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Email, Username hoặc Mã nhân viên
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={emailOrId}
                    onChange={e => setEmailOrId(e.target.value)}
                    placeholder="Ví dụ: manager@company.com, admin, hoặc NV-001"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Mật khẩu
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0"
                  />
                  <span>Ghi nhớ phiên đăng nhập</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <span>Đang xác thực với máy chủ...</span>
                ) : (
                  <>
                    <span>Xác thực & Đăng nhập hệ thống</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
