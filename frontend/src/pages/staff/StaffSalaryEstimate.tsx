import React from 'react';
import { useApp } from '../../context/AppContext';
import { 
  DollarSign, 
  Calendar, 
  TrendingUp, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  Clock,
  Briefcase
} from 'lucide-react';

export const StaffSalaryEstimate: React.FC = () => {
  const { currentUser } = useApp();

  return (
    <div className="space-y-6">
      {/* Bento Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white font-heading tracking-tight">
              Lương Tạm Tính (Tháng 09/2026)
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-mono font-medium border border-amber-500/20">
              ĐANG TÍCH LŨY CÔNG
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Số liệu tự động đồng bộ từ giờ quẹt thẻ/nhận diện khuôn mặt tính đến 10/09/2026.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-blue-400 text-xs font-mono">
          <ShieldCheck className="w-4 h-4 text-green-500" />
          <span>CHỈ ĐỌC • MINH BẠCH 100%</span>
        </div>
      </div>

      {/* Hero Bento Salary Metric Card */}
      <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="relative z-10 grid md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-7 space-y-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Ước tính thực lĩnh đến hiện tại (Net)
            </span>
            <div className="text-4xl sm:text-5xl font-extrabold font-mono text-white tracking-tight">
              18.450.000 <span className="text-2xl text-blue-400 font-normal">₫</span>
            </div>
            <p className="text-xs text-slate-400">
              Dựa trên <strong>19 ngày công</strong> đã hoàn thành + <strong>4.0 giờ làm thêm OT</strong> được duyệt.
            </p>
          </div>

          <div className="md:col-span-5 bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 font-medium">Tiến độ ngày công tháng</span>
              <span className="font-mono text-blue-400 font-bold">19 / 22 ngày (86%)</span>
            </div>
            <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800">
              <div
                className="bg-blue-600 h-full rounded-full"
                style={{ width: '86%' }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
              <span>Bắt đầu: 01/09</span>
              <span>Kỳ chốt: 30/09</span>
            </div>
          </div>
        </div>
      </div>

      {/* Breakdown Details Grid */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Earnings Breakdown */}
        <div className="lg:col-span-7 p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
          <h2 className="text-base font-bold text-white font-heading">
            Chi tiết các khoản thu nhập (Earnings)
          </h2>

          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-white">Lương cơ bản theo hợp đồng</p>
                <p className="text-[11px] text-slate-400">Khung ngạch Senior AI Engineer</p>
              </div>
              <span className="font-mono text-xs font-bold text-white">22.000.000 ₫</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-white">Lương công nhật lũy kế (19 ngày)</p>
                <p className="text-[11px] text-slate-400">22.000.000 ÷ 22 × 19</p>
              </div>
              <span className="font-mono text-xs font-bold text-blue-400">19.000.000 ₫</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-white">Phụ cấp ăn trưa & xăng xe</p>
                <p className="text-[11px] text-slate-400">Cố định hàng tháng</p>
              </div>
              <span className="font-mono text-xs font-bold text-green-500">+ 1.500.000 ₫</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-white">Làm thêm giờ (OT) tuần 36 & 37</p>
                <p className="text-[11px] text-slate-400">4 giờ × 150% hệ số</p>
              </div>
              <span className="font-mono text-xs font-bold text-amber-400">+ 750.000 ₫</span>
            </div>
          </div>
        </div>

        {/* Deductions Breakdown */}
        <div className="lg:col-span-5 p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
          <h2 className="text-base font-bold text-white font-heading">
            Các khoản khấu trừ luật định
          </h2>

          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-white">Bảo hiểm Xã hội (BHXH 8%)</p>
                <p className="text-[11px] text-slate-400">Trích lương người lao động</p>
              </div>
              <span className="font-mono text-xs font-bold text-red-400">- 1.200.000 ₫</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-white">Bảo hiểm Y tế (BHYT 1.5%)</p>
                <p className="text-[11px] text-slate-400">BHYT bắt buộc</p>
              </div>
              <span className="font-mono text-xs font-bold text-red-400">- 225.000 ₫</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-white">Bảo hiểm Thất nghiệp (BHTN 1%)</p>
                <p className="text-[11px] text-slate-400">BHTN nhà nước</p>
              </div>
              <span className="font-mono text-xs font-bold text-red-400">- 150.000 ₫</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-white">Phạt vi phạm đi muộn</p>
                <p className="text-[11px] text-slate-400">0 lần vi phạm trong kỳ</p>
              </div>
              <span className="font-mono text-xs font-bold text-green-500">0 ₫</span>
            </div>
          </div>

          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-slate-400">
            <span className="font-bold text-blue-400">Ghi chú:</span> Số tiền thực nhận sẽ được chuyển khoản qua tài khoản ngân hàng liên kết vào ngày 05 tháng kế tiếp.
          </div>
        </div>
      </div>
    </div>
  );
};
