import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PageHeaderBanner } from '../../components/common';
import { PayslipBreakdown } from '../../features/payrolls/components/PayslipBreakdown';
import { formatPayrollRateLabel } from '../../utils/payrollUtils';

export const EmployeeSalaryEstimate: React.FC = () => {
  const { currentUser, payroll, employees, isLoadingPayroll, payrollError } = useApp();
  const employeeCode = currentUser?.employee_id;
  const employee = employees.find(e => e.employee_id === employeeCode || e.id === employeeCode);
  const myPayrolls = employeeCode ? payroll.filter(p => p.employee_id === employeeCode || p.employee_id === employee?.id) : [];
  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedPeriod, setSelectedPeriod] = useState(currentPeriod);
  const record = myPayrolls.find(p => (p.period || p.payroll_period) === selectedPeriod) ?? null;
  const periods = Array.from(new Set([currentPeriod, selectedPeriod, ...myPayrolls.map(p => p.period || p.payroll_period).filter(Boolean) as string[]])).sort().reverse();
  const statuses = { PENDING: 'Chờ duyệt', CONFIRMED: 'Đã xác nhận', FINALIZED: 'Đã chốt', PAID: 'Đã thanh toán' };

  return <div className="space-y-6">
    <PageHeaderBanner title="Lương theo kỳ" subtitle="Thu nhập và các khoản đã được hệ thống tính cho đúng kỳ lương." actions={
      <label className="sf-field">Kỳ lương<select className="sf-input" value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)}>
        {periods.map(period => <option key={period} value={period}>{period}</option>)}
      </select></label>
    }/>
    {isLoadingPayroll ? <p className="sf-empty" role="status">Đang tải bảng lương…</p>
      : payrollError ? <p className="sf-feedback error" role="alert">Không thể tải bảng lương: {payrollError.message}</p>
      : !record ? <div className="sf-empty"><p className="font-semibold">Chưa tính lương kỳ {selectedPeriod}</p><p className="sf-secondary">Kết quả sẽ hiển thị sau khi kỳ lương được tính.</p></div>
      : <section className="sf-panel p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Phiếu lương kỳ {selectedPeriod}</h2><span className="sf-badge">{statuses[record.status]}</span></div>
        <dl className="grid sm:grid-cols-2 gap-4 text-sm">
          <div><dt className="text-slate-500">Giờ công đã ghi</dt><dd>{record.total_working_hours ?? record.working_hours ?? 0} giờ</dd></div>
          <div><dt className="text-slate-500">Đơn giá giờ trên phiếu</dt><dd>{Number(record.hourly_rate).toLocaleString('vi-VN')} ₫/h</dd></div>
          <div><dt className="text-slate-500">Hệ số OT trên phiếu</dt><dd>{record.overtime_rate != null ? formatPayrollRateLabel(Number(record.overtime_rate), Number(record.hourly_rate)) : 'Chưa có hệ số xác định'}</dd></div>
          <div><dt className="text-slate-500">Hệ số phạt trên phiếu</dt><dd>{record.late_penalty_rate != null ? formatPayrollRateLabel(Number(record.late_penalty_rate), Number(record.hourly_rate)) : 'Chưa có hệ số xác định'}</dd></div>
        </dl>
        <PayslipBreakdown record={record}/>
      </section>}
  </div>;
};
