// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { ShiftEditModal, EditingShiftTarget } from '../../src/features/schedules/components/ShiftEditModal';
import { ManagerAttendanceMonitor } from '../../src/pages/manager/ManagerAttendanceMonitor';
import * as client from '../../src/api/client';

;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../src/utils/dateUtils', () => ({
  getTodayVNString: () => '2026-10-25',
  formatVNTime: () => '08:00:00',
}));

vi.mock('../../src/context/AppContext', () => ({
  useApp: () => ({
    employees: [{ employee_id: 'EMP001', full_name: 'Nguyen Van A', department: 'IT', status: 'ACTIVE' }],
    workShifts: [],
    role: 'manager',
    currentUser: { employee_id: 'manager', department: 'IT' },
    showToast: vi.fn(),
  }),
}));
vi.mock('../../src/context/ShiftContext', () => ({ useShiftContext: () => ({ isLoading: false, isError: false }) }));
vi.mock('../../src/context/EmployeeContext', () => ({ useEmployeeContext: () => ({ isLoading: false, isError: false }) }));

vi.mock('../../src/features/employees', () => ({
  useDepartmentPositions: () => ({ departmentOptions: [], positionOptions: [] }),
}));

let pairsCalls: any[] = [];
vi.mock('../../src/features/attendances', () => ({
  AttendanceHeader: () => null,
  AttendanceFilters: ({ searchTerm, startDate, endDate }: any) => (
    <div data-testid="filters-state">{startDate}:{endDate}:{searchTerm}</div>
  ),
  AttendanceTable: ({ employeePairs }: any) => (
    <div data-testid="table-state">{employeePairs?.length ?? 0}</div>
  ),
  AttendanceEditModal: () => null,
  DeviceStatusCards: () => null,
  WebRTCPlayer: () => null,
  LiveEventFeed: () => null,
  useDevices: () => ({ devices: [] }),
  useAttendanceSummaries: () => ({ customOvertimeMap: {}, customLateEarlyMap: {}, workingHoursMap: {}, summaryMap: {}, refetch: vi.fn() }),
  useAttendanceLocks: () => ({ isDateLocked: () => false }),
  useAttendanceSocket: () => ({ liveEvents: [], clearEvents: vi.fn() }),
  useAttendancePairs: (_emp: any, _shifts: any, _records: any, start: string, end: string, search: string) => {
    pairsCalls.push({ start, end, search });
    return [{ employee: { employee_id: 'EMP001', full_name: 'Nguyen Van A' } }];
  },
  useRawLogsPagination: () => ({ showRawLogs: false, setShowRawLogs: vi.fn() }),
  exportAttendanceToCSV: vi.fn(),
}));

it('navigates to attendance monitor with date and search params when clicking button in past shift modal', async () => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);

  const mockTarget: EditingShiftTarget = {
    employeeId: 'EMP001',
    employeeName: 'Nguyen Van A',
    date: '2026-10-20',
    dayLabel: '20/10',
    shift: {
      shift_id: 's-1',
      employee_id: 'EMP001',
      date: '2026-10-20',
      work_day: 'Thứ Ba',
      start_time: '08:00',
      end_time: '17:00',
      shift_type: 'OFFICE_HOURS',
    },
    isPast: true,
  };

  const onClose = vi.fn();

  try {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <ShiftEditModal
            editingShift={mockTarget}
            onClose={onClose}
            shiftType="OFFICE_HOURS"
            setShiftType={vi.fn()}
            startTime="08:00"
            setStartTime={vi.fn()}
            endTime="17:00"
            setEndTime={vi.fn()}
            note=""
            setNote={vi.fn()}
            onSubmit={vi.fn()}
            isReadOnly={true}
          />
        </MemoryRouter>
      );
    });

    const buttons = Array.from(document.body.querySelectorAll('button'));
    const attendanceBtn = buttons.find(b => b.textContent?.includes('Chuyển đến Theo dõi chấm công'));
    expect(attendanceBtn).toBeDefined();

    await act(async () => {
      attendanceBtn!.click();
    });

    expect(mockNavigate).toHaveBeenCalledWith('/app/manager/attendance?date=2026-10-20&search=EMP001');
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

it('initializes ManagerAttendanceMonitor with date and employee search filter from URL query params', async () => {
  vi.spyOn(client, 'apiFetch').mockResolvedValue({ success: true, data: [] });

  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  try {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/app/manager/attendance?date=2026-10-20&search=EMP001']}>
            <ManagerAttendanceMonitor />
          </MemoryRouter>
        </QueryClientProvider>
      );
    });

    const filterState = host.querySelector('[data-testid="filters-state"]');
    expect(filterState?.textContent).toBe('2026-10-20:2026-10-20:EMP001');

    const filteredCall = pairsCalls.find(call => call.search === 'EMP001');
    expect(filteredCall).toEqual({
      start: '2026-10-20',
      end: '2026-10-20',
      search: 'EMP001',
    });
  } finally {
    await act(async () => root.unmount());
    queryClient.clear();
    host.remove();
  }
});
