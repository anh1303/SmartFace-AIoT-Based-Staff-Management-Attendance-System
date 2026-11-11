// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { PayrollHeader } from '../../src/features/payrolls/components/PayrollHeader'

vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ role: 'admin' }) }))
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
let cleanup: (() => Promise<void>) | undefined
afterEach(async () => { await cleanup?.(); cleanup = undefined })

it('selects past and future payroll months without requiring existing payroll records and ignores clearing', async () => {
  const change = vi.fn()
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  cleanup = async () => { await act(async () => root.unmount()); host.remove() }
  await act(async () => root.render(<PayrollHeader selectedPeriod="2026-11" onSelectPeriod={change}
    isCalculating={false} isFinalized={false} onCalculatePayroll={() => {}} onOpenFinalizeModal={() => {}}
    onOpenUnlockModal={() => {}} onExportCSV={() => {}} />))
  const picker = host.querySelector<HTMLInputElement>('input[type=month][aria-label="Kỳ lương"]')
  expect(picker).not.toBeNull()
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  for (const value of ['2026-08', '2025-01', '2028-12']) {
    await act(async () => {
      setter.call(picker, value)
      picker!.dispatchEvent(new Event('input', { bubbles: true }))
      picker!.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(change).toHaveBeenLastCalledWith(value)
  }
  change.mockClear()
  await act(async () => {
    setter.call(picker, '')
    picker!.dispatchEvent(new Event('input', { bubbles: true }))
    picker!.dispatchEvent(new Event('change', { bubbles: true }))
  })
  expect(change).not.toHaveBeenCalled()
})
