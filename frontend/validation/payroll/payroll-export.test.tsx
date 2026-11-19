// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Employee } from '@/features/employees';
import type { PayrollRecord } from '@/features/payrolls';(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

const toastSpy = vi.fn()
const state = vi.hoisted(() => ({
  payroll: [] as PayrollRecord[],
  employees: [] as Employee[],
  bonusPenalty: null,
  role: 'manager',
  currentUser: { employee_id: 'MGR01', department: 'IT' } as any,
  selectedPeriod: '2026-10',
  setSelectedPeriod: vi.fn(),
  generatePayroll: vi.fn(),
  updatePayrollItem: vi.fn(),
  finalizePayrollPeriod: vi.fn(),
  unlockPayrollPeriod: vi.fn(),
  updateBonusPenalty: vi.fn(),
}))

vi.mock('../../src/context/AppContext', () => ({ useApp: () => state }))
vi.mock('../../src/features/payrolls/context/PayrollContext', () => ({ usePayrollContext: () => state }))
vi.mock('../../src/features/employees/context/EmployeeContext', () => ({ useEmployeeContext: () => ({ employees: state.employees }) }))
vi.mock('../../src/features/auth/context/AuthContext', () => ({ useAuth: () => ({ role: state.role, currentUser: state.currentUser }) }))
vi.mock('../../src/context/ToastContext', () => ({
  useToast: () => ({ showToast: toastSpy, toasts: [], removeToast: vi.fn(), reportError: vi.fn(), getCheckpoint: () => 0 }),
  ToastProvider: ({ children }: any) => <>{children}</>,
}))
vi.mock('../../src/utils/excelExport', () => ({ exportToExcel: vi.fn().mockResolvedValue(true) }))

import * as client from '../../src/api/client'
import { exportToExcel } from '../../src/utils/excelExport'
import { ManagerPayroll } from '../../src/pages/manager/ManagerPayroll'

const finalizedRegular: PayrollRecord = {
  id: '10',
  payroll_id: 'PR-202610-010',
  employee_id: 'EMP001',
  employee_name: 'Nguyen Van A',
  department: 'IT',
  period: '2026-10',
  hourly_rate: 100000,
  total_working_hours: 160,
  total_overtime: 4,
  total_late_early: 0,
  total_absence_penalty: 0,
  allowance: 500000,
  net_salary: 17300000,
  status: 'FINALIZED',
  can_edit: false,
}

const finalizedEarlyOnly: PayrollRecord = {
  ...finalizedRegular,
  id: '11',
  payroll_id: 'PR-202610-011',
  employee_id: 'EMP002',
  employee_name: 'Tran Thi B',
  calculation_details: { early_settlement: { is_early_settlement: true } },
}

describe('ManagerPayroll official export workflow', () => {
  let host: HTMLDivElement
  let root: Root
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    state.payroll = []
    state.employees = []
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    host.remove()
    queryClient.clear()
  })

  const renderPage = async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <QueryClientProvider client={queryClient}>
            <ManagerPayroll />
          </QueryClientProvider>
        </MemoryRouter>
      )
    })
  }

  const findExportTrigger = () =>
    [...host.querySelectorAll('button')].find(btn => btn.textContent?.includes('Xuất báo cáo'))

  const clickExportExcel = async () => {
    const trigger = findExportTrigger()
    expect(trigger).toBeDefined()
    await act(async () => {
      trigger!.click()
    })
    const excelOption = [...document.body.querySelectorAll('button, [role="menuitem"]')].find(el =>
      el.textContent?.includes('Xuất Excel')
    )
    if (excelOption) {
      await act(async () => {
        ;(excelOption as HTMLElement).click()
      })
    }
  }

  it('disables the export button when the period only has early settlements or has a pending payslip', async () => {
    state.payroll = [finalizedEarlyOnly]
    await renderPage()
    expect(findExportTrigger()?.hasAttribute('disabled')).toBe(true)

    state.payroll = [finalizedRegular, { ...finalizedRegular, id: '12', payroll_id: 'PR-202610-012', status: 'PENDING' }]
    await renderPage()
    expect(findExportTrigger()?.hasAttribute('disabled')).toBe(true)
  })

  it('stops without falling back to the full period when the active UI filter matches zero rows', async () => {
    const apiSpy = vi.spyOn(client, 'apiFetch')
    state.payroll = [finalizedRegular]
    await renderPage()

    // Type a search query that matches 0 rows
    const searchInput = host.querySelector('input[placeholder*="Tìm kiếm"]') as HTMLInputElement
    expect(searchInput).toBeTruthy()
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
      setter?.call(searchInput, 'NON_EXISTENT_EMPLOYEE_XYZ')
      searchInput.dispatchEvent(new Event('input', { bubbles: true }))
      searchInput.dispatchEvent(new Event('change', { bubbles: true }))
    })

    await clickExportExcel()
    expect(apiSpy).not.toHaveBeenCalledWith(expect.stringContaining('/export'), expect.anything())
    expect(exportToExcel).not.toHaveBeenCalled()
    apiSpy.mockRestore()
  })

  it('calls POST /api/payroll/period/:period/export with filtered IDs, uses server DTO employee_name without employees state, and surfaces 409 when period is reopened after load', async () => {
    const secondFinalized: PayrollRecord = {
      ...finalizedRegular,
      id: '20',
      payroll_id: 'PR-202610-020',
      employee_id: 'EMP002',
      employee_name: 'Le Van C',
      net_salary: 21000000,
    }
    state.payroll = [finalizedRegular, secondFinalized]
    state.employees = [] // Empty employees state to prove export uses server DTO employee_name

    const apiSpy = vi.spyOn(client, 'apiFetch').mockImplementation(async (url: string) => {
      if (url.includes('/api/payroll/period/2026-10/export')) {
        return {
          success: true,
          data: [secondFinalized],
        } as any
      }
      return { success: true, data: [] } as any
    })

    await renderPage()

    // Filter to EMP002 only
    const searchInput = host.querySelector('input[placeholder*="Tìm kiếm"]') as HTMLInputElement
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
      setter?.call(searchInput, 'EMP002')
      searchInput.dispatchEvent(new Event('input', { bubbles: true }))
      searchInput.dispatchEvent(new Event('change', { bubbles: true }))
    })

    await clickExportExcel()

    expect(apiSpy).toHaveBeenCalledWith(
      '/api/payroll/period/2026-10/export',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ recordIds: ['PR-202610-020'] }),
      })
    )
    expect(exportToExcel).toHaveBeenCalledTimes(1)
    const exportedArgs = vi.mocked(exportToExcel).mock.calls[0][0]
    expect(exportedArgs.rows).toEqual([
      ['EMP002', 'Le Van C', '2026-10', 100000, 160, 4, 0, 0, 500000, 21000000, 'Đã Chốt'],
    ])

    // Now simulate period reopened on server after UI loaded (409 Conflict)
    vi.mocked(exportToExcel).mockClear()
    apiSpy.mockImplementationOnce(async () => {
      throw new Error('Kỳ lương vừa được mở khóa; chưa đủ điều kiện xuất báo cáo')
    })

    await clickExportExcel()
    expect(exportToExcel).not.toHaveBeenCalled()
    expect(toastSpy).toHaveBeenCalledWith(
      expect.stringContaining('Kỳ lương vừa được mở khóa'),
      'error',
      expect.any(String)
    )
    apiSpy.mockRestore()
  })
})
