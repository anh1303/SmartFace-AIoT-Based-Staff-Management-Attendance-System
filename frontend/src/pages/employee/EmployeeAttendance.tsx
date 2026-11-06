import React, { useState } from 'react';
import { Clock } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { EmployeeAttendanceTab } from '../../features/employees/components/EmployeeAttendanceTab';
import { PageHeaderBanner } from '../../components/common';
import { getTodayVNString } from '../../utils/dateUtils';
import type { Employee } from '../../types';

export const EmployeeAttendance: React.FC = () => {
  const { currentUser, employees } = useApp();
  const [params] = useSearchParams();
  const today = getTodayVNString();
  const [startDate, setStartDate] = useState(params.get('date') || `${today.slice(0, 7)}-01`);
  const [endDate, setEndDate] = useState(params.get('date') || today);
  const [quickPreset, setQuickPreset] = useState<'today' | 'month' | 'all' | 'custom'>(params.get('date') ? 'custom' : 'month');
  const [attendanceTypeFilter, setAttendanceTypeFilter] = useState('ALL');
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState('ALL');
  const employeeId = currentUser?.employee_id;
  // The authenticated employee code is sufficient for scoped read queries while the profile loads.
  const employee = employeeId ? employees.find(e => e.employee_id === employeeId || e.id === employeeId) || { employee_id: employeeId, full_name: currentUser?.full_name } as Employee : undefined;
  const setQuickRange = (preset: 'today' | 'month' | 'all') => {
    const date = getTodayVNString();
    setQuickPreset(preset);
    setStartDate(preset === 'today' ? date : preset === 'month' ? `${date.slice(0, 7)}-01` : '');
    setEndDate(preset === 'all' ? '' : date);
  };
  return <div className="sf-employee-page space-y-6">
    <PageHeaderBanner icon={<span className="sf-employee-title-icon"><Clock size={22}/></span>} title="Theo dõi chấm công"/>
    {employee ? <EmployeeAttendanceTab expandedAdjustments currentEmp={employee} startDate={startDate} endDate={endDate} setStartDate={setStartDate} setEndDate={setEndDate} quickPreset={quickPreset} setQuickPreset={setQuickPreset} setQuickRange={setQuickRange} attendanceTypeFilter={attendanceTypeFilter} setAttendanceTypeFilter={setAttendanceTypeFilter} attendanceStatusFilter={attendanceStatusFilter} setAttendanceStatusFilter={setAttendanceStatusFilter} employeeAttendanceLogs={[]}/> : <p className="sf-empty">Chưa có hồ sơ nhân viên liên kết.</p>}
  </div>;
};
