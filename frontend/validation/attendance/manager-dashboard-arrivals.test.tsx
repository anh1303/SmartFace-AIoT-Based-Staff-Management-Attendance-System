import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TODAY_DASHBOARD_QUERY_KEY } from '../../src/features/dashboard/hooks/useDashboard'
import type { TodayDashboardData } from '../../src/features/dashboard/api/dashboardApi'
import { ManagerDashboard } from '../../src/pages/manager/ManagerDashboard'

const { state, chart } = vi.hoisted(() => ({ state: { current: {} as any }, chart: { data: [] as any[] } }))
vi.mock('../../src/context/AppContext', () => ({ useApp: () => state.current }))
vi.mock('../../src/context/ThemeContext', () => ({ useTheme: () => ({ isDark: false }) }))
vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))
vi.mock('recharts', () => ({
  PieChart: ({ children }: any) => children,
  ResponsiveContainer: ({ children }: any) => children,
  Pie: ({ data }: any) => { chart.data = data; return null },
  Cell: () => null,
  Tooltip: () => null,
}))

afterEach(() => vi.useRealTimers())
describe('Manager dashboard arrivals', () => {
  it('renders backend arrival totals instead of recalculating from local scans', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-02T14:00:00+07:00'))
    state.current = {
      employees: ['NV-001', 'NV-002', 'NV-003'].map(employee_id => ({ employee_id, full_name: employee_id, status: 'ACTIVE', department: 'QA' })),
      attendance: [], workShifts: [],
      role: 'admin', currentUser: { role: 'admin' },
    }
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const dashboard: TodayDashboardData = {
      dateStr: '2026-11-02', dateFormatted: 'T2, 02/11/2026',
      kpis: { workingEmployeesCount: 3, totalEmployees: 3, checkInCount: 2, currentlyWorkingCount: 2, checkOutCount: 0 },
      punctuality: {
        onTimeCount: 1, lateCount: 1, notCheckedInCount: 1,
        onTimePct: 33, latePct: 33, notCheckedInPct: 34,
        donutData: [
          { name: 'Đúng giờ', value: 1, color: '#10b981' },
          { name: 'Đi muộn / về sớm', value: 1, color: '#f43f5e' },
          { name: 'Chưa check-in', value: 1, color: '#a855f7' },
        ],
      },
      shifts: [], departmentProgress: [], employeeList: [], recentLogs: [],
      alerts: { overdueEmployees: [], upcomingShiftNotice: null },
    }
    client.setQueryData(TODAY_DASHBOARD_QUERY_KEY, dashboard)
    try {
      renderToStaticMarkup(<QueryClientProvider client={client}><ManagerDashboard /></QueryClientProvider>)
    } finally {
      client.clear()
    }
    expect(chart.data.map(({ name, value }) => ({ name, value }))).toEqual([
      { name: 'Đúng giờ', value: 1 },
      { name: 'Đi muộn / về sớm', value: 1 },
      { name: 'Chưa check-in', value: 1 },
    ])
  })
})

vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => state.current }))
