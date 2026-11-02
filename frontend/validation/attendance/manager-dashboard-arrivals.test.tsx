import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
  it('counts each employee once using the first valid arrival, even with re-entry or flagged scans', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-02T14:00:00+07:00'))
    const punch = (employee_id: string, time: string, punctuality: string, status = 'VALID') => ({
      id: `${employee_id}-${time}`, employee_id, employee_name: employee_id,
      timestamp: `2026-11-02T${time}+07:00`, type: 'CHECK_IN', status, raw_status: status, punctuality,
    })
    state.current = {
      employees: ['NV-001', 'NV-002', 'NV-003'].map(employee_id => ({ employee_id, full_name: employee_id, status: 'ACTIVE', department: 'QA' })),
      attendance: [
        punch('NV-001', '13:00:00', 'LATE'), // Returning after lunch, deliberately supplied first.
        punch('NV-002', '08:30:00', 'LATE'),
        punch('NV-001', '08:00:00', 'ON_TIME'),
        punch('NV-003', '07:55:00', 'ON_TIME', 'FLAGGED'),
      ],
      workShifts: ['NV-001', 'NV-002', 'NV-003'].map(employee_id => ({ employee_id, date: '2026-11-02', shift_type: 'OFFICE_HOURS', start_time: '08:00', end_time: '17:00' })),
      role: 'admin', currentUser: { role: 'admin' },
    }
    renderToStaticMarkup(<ManagerDashboard />)
    expect(chart.data.map(({ name, value }) => ({ name, value }))).toEqual([
      { name: 'Đúng giờ', value: 1 },
      { name: 'Đi muộn / về sớm', value: 1 },
      { name: 'Chưa check-in', value: 1 },
    ])
  })
})
