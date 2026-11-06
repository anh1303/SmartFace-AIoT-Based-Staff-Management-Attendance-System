import React, { useState } from 'react';
import { Wallet } from 'lucide-react';
import { FilterSelect, PageHeaderBanner } from '../../components/common';
import { useApp } from '../../context/AppContext';
import { PayslipBreakdown } from '../../features/payrolls/components/PayslipBreakdown';
import { getTodayVNString } from '../../utils/dateUtils';
import { money, quantity } from './employeePresentation';

export const EmployeeSalaryEstimate: React.FC = () => {
  const { currentUser, payroll, employees, isLoadingPayroll, payrollError } = useApp();
  const employeeId = currentUser?.employee_id;
  const employee = employeeId ? employees.find(e => e.employee_id === employeeId || e.id === employeeId) : undefined;
  const myPayrolls = employeeId ? payroll.filter(p => p.employee_id === employeeId || p.employee_id === employee?.id) : [];
  const currentPeriod = getTodayVNString().slice(0, 7);
  const [selectedPeriod, setSelectedPeriod] = useState(currentPeriod);
  const record = myPayrolls.find(p => (p.period || p.payroll_period) === selectedPeriod);
  const periods = Array.from(new Set([currentPeriod, ...myPayrolls.map(p => p.period || p.payroll_period).filter(Boolean) as string[]])).sort().reverse();
  const statuses = { PENDING: 'Chờ duyệt', CONFIRMED: 'Đã xác nhận', FINALIZED: 'Đã chốt', PAID: 'Đã thanh toán' };
  return <div className="sf-employee-page space-y-7">
    <PageHeaderBanner icon={<span className="sf-employee-title-icon"><Wallet size={22}/></span>} title="Bảng lương" actions={<FilterSelect label="Kỳ lương:" value={selectedPeriod} onChange={setSelectedPeriod} widthClass="w-[180px]" options={periods.map(period => ({ value: period, label: `Tháng ${period.split('-').reverse().join('/')}` }))}/>}/>
    {isLoadingPayroll ? <p className="sf-empty" role="status">Đang tải bảng lương…</p> : payrollError ? <p className="sf-feedback error" role="alert">Không thể tải bảng lương: {payrollError.message}</p> : <>
      <section className="py-3"><h2 className="sf-secondary uppercase text-sm">Thực lĩnh tạm tính</h2><p className="text-3xl font-semibold sf-money mt-3">{money(record?.net_salary)}</p><div className="flex items-center gap-3 mt-3">{record && <span className="sf-badge">{statuses[record.status]}</span>}<span className="sf-secondary">Kỳ {selectedPeriod.split('-').reverse().join('/')}</span></div></section>
      <div className="grid grid-cols-2 gap-4"><section className="sf-panel p-4"><h2 className="sf-secondary">Giờ công</h2><p className="text-xl font-semibold mt-2">{quantity(record?.total_working_hours ?? record?.working_hours, 'giờ')}</p></section><section className="sf-panel p-4"><h2 className="sf-secondary">Đơn giá giờ</h2><p className="text-xl font-semibold mt-2">{money(record?.hourly_rate)}</p></section></div>
      <section><h2 className="text-lg font-semibold mb-3">Chi tiết thu nhập</h2>{record ? <PayslipBreakdown record={record}/> : <p className="sf-empty">Chưa có dữ liệu bảng lương kỳ này.</p>}</section>
    </>}
  </div>;
};
