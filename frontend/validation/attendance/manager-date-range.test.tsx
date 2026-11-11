// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, it, vi } from 'vitest'
import { ManagerAttendanceMonitor } from '../../src/pages/manager/ManagerAttendanceMonitor'
import * as client from '../../src/api/client'

;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
vi.mock('../../src/utils/dateUtils', () => ({ getTodayVNString: () => '2026-10-25' }))
vi.mock('../../src/context/AppContext', () => ({ useApp: () => ({ employees: [], workShifts: [], role: 'manager', currentUser: { employee_id: 'manager' }, showToast: vi.fn() }) }))
vi.mock('../../src/context/ShiftContext', async () => { const app = await import('../../src/context/AppContext'); return ({ useShiftContext: () => ({ ...app.useApp(), isLoading: false, isError: false }) }) });
vi.mock('../../src/context/EmployeeContext', async () => { const app = await import('../../src/context/AppContext'); return ({ useEmployeeContext: () => ({ ...app.useApp(), isLoading: false, isError: false }) }) });
vi.mock('../../src/features/employees', () => ({ useDepartmentPositions: () => ({ departmentOptions: [], positionOptions: [] }) }))
vi.mock('../../src/features/attendances', async () => ({
  fetchAttendanceApi: (await vi.importActual<typeof import('../../src/features/attendances/api/attendanceApi')>('../../src/features/attendances/api/attendanceApi')).fetchAttendanceApi,
  AttendanceHeader: () => null,
  AttendanceFilters: ({ setStartDate, setEndDate }: any) => <button onClick={() => { setStartDate('2026-09-01'); setEndDate('2026-09-01') }}>Old date</button>,
  AttendanceTable: ({ employeePairs }: any) => <div data-testid="summary">{employeePairs[0]?.count}:{String(employeePairs[0]?.hasOld)}</div>,
  AttendanceEditModal: () => null, DeviceStatusCards: () => null, WebRTCPlayer: () => null, LiveEventFeed: () => null,
  useDevices: () => ({ devices: [] }),
  useAttendanceSummaries: () => ({ customOvertimeMap: {}, customLateEarlyMap: {}, workingHoursMap: {}, summaryMap: {}, refetch: vi.fn() }),
  useAttendanceLocks: () => ({ isDateLocked: () => false }),
  useAttendanceSocket: () => ({ liveEvents: [], clearEvents: vi.fn() }),
  useAttendancePairs: (_employees: any, _shifts: any, records: any[]) => [{ count: records.length, hasOld: records.some(r => r.id === 'old') }],
  useRawLogsPagination: () => ({ showRawLogs: false, setShowRawLogs: vi.fn() }),
  exportAttendanceToCSV: vi.fn(),
}))

it('loads the selected older date instead of filtering only the newest 50,000 scans', async () => {
  const newer = Array.from({ length: 50001 }, (_, i) => ({ id: `new-${i}`, employee_id: 'E', type: 'CHECK_IN', timestamp: '2026-10-25T08:00:00Z' }))
  const old = { id: 'old', employee_id: 'E', type: 'CHECK_IN', timestamp: '2026-09-01T08:00:00Z' }
  const api = vi.spyOn(client, 'apiFetch').mockImplementation(async (url: string) => {
    const params = new URL(url, 'http://test').searchParams
    const records = params.get('startDate') === '2026-08-31' ? [old] : newer
    const limit = Number(params.get('limit')), page = Number(params.get('page'))
    return { success: true, data: records.slice((page - 1) * limit, page * limit) }
  })
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const waitFor = async (text: string) => {
    for (let i = 0; i < 100; i++) {
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)) })
      if (host.querySelector('[data-testid="summary"]')?.textContent === text) return
    }
    throw new Error(`Did not render ${text}: ${host.textContent}`)
  }
  try {
    await act(async () => { root.render(<QueryClientProvider client={queryClient}><ManagerAttendanceMonitor /></QueryClientProvider>) })
    await waitFor('50001:false')
    await act(async () => { host.querySelector('button')!.click() })
    await waitFor('1:true')
    expect(api.mock.calls.some(([url]) => String(url).includes('startDate=2026-08-31') && String(url).includes('endDate=2026-09-02'))).toBe(true)
  } finally {
    await act(async () => root.unmount())
    queryClient.clear(); api.mockRestore(); host.remove()
  }
})

vi.mock('../../src/context/ToastContext', async () => { const app = await import('../../src/context/AppContext'); return { useToast: () => app.useApp() }; });
vi.mock('../../src/context/AuthContext', async () => { const app = await import('../../src/context/AppContext'); return { useAuth: () => app.useApp() }; });
