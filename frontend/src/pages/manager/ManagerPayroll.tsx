import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Banknote,
  Lock,
  Unlock,
  Download,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Calendar,
  Sparkles,
  Edit,
  Check,
  DollarSign,
  Search,
  ChevronDown
} from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { PayrollRecord } from '../../types';
import { logger } from '../../utils/logger';

const payrollLogger = logger.child('ManagerPayroll');

export const ManagerPayroll: React.FC = () => {
  const {
    payroll,
    bonusPenalty,
    selectedPeriod,
    setSelectedPeriod,
    generatePayroll,
    updatePayrollItem,
    finalizePayrollPeriod,
    unlockPayrollPeriod,
    updateBonusPenalty,
    employees,
    showToast
  } = useApp();

  const [confirmFinalizeOpen, setConfirmFinalizeOpen] = useState(false);
  const [confirmUnlockOpen, setConfirmUnlockOpen] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');

  // Modal state for Bonus Penalty Policy
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [policyData, setPolicyData] = useState({
    overtime_rate: 100000,
    late_early_penalty: 50000,
    description: '',
  });

  const handleOpenPolicyModal = () => {
    setPolicyData({
      overtime_rate: bonusPenalty ? Number(bonusPenalty.overtime_rate) : 100000,
      late_early_penalty: bonusPenalty ? Number(bonusPenalty.late_early_penalty) : 50000,
      description: bonusPenalty?.description || '',
    });
    setIsPolicyModalOpen(true);
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateBonusPenalty(policyData);
    setIsPolicyModalOpen(false);
  };


  // Modal State for Editing a Payroll line item
  const [editingItem, setEditingItem] = useState<{
    record: PayrollRecord;
    empName: string;
    hourly_rate: number;
    working_hours: number;
    total_overtime: number;
    total_late_early: number;
    allowance: number;
  } | null>(null);

  // Dynamic periods generated from payroll records
  const availablePeriods = Array.from(new Set([
    ...payroll.map(p => p.period || p.payroll_period).filter(Boolean) as string[],
    selectedPeriod
  ])).sort().reverse();

  // All records for the selected period (for status & total metrics)
  const allPeriodRecords = payroll.filter(p => p.period === selectedPeriod || p.payroll_period === selectedPeriod);
  const isFinalized = allPeriodRecords.length > 0 && allPeriodRecords.every(p => p.status === 'FINALIZED');

  // Compute metrics
  const totalExpense = allPeriodRecords.reduce((sum, r) => sum + (r.net_salary || 0), 0);

  // Filter records by selected period, search term, and position/department
  const currentRecords = allPeriodRecords.filter(p => {
    const emp = employees.find(e => e.employee_id === p.employee_id);
    const dept = emp?.department || p.department || '';
    const pos = emp?.position || '';

    if (departmentFilter !== 'ALL' && dept !== departmentFilter && pos !== departmentFilter) {
      return false;
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchName = (emp?.full_name || p.employee_name || '').toLowerCase().includes(term);
      const matchId = (p.employee_id || '').toLowerCase().includes(term);
      const matchDept = dept.toLowerCase().includes(term);
      const matchPos = pos.toLowerCase().includes(term);
      if (!matchName && !matchId && !matchDept && !matchPos) return false;
    }

    return true;
  });

  const otRate = bonusPenalty ? Number(bonusPenalty.overtime_rate) : 1.5;
  const lateRate = bonusPenalty ? Number(bonusPenalty.late_early_penalty) : 50000;

  const handleOpenEdit = (record: PayrollRecord) => {
    const emp = employees.find(e => e.employee_id === record.employee_id);
    setEditingItem({
      record,
      empName: emp?.full_name || record.employee_name || record.employee_id,
      hourly_rate: record.hourly_rate || 100000,
      working_hours: record.total_working_hours || 176,
      total_overtime: record.total_overtime ?? 0,
      total_late_early: record.total_late_early ?? 0,
      allowance: record.allowance || 0,
    });
  };

  const handleConfirmEditSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    updatePayrollItem(editingItem.record.payroll_id, {
      hourly_rate: editingItem.hourly_rate,
      working_hours: editingItem.working_hours,
      total_overtime: editingItem.total_overtime,
      total_late_early: editingItem.total_late_early,
      allowance: editingItem.allowance,
    });

    showToast(`Đã lưu thay đổi bảng lương cho ${editingItem.empName}!`, 'success');
    setEditingItem(null);
  };

  const handleFinalizeConfirm = () => {
    finalizePayrollPeriod(selectedPeriod);
    setConfirmFinalizeOpen(false);
  };

  const handleUnlockConfirm = () => {
    unlockPayrollPeriod(selectedPeriod);
    setConfirmUnlockOpen(false);
  };

  const handleCalculatePayroll = async () => {
    try {
      setIsCalculating(true);
      await generatePayroll(selectedPeriod);
    } catch (error: any) {
      payrollLogger.error('Lỗi khi tính toán bảng lương:', error);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleExportCSV = () => {
    if (allPeriodRecords.length === 0) {
      showToast(`Kỳ ${selectedPeriod} chưa có dữ liệu bảng lương để xuất CSV!`, 'warning');
      return;
    }

    const headers = [
      'Mã NV',
      'Họ và Tên',
      'Kỳ Lương',
      'Lương Theo Giờ (VNĐ)',
      'Tổng Giờ Làm (h)',
      'Số Giờ Tăng Ca (h)',
      'Số Giờ Đi Trễ / Về Sớm (h)',
      'Phụ Cấp (VNĐ)',
      'Thực Lĩnh Net (VNĐ)',
      'Trạng Thái'
    ];

    const recordsToExport = currentRecords.length > 0 ? currentRecords : allPeriodRecords;
    const rows = recordsToExport.map(r => {
      const emp = employees.find(e => e.employee_id === r.employee_id);
      const name = emp?.full_name || r.employee_name || r.employee_id;
      const statusStr = r.status === 'FINALIZED' ? 'Đã Chốt' : 'Đang Soạn Thảo';

      return [
        r.employee_id,
        `"${name}"`,
        r.period || r.payroll_period || selectedPeriod,
        r.hourly_rate || 0,
        r.total_working_hours || 0,
        r.total_overtime ?? 0,
        r.total_late_early ?? 0,
        r.allowance || 0,
        r.net_salary || 0,
        `"${statusStr}"`
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Bang_luong_chi_tiet_ky_${selectedPeriod}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Đã xuất báo cáo bảng lương kỳ ${selectedPeriod} định dạng CSV!`, 'success');
  };

  return (
    <div className="space-y-6">
      {/* Bento Top Header with Continuous Shifting Gradient & Floating Blobs */}
      <div className="bento-hero-gradient rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-all">
        {/* Ambient Floating & Morphing Blurred Blobs */}
        <div className="absolute -top-14 -right-10 w-72 h-72 bg-gradient-to-br from-purple-500/30 to-fuchsia-500/25 dark:from-purple-600/35 dark:to-fuchsia-600/25 rounded-full blur-3xl pointer-events-none animate-blob-1" />
        <div className="absolute -bottom-16 left-1/4 w-64 h-64 bg-gradient-to-tr from-indigo-500/30 to-blue-500/20 dark:from-indigo-600/30 dark:to-blue-600/20 rounded-full blur-3xl pointer-events-none animate-blob-2" />
        <div className="absolute top-1/4 right-1/3 w-48 h-48 bg-gradient-to-r from-violet-400/25 to-pink-400/25 dark:from-violet-500/25 dark:to-pink-500/20 rounded-full blur-2xl pointer-events-none animate-blob-3" />

        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-heading tracking-tight">
              Quản Lý Bảng Lương & Chi Trả
            </h1>

            {/* Period Selector placed where yellow badge was */}
            <div className="flex items-center gap-2 bg-white/80 dark:bg-[#0f1224] px-3 py-1.5 rounded-xl border border-purple-200/80 dark:border-[#272d5a] shadow-inner backdrop-blur-sm">
              <Calendar className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Kỳ lương:</span>
              <select
                value={selectedPeriod}
                onChange={e => setSelectedPeriod(e.target.value)}
                className="bg-transparent text-xs text-slate-900 dark:text-white font-mono font-bold focus:outline-none cursor-pointer"
              >
                {availablePeriods.map(period => {
                  const [year, month] = period.split('-');
                  return (
                    <option key={period} value={period} className="bg-white dark:bg-[#13162b]">
                      Tháng {month}/{year}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </div>

        {/* 3 Action Buttons Right-Aligned */}
        <div className="relative z-10 flex flex-col items-start lg:items-end gap-2.5 shrink-0">
          {/* Row 1: Tự động tính lương & Chốt lương */}
          <div className="flex flex-wrap items-center justify-start lg:justify-end gap-2.5">
            {/* Calculate / Generate Payroll Button */}
            <button
              type="button"
              disabled={isCalculating || isFinalized}
              onClick={handleCalculatePayroll}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-purple-500/20 transition-all active:scale-95 cursor-pointer"
              title={isFinalized ? 'Bảng lương đã chốt sổ, hãy mở khóa để tính toán lại' : 'Tự động tính toán lại bảng lương từ dữ liệu chấm công mới nhất'}
            >
              <Sparkles className={`w-3.5 h-3.5 ${isCalculating ? 'animate-spin' : 'text-amber-300'}`} />
              <span>{isCalculating ? 'Đang tổng hợp...' : 'Tự động tính lương kỳ này'}</span>
            </button>

            {/* Action Button: Finalize or Unlock */}
            {isFinalized ? (
              <button
                type="button"
                onClick={() => setConfirmUnlockOpen(true)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1a1e3a] text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 border border-slate-200 dark:border-[#272d5a] transition-colors cursor-pointer shadow-xs"
              >
                <Unlock className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                <span>Mở khóa sửa bảng lương</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmFinalizeOpen(true)}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center gap-2 shadow-sm shadow-purple-500/20 transition-all cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Chốt lương kỳ này</span>
              </button>
            )}
          </div>

          {/* Row 2: Export CSV Button */}
          <div className="flex items-center justify-start lg:justify-end w-full">
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1a1e3a] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#272d5a] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Xuất bảng lương chi tiết sang file CSV/Excel"
            >
              <Download className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>Xuất Excel / CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3 Bento Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Card 1: Mức thưởng tăng ca */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] hover:border-purple-300 dark:hover:border-purple-800/40 transition-colors flex flex-col justify-between group relative shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Mức thưởng tăng ca</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleOpenPolicyModal}
                className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline font-medium cursor-pointer"
              >
                Thay đổi
              </button>
              <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
            </div>
          </div>
          <div className="pt-2 text-xl sm:text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
            {bonusPenalty?.overtime_rate ? (
              Number(bonusPenalty.overtime_rate) <= 10 ? (
                <span>{bonusPenalty.overtime_rate}x <span className="text-xs font-normal text-slate-500 dark:text-slate-400">lương giờ</span></span>
              ) : (
                <span>{Number(bonusPenalty.overtime_rate).toLocaleString('vi-VN')} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">₫/h</span></span>
              )
            ) : (
              <span>1.5x <span className="text-xs font-normal text-slate-500 dark:text-slate-400">lương giờ</span></span>
            )}
          </div>
        </div>

        {/* Card 2: Mức phạt đi trễ / về sớm */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] hover:border-purple-300 dark:hover:border-purple-800/40 transition-colors flex flex-col justify-between group relative shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Mức phạt đi trễ / về sớm</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleOpenPolicyModal}
                className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline font-medium cursor-pointer"
              >
                Thay đổi
              </button>
              <AlertCircle className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
            </div>
          </div>
          <div className="pt-2 text-xl sm:text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
            {bonusPenalty?.late_early_penalty ? (
              Number(bonusPenalty.late_early_penalty) <= 10 ? (
                <span>{bonusPenalty.late_early_penalty}x <span className="text-xs font-normal text-slate-500 dark:text-slate-400">lương giờ</span></span>
              ) : (
                <span>{Number(bonusPenalty.late_early_penalty).toLocaleString('vi-VN')} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">₫/h</span></span>
              )
            ) : (
              <span>50.000 <span className="text-xs font-normal text-slate-500 dark:text-slate-400">₫/h</span></span>
            )}
          </div>
        </div>

        {/* Card 3: Trạng thái kỳ lương */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] hover:border-purple-300 dark:hover:border-purple-800/40 transition-colors flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Trạng thái kỳ lương</span>
            {isFinalized ? (
              <Lock className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
            ) : (
              <Unlock className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
            )}
          </div>
          <div className="pt-1.5 pb-0.5 text-base sm:text-lg font-bold font-mono flex items-center gap-2 text-slate-900 dark:text-white">
            {isFinalized ? (
              <span className="text-emerald-600 dark:text-emerald-400">Đã niêm phong (Khóa)</span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400">Đang soạn thảo (Mở)</span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {allPeriodRecords.length} nhân sự • Tổng lương: <span className="font-mono text-purple-600 dark:text-purple-400 font-semibold">{totalExpense.toLocaleString('vi-VN')} ₫</span>
          </p>
        </div>
      </div>

      {/* Bento Table with Search & Position Filter */}
      <div className="rounded-2xl bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] overflow-hidden shadow-xs">
        <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-[#21264b] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white font-heading">
              Chi tiết bảng lương từng nhân sự - Kỳ {selectedPeriod}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Hiển thị {currentRecords.length} / {allPeriodRecords.length} nhân sự
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Search by Employee */}
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm tên, mã NV, chức vụ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Position / Department Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
                Chức vụ:
              </span>
              <div className="relative">
                <select
                  value={departmentFilter}
                  onChange={e => setDepartmentFilter(e.target.value)}
                  className="bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl pl-3 pr-8 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 appearance-none cursor-pointer"
                >
                  <option value="ALL" className="bg-white dark:bg-[#13162b]">Tất cả chức vụ</option>
                  <option value="Bảo vệ" className="bg-white dark:bg-[#13162b]">Bảo vệ</option>
                  <option value="Nhân viên" className="bg-white dark:bg-[#13162b]">Nhân viên</option>
                  <option value="Thu ngân" className="bg-white dark:bg-[#13162b]">Thu ngân</option>
                  <option value="Quản lý" className="bg-white dark:bg-[#13162b]">Quản lý</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-[#0f1224] border-b border-slate-200/80 dark:border-[#21264b] text-slate-500 dark:text-slate-400 uppercase font-mono text-[11px]">
              <tr>
                <th className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">Nhân sự</th>
                <th className="py-3.5 px-3 min-w-[130px] font-semibold text-slate-900 dark:text-white">Lương theo giờ</th>
                <th className="py-3.5 px-3 min-w-[100px] font-semibold text-slate-900 dark:text-white">Tổng giờ làm</th>
                <th className="py-3.5 px-3 min-w-[110px] font-semibold text-slate-900 dark:text-white">Số giờ tăng ca</th>
                <th className="py-3.5 px-3 min-w-[130px] font-semibold text-slate-900 dark:text-white">Số giờ đi trễ/về sớm</th>
                <th className="py-3.5 px-3 min-w-[110px] font-semibold text-slate-900 dark:text-white">Phụ cấp</th>
                <th className="py-3.5 px-4 min-w-[130px] font-semibold text-slate-900 dark:text-white">Thực lĩnh</th>
                <th className="py-3.5 px-4 text-right font-semibold text-slate-900 dark:text-white">Chỉnh sửa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1d2243] text-slate-700 dark:text-slate-300">
              {currentRecords.map(record => {
                const emp = employees.find(e => e.employee_id === record.employee_id);
                const hourlyRate = record.hourly_rate || 0;
                const netSalary = record.net_salary || 0;
                const totalWorkingHours = record.total_working_hours || 176;
                const totalOvertime = record.total_overtime ?? 0;
                const totalLateEarly = record.total_late_early ?? 0;
                const allowance = record.allowance || 0;

                return (
                  <tr key={record.payroll_id} className="hover:bg-slate-50/80 dark:hover:bg-[#1a1e3a]/40 transition-colors">
                    {/* 1. Nhân sự */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={emp?.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150'}
                          alt={emp?.full_name || record.employee_name || record.employee_id}
                          className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                        />
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white truncate">{emp?.full_name || record.employee_name || record.employee_id}</p>
                          <p className="text-[10px] font-mono text-purple-600 dark:text-purple-400">{record.employee_id}</p>
                        </div>
                      </div>
                    </td>

                    {/* 2. Lương theo giờ */}
                    <td className="py-3.5 px-3 font-mono text-slate-900 dark:text-white font-medium">
                      {hourlyRate.toLocaleString('vi-VN')} ₫
                    </td>

                    {/* 3. Tổng giờ làm */}
                    <td className="py-3.5 px-3 font-mono text-slate-700 dark:text-slate-200">
                      {totalWorkingHours}h
                    </td>

                    {/* 4. Số giờ tăng ca */}
                    <td className="py-3.5 px-3 font-mono">
                      {totalOvertime > 0 ? (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold font-mono">+{totalOvertime}h</span>
                      ) : (
                        <span className="text-slate-400">0h</span>
                      )}
                    </td>

                    {/* 5. Số giờ đi trễ/về sớm */}
                    <td className="py-3.5 px-3 font-mono">
                      {totalLateEarly > 0 ? (
                        <span className="text-rose-600 dark:text-rose-400 font-semibold font-mono">-{totalLateEarly}h</span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">0h</span>
                      )}
                    </td>

                    {/* 6. Phụ cấp */}
                    <td className="py-3.5 px-3 font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                      {allowance > 0 ? `+${allowance.toLocaleString('vi-VN')} ₫` : '0 ₫'}
                    </td>

                    {/* 7. Thực lĩnh */}
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white text-sm">
                      {netSalary.toLocaleString('vi-VN')} ₫
                    </td>

                    {/* 8. Chỉnh sửa */}
                    <td className="py-3.5 px-4 text-right">
                      {isFinalized ? (
                        <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">Đã khóa</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(record)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1a1e3a] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#272d5a] font-medium text-xs flex items-center gap-1.5 ml-auto transition-colors cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                          <span>Chỉnh sửa</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* EDIT MODAL: Modifying fields with live formula preview */}
      <Modal
        isOpen={!!editingItem}
        onClose={() => setEditingItem(null)}
        title="Chỉnh sửa chi tiết lương nhân viên"
        subtitle={`Nhân sự: ${editingItem?.empName} • Mã: ${editingItem?.record.employee_id} • Kỳ ${selectedPeriod}`}
        maxWidth="md"
      >
        {editingItem && (
          <form onSubmit={handleConfirmEditSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Lương theo giờ (VNĐ/h):
                </label>
                <input
                  type="number"
                  step="1000"
                  min="0"
                  required
                  value={editingItem.hourly_rate}
                  onChange={e => setEditingItem({ ...editingItem, hourly_rate: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tổng số giờ làm việc (h):
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  required
                  value={editingItem.working_hours}
                  onChange={e => setEditingItem({ ...editingItem, working_hours: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Số giờ tăng ca (h):
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={editingItem.total_overtime}
                  onChange={e => setEditingItem({ ...editingItem, total_overtime: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-amber-600 dark:text-amber-400 font-mono focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Số giờ đi trễ / về sớm (h):
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={editingItem.total_late_early}
                  onChange={e => setEditingItem({ ...editingItem, total_late_early: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-rose-600 dark:text-rose-400 font-mono focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Phụ cấp (VNĐ):
              </label>
              <input
                type="number"
                step="50000"
                min="0"
                value={editingItem.allowance}
                onChange={e => setEditingItem({ ...editingItem, allowance: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-emerald-600 dark:text-emerald-400 font-mono focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Live Net preview */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200/80 dark:border-[#21264b] space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px]">
                <span>Lương cơ bản: {(editingItem.hourly_rate * editingItem.working_hours).toLocaleString('vi-VN')} ₫</span>
                <span>Thưởng OT: {((otRate <= 10 ? editingItem.total_overtime * editingItem.hourly_rate * otRate : editingItem.total_overtime * otRate)).toLocaleString('vi-VN')} ₫</span>
              </div>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px]">
                <span>Phạt đi trễ: -{((lateRate <= 10 ? editingItem.total_late_early * editingItem.hourly_rate * lateRate : editingItem.total_late_early * lateRate)).toLocaleString('vi-VN')} ₫</span>
                <span>Phụ cấp: +{editingItem.allowance.toLocaleString('vi-VN')} ₫</span>
              </div>
              <div className="border-t border-slate-200 dark:border-[#21264b] pt-1.5 flex items-center justify-between">
                <span className="text-slate-700 dark:text-slate-300 font-medium">Lương thực lĩnh (Net):</span>
                <span className="font-mono text-base font-bold text-slate-900 dark:text-white">
                  {Math.max(
                    0,
                    Math.round(
                      editingItem.hourly_rate * editingItem.working_hours +
                      (otRate <= 10 ? editingItem.total_overtime * editingItem.hourly_rate * otRate : editingItem.total_overtime * otRate) -
                      (lateRate <= 10 ? editingItem.total_late_early * editingItem.hourly_rate * lateRate : editingItem.total_late_early * lateRate) +
                      editingItem.allowance
                    )
                  ).toLocaleString('vi-VN')} ₫
                </span>
              </div>
            </div>

            {/* Explicit Confirm Button */}
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 rounded-xl text-xs text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1a1e3a] border border-slate-200 dark:border-[#272d5a] cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-sm shadow-purple-500/20 flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Xác nhận cập nhật bảng lương</span>
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Confirmation Modal: Finalize */}
      <Modal
        isOpen={confirmFinalizeOpen}
        onClose={() => setConfirmFinalizeOpen(false)}
        title="Xác nhận chốt bảng lương kỳ này?"
        subtitle={`Kỳ quyết toán: Tháng ${selectedPeriod}`}
      >
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <p className="font-bold">Lưu ý bảo mật:</p>
              <p className="mt-1 text-slate-600 dark:text-slate-300">
                Sau khi chốt sổ, toàn bộ dữ liệu lương sẽ được khóa (read-only), nhân viên có thể xem phiếu lương chi tiết và kế toán sẽ tiến hành giải ngân qua ngân hàng.
              </p>
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-[#0f1224] rounded-xl border border-slate-200 dark:border-[#272d5a] text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Tổng ngân sách chi trả:</span>
              <span className="font-mono text-slate-900 dark:text-white font-bold">{totalExpense.toLocaleString('vi-VN')} ₫</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Số lượng nhân viên:</span>
              <span className="font-mono text-slate-900 dark:text-white">{currentRecords.length} người</span>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmFinalizeOpen(false)}
              className="px-4 py-2 rounded-xl text-xs text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1a1e3a] border border-slate-200 dark:border-[#272d5a] cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleFinalizeConfirm}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-sm shadow-purple-500/20 cursor-pointer"
            >
              Đồng ý chốt bảng lương
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Modal: Unlock */}
      <Modal
        isOpen={confirmUnlockOpen}
        onClose={() => setConfirmUnlockOpen(false)}
        title="Mở khóa chỉnh sửa bảng lương?"
        subtitle={`Kỳ quyết toán: Tháng ${selectedPeriod}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Bạn đang yêu cầu mở khóa bảng lương kỳ <strong>{selectedPeriod}</strong>. Trạng thái sẽ được chuyển về <strong>ĐANG SOẠN THẢO</strong> để cho phép chỉnh sửa số liệu.
          </p>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmUnlockOpen(false)}
              className="px-4 py-2 rounded-xl text-xs text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1a1e3a] border border-slate-200 dark:border-[#272d5a] cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleUnlockConfirm}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-sm shadow-amber-500/20 cursor-pointer"
            >
              Mở khóa chỉnh sửa
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Edit Bonus / Penalty Policy */}
      <Modal
        isOpen={isPolicyModalOpen}
        onClose={() => setIsPolicyModalOpen(false)}
        title="Thay đổi quy định Thưởng / Phạt"
        subtitle="Thiết lập hệ số tăng ca (OT) và định mức vi phạm đi trễ / về sớm"
      >
        <form onSubmit={handleSavePolicy} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-700 dark:text-slate-400 font-medium mb-1">Mức thưởng OT (Hệ số x hoặc ₫/h)</label>
            <input
              type="number"
              step="any"
              value={policyData.overtime_rate}
              onChange={(e) => setPolicyData(p => ({ ...p, overtime_rate: parseFloat(e.target.value) || 0 }))}
              className="w-full bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-mono"
              placeholder="Ví dụ: 1.5 (gấp 1.5x) hoặc 100000 (100.000 ₫/h)"
              required
            />
            <p className="text-[11px] text-slate-500 mt-1">Nhập ≤ 10 nếu là hệ số nhân lương giờ (VD: 1.5x), nhập &gt; 10 nếu là số tiền ₫/h (VD: 100000 ₫/h).</p>
          </div>

          <div>
            <label className="block text-xs text-slate-700 dark:text-slate-400 font-medium mb-1">Mức phạt đi trễ / về sớm (Hệ số x hoặc ₫/h)</label>
            <input
              type="number"
              step="any"
              value={policyData.late_early_penalty}
              onChange={(e) => setPolicyData(p => ({ ...p, late_early_penalty: parseFloat(e.target.value) || 0 }))}
              className="w-full bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-mono"
              placeholder="Ví dụ: 50000 (50.000 ₫/h)"
              required
            />
            <p className="text-[11px] text-slate-500 mt-1">Nhập ≤ 10 nếu là hệ số khấu trừ lương giờ, nhập &gt; 10 nếu là số tiền phạt ₫/h.</p>
          </div>

          <div>
            <label className="block text-xs text-slate-700 dark:text-slate-400 font-medium mb-1">Ghi chú / Mô tả quy định</label>
            <textarea
              rows={2}
              value={policyData.description}
              onChange={(e) => setPolicyData(p => ({ ...p, description: e.target.value }))}
              className="w-full bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
              placeholder="Mô tả chính sách áp dụng..."
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsPolicyModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1a1e3a] border border-slate-200 dark:border-[#272d5a] cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-sm shadow-purple-500/20 cursor-pointer"
            >
              Lưu thay đổi quy định
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};