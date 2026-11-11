// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, it, vi } from 'vitest'
import { ManagerAttendanceMonitor } from '../../src/pages/manager/ManagerAttendanceMonitor'

;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
const unlock = vi.fn().mockResolvedValue(undefined)
const retryShifts = vi.fn()
vi.mock('../../src/utils/dateUtils', () => ({ getTodayVNString: () => '2026-11-02' }))
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ role: 'admin' }) }))
vi.mock('../../src/context/AppContext', () => ({ useApp: () => ({ employees: [], workShifts: [], role: 'admin', currentUser: {}, showToast: vi.fn() }) }))
vi.mock('../../src/context/ShiftContext', async () => { const app = await import('../../src/context/AppContext'); return ({ useShiftContext: () => ({ ...app.useApp(), isLoading: false, isError: true, refetchShifts: retryShifts }) }) });
vi.mock('../../src/context/EmployeeContext', async () => { const app = await import('../../src/context/AppContext'); return ({ useEmployeeContext: () => ({ ...app.useApp(), isLoading: false, isError: false }) }) });
vi.mock('../../src/features/employees', () => ({ useDepartmentPositions: () => ({ departmentOptions: [], positionOptions: [] }) }))
vi.mock('../../src/features/attendances', async () => ({
  AttendanceHeader: (await import('../../src/features/attendances/components/AttendanceHeader')).AttendanceHeader,
  AttendanceFilters: () => null, AttendanceTable: () => null, AttendanceEditModal: () => null,
  DeviceStatusCards: () => null, WebRTCPlayer: () => null, LiveEventFeed: () => null,
  useDevices: () => ({ devices: [] }),
  useAttendanceSummaries: () => ({ customOvertimeMap: {}, customLateEarlyMap: {}, workingHoursMap: {}, summaryMap: {}, refetch: vi.fn() }),
  useAttendanceLocks: () => ({ isDateLocked: () => true, toggleLockAsync: unlock, isLoading: false, isError: false }),
  useAttendanceSocket: () => ({ liveEvents: [], clearEvents: vi.fn() }),
  useAttendancePairs: () => [], useRawLogsPagination: () => ({ showRawLogs: false, setShowRawLogs: vi.fn() }), exportAttendanceToCSV: vi.fn(),
}))
vi.mock('../../src/api/client', () => ({ apiFetch: vi.fn().mockResolvedValue({ success: true, data: [] }) }))

it('lets an admin unlock a locked day even if shift data failed to load', async () => {
  const host = document.createElement('div'); document.body.appendChild(host)
  const root = createRoot(host); const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
  try {
    await act(async () => { root.render(<QueryClientProvider client={queryClient}><ManagerAttendanceMonitor /></QueryClientProvider>) })
    const button = Array.from(host.querySelectorAll('button')).find(b => b.textContent?.includes('Mở khóa ngày'))
    expect(button).toBeDefined()
    expect(button!.disabled).toBe(false)
    await act(async () => { button!.click() })
    expect(unlock).toHaveBeenCalledWith('2026-11-02', false)
  } finally { await act(async () => root.unmount()); queryClient.clear(); confirm.mockRestore(); host.remove() }
})

it('explains which data blocks Excel export and offers to retry it', async () => {
  const host = document.createElement('div'); document.body.appendChild(host)
  const root = createRoot(host); const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  try {
    await act(async () => { root.render(<QueryClientProvider client={queryClient}><ManagerAttendanceMonitor /></QueryClientProvider>) })
    expect(host.textContent).toContain('Không thể tải lịch làm việc')
    const retry = Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'Thử tải lại')
    expect(retry).toBeDefined()
    await act(async () => { retry!.click() })
    expect(retryShifts).toHaveBeenCalled()
  } finally { await act(async () => root.unmount()); queryClient.clear(); host.remove() }
})

vi.mock('../../src/context/ToastContext', async () => { const app = await import('../../src/context/AppContext'); return { useToast: () => app.useApp() }; });
