import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, Clock } from 'lucide-react';
import { useAuth } from '@/features/auth';
import { useEmployeeContext } from '@/features/employees';
import { useShiftContext } from '@/features/schedules';
import { PageHeaderBanner } from '../../components/common';
import { getTodayVNString } from '../../utils/dateUtils';
import { shiftNames, shortDate } from './employeePresentation';
import { ScheduleShiftBadge } from '../../features/schedules';

// Calendar arithmetic uses UTC dates so the browser timezone cannot move a work date.
function moveDate(date: string, days: number) { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
function monday(date: string) { return moveDate(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7)); }

export const EmployeeSchedule: React.FC = () => {
  const { currentUser } = useAuth();
  const { employees } = useEmployeeContext();
  const { workShifts, isLoading, isError, refetchShifts } = useShiftContext();
  const today = getTodayVNString();
  const [selected, setSelected] = useState(today);
  const [view, setView] = useState<'week' | 'month'>('week');
  const calendarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = calendarRef.current;
    const day = container?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    if (container && day) container.scrollLeft += day.getBoundingClientRect().left - container.getBoundingClientRect().left - (container.clientWidth - day.clientWidth) / 2;
  }, [selected, view, isLoading]);
  const employeeId = currentUser?.employee_id;
  const employee = employeeId ? employees.find(e => e.employee_id === employeeId || e.id === employeeId) : undefined;
  const ownShifts = workShifts.filter(s => !!employeeId && (s.employee_id === employeeId || s.employee_id === employee?.id));
  const start = view === 'week' ? monday(selected) : monday(`${selected.slice(0, 7)}-01`);
  const days = Array.from({ length: view === 'week' ? 7 : 42 }, (_, i) => moveDate(start, i));
  const inPeriod = ownShifts.filter(s => view === 'week' ? s.date >= days[0] && s.date <= days[6] : s.date.slice(0, 7) === selected.slice(0, 7));
  const selectedShifts = ownShifts.filter(s => s.date === selected);
  const navigate = (direction: number) => {
    if (view === 'week') setSelected(moveDate(selected, direction * 7));
    else { const date = new Date(`${selected.slice(0, 7)}-01T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() + direction); setSelected(date.toISOString().slice(0, 10)); }
  };
  return <div className="sf-employee-page space-y-6">
    <PageHeaderBanner icon={<span className="sf-employee-title-icon"><CalendarDays size={22}/></span>} title="Lịch làm việc" actions={
      <div className="sf-employee-schedule-actions">
        <div className="sf-employee-view-switch" aria-label="Chế độ lịch">{(['week', 'month'] as const).map(mode => <button key={mode} className="sf-button" aria-pressed={view === mode} onClick={() => setView(mode)}>{mode === 'week' ? 'Tuần' : 'Tháng'}</button>)}</div>
        <div className="sf-employee-period-nav"><button className="sf-icon-button" aria-label={view === 'week' ? 'Tuần trước' : 'Tháng trước'} onClick={() => navigate(-1)}><ChevronLeft size={19}/></button><span className="font-semibold tabular-nums">{view === 'week' ? `${shortDate(days[0])} – ${shortDate(days[6])} / ${days[6].slice(0, 4)}` : selected.slice(0, 7).split('-').reverse().join('/')}</span><button className="sf-icon-button" aria-label={view === 'week' ? 'Tuần sau' : 'Tháng sau'} onClick={() => navigate(1)}><ChevronRight size={19}/></button></div>
        <button className="sf-button" onClick={() => setSelected(today)}>Hôm nay</button>
      </div>
    }/>
    {isLoading ? <p role="status">Đang tải lịch làm việc…</p> : isError ? <p className="sf-feedback error" role="alert">Không tải được lịch làm việc. <button className="underline" onClick={refetchShifts}>Thử lại</button></p> : <>
      <p className="sf-secondary">Số ca được phân: <strong>{inPeriod.filter(s => s.shift_type !== 'OFF').length} ca</strong></p>
      <div ref={calendarRef} className="sf-employee-calendar-scroll" tabIndex={0} role="region" aria-label="Lịch phân ca, cuộn ngang để xem đủ các ngày"><div className={`sf-employee-calendar ${view === 'month' ? 'is-month' : ''}`}>{days.map((date, index) => {
        const shifts = ownShifts.filter(s => s.date === date);
        return <button key={date} className={`sf-employee-day ${date === selected ? 'selected' : ''} ${date === today ? 'today' : ''} ${view === 'month' && date.slice(0, 7) !== selected.slice(0, 7) ? 'outside' : ''}`} aria-pressed={date === selected} onClick={() => setSelected(date)}><span className="sf-employee-day-heading"><span className="font-semibold">{['THỨ 2', 'THỨ 3', 'THỨ 4', 'THỨ 5', 'THỨ 6', 'THỨ 7', 'CHỦ NHẬT'][index % 7]}</span><time dateTime={date} className="sf-secondary">{shortDate(date)}</time></span>{shifts.length ? shifts.map(shift => <span className="sf-employee-shift-slot" key={shift.shift_id}><ScheduleShiftBadge shift={shift} isPast={date < today}/></span>) : <span className="sf-secondary mt-3">Chưa phân ca</span>}</button>;
      })}</div></div>
      <section className="sf-panel p-5 space-y-4"><h2 className="font-semibold flex items-center gap-2"><CalendarDays size={19}/>Chi tiết {shortDate(selected)}/{selected.slice(0, 4)}</h2>{selectedShifts.length ? selectedShifts.map(shift => <div key={shift.shift_id} className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-medium">{shiftNames[shift.shift_type]}</h3>{shift.note && <p className="sf-secondary mt-1">{shift.note}</p>}</div>{shift.shift_type !== 'OFF' && <p className="inline-flex items-center gap-2"><Clock size={17}/>{shift.start_time || '—'} – {shift.end_time || '—'}</p>}</div>) : <p className="sf-secondary">Chưa có ca làm việc được phân công.</p>}</section>
    </>}
  </div>;
};
