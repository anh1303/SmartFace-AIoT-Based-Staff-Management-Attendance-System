import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, CalendarClock, CalendarCheck, Clock, LayoutDashboard, ScanFace, Timer, UserX, Wallet } from 'lucide-react';
import { PageHeaderBanner } from '../../components/common';
import { useApp } from '../../context/AppContext';
import { useShiftContext } from '../../context/ShiftContext';
import { api } from '../../api/client';
import type { NotificationItem } from '../../features/notifications';
import { useEmployeeOverview } from '../../features/attendances/hooks/useEmployeeOverview';
import { getTodayVNString, formatVNTime } from '../../utils/dateUtils';
import { money, quantity, shiftNames } from './employeePresentation';

export const EmployeeDashboard: React.FC = () => {
  const { currentUser, employees, payroll, isLoadingPayroll, payrollError } = useApp();
  const shifts = useShiftContext();
  const employeeId = currentUser?.employee_id;
  const employee = employeeId ? employees.find(e => e.employee_id === employeeId || e.id === employeeId) : undefined;
  const overview = useEmployeeOverview(employeeId);
  const notifications = useQuery({
    queryKey: ['employeeNotifications', employeeId], enabled: !!employeeId,
    queryFn: async () => {
      const res = await api.get<NotificationItem[]>('/api/notifications');
      if (!res.success || !Array.isArray(res.data)) throw new Error(res.message || 'Không tải được thông báo');
      return res.data;
    }, refetchInterval: 30000,
  });
  const data = overview.data;
  const today = data?.through_date || getTodayVNString();
  const period = today.slice(0, 7);
  const own = (id: string) => !!employeeId && (id === employeeId || id === employee?.id);
  const todayShifts = shifts.workShifts.filter(s => own(s.employee_id) && s.date === today);
  const payslip = payroll.find(p => own(p.employee_id) && (p.period || p.payroll_period) === period);
  const day = data?.today[0];
  const loading = overview.isPending && overview.fetchStatus !== 'idle';
  const total = (value: number | null | undefined, unit: string) => loading ? 'Đang tải…' : overview.isError ? '—' : quantity(value, unit);
  const metrics = [
    { title: 'Ca làm hôm nay', icon: CalendarClock, value: shifts.isLoading ? 'Đang tải…' : shifts.isError ? '—' : todayShifts.length ? todayShifts.map(s => shiftNames[s.shift_type]).join(', ') : 'Chưa phân ca', detail: todayShifts.length ? todayShifts.map(s => s.shift_type === 'OFF' ? 'Nghỉ ca' : `${s.start_time || '—'} – ${s.end_time || '—'}`).join(' · ') : 'Chưa có lịch làm việc' },
    { title: 'Chấm công hôm nay', icon: ScanFace, value: loading ? 'Đang tải…' : overview.isError ? '—' : day ? `${day.first_check_in ? formatVNTime(day.first_check_in, false) : '—'} / ${day.last_check_out ? formatVNTime(day.last_check_out, false) : '—'}` : 'Chưa ghi nhận', detail: day ? `Vào / ra · Trễ / về sớm: ${quantity(day.late_early, 'giờ')}` : 'Chưa có lượt quẹt hôm nay' },
    { title: 'Giờ tăng ca', icon: Timer, value: total(data?.overtime_hours, 'giờ'), detail: 'Tổng giờ tăng ca đã duyệt trong tháng đến hôm nay' },
    { title: 'Giờ đi trễ / về sớm', icon: Clock, value: total(data?.late_early_hours, 'giờ'), detail: 'Tổng giờ trễ / về sớm trong tháng đến hôm nay' },
    { title: 'Nghỉ làm không lý do', icon: UserX, value: total(data?.absent_days, 'ngày'), detail: 'Số ngày vắng được ghi nhận trong tháng đến hôm nay' },
    { title: 'Công tháng này', icon: CalendarCheck, value: total(data?.work_days, 'ngày'), detail: `Ngày công được ghi nhận · ${period.split('-').reverse().join('/')}` },
    { title: 'Lương tạm tính', icon: Wallet, value: isLoadingPayroll ? 'Đang tải…' : payrollError ? '—' : money(payslip?.net_salary), detail: payslip ? `Kỳ ${period.split('-').reverse().join('/')} · Theo phiếu lương đã lưu` : 'Chưa có dữ liệu lương kỳ hiện tại' },
  ];
  return <div className="sf-employee-page space-y-7">
    <PageHeaderBanner icon={<span className="sf-employee-title-icon"><LayoutDashboard size={22}/></span>} title={`Xin chào, ${currentUser?.full_name || 'bạn'} 👋`} actions={<p className="sf-secondary">{new Date(`${today}T12:00:00+07:00`).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })} · Nhân viên {employeeId || '—'}</p>}/>
    {(overview.isError || shifts.isError || payrollError) && <p role="alert" className="sf-feedback error">Không tải đủ dữ liệu tổng quan. <button className="underline" onClick={() => { void overview.refetch(); shifts.refetchShifts(); }}>Thử tải lại công và lịch</button>{payrollError && <span> · Không tải được bảng lương.</span>}</p>}
    <div className="sf-employee-overview">{metrics.map(({ title, icon: Icon, value, detail }) => <section className="sf-employee-metric" key={title}><h2><Icon size={19} aria-hidden="true"/>{title}</h2><p className="sf-employee-value">{value}</p><p className="sf-secondary">{detail}</p></section>)}
      <section className="sf-employee-metric sf-employee-notification-panel"><h2><Bell size={19} aria-hidden="true"/>Thông báo</h2>{notifications.isPending && employeeId ? <p role="status" className="mt-4">Đang tải…</p> : notifications.isError ? <p role="alert" className="mt-4">Không tải được thông báo. <button className="underline" onClick={() => void notifications.refetch()}>Thử lại</button></p> : notifications.data?.length ? <ul className="sf-employee-notifications" tabIndex={0} aria-label="Danh sách thông báo">{notifications.data.map(item => <li key={item.id}><strong>{item.title}</strong><p className="sf-secondary">{item.message}</p><time className="sf-secondary" dateTime={item.timestamp}>{new Date(item.timestamp).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</time></li>)}</ul> : <p className="sf-secondary mt-4">Không có thông báo.</p>}</section>
    </div>
  </div>;
};
