// @vitest-environment jsdom
import React, { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PayrollPolicyModal, type PolicyFormData } from '../../src/features/payrolls/components/PayrollPolicyModal'

const fetchPolicy = vi.hoisted(() => vi.fn())
vi.mock('../../src/api/payrollApi', () => ({ fetchBonusPenaltyApi: fetchPolicy }))
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

const initial: PolicyFormData = { effective_period: '2090-11', overtime_rate: 2, late_early_penalty: 1.5, absence_penalty_rate: 2, description: '' }
function Form() {
  const [data, setData] = useState(initial)
  return <PayrollPolicyModal isOpen onClose={() => {}} policyData={data} onChangePolicyData={setData} onSavePolicy={event => event.preventDefault()} />
}
let dispose: (() => Promise<void>) | undefined
afterEach(async () => { await dispose?.(); dispose = undefined; fetchPolicy.mockReset() })
async function mount() {
  const host = document.createElement('div'); document.body.appendChild(host)
  const root = createRoot(host)
  await act(async () => { root.render(<Form />) })
  dispose = async () => { await act(async () => root.unmount()); host.remove() }
  return document.body
}
async function input(element: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  await act(async () => { setter.call(element, value); element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true })) })
}
const base = { overtime_rate: 3, late_early_penalty: 2, absence_penalty_rate: 2, description: 'Từ tháng 12', effective_period: '2090-12' }

describe('Changing a payroll policy effective month', () => {
  it('loads the policy effective in the selected month', async () => {
    fetchPolicy.mockResolvedValue(base)
    const page = await mount()
    await input(page.querySelector('input[type=month]')!, '2091-01')
    expect(fetchPolicy).toHaveBeenCalledWith('2091-01')
    expect((page.querySelectorAll('input[type=number]')[0] as HTMLInputElement).value).toBe('3')
  })
  it('asks before replacing edited values and permits keeping them', async () => {
    fetchPolicy.mockResolvedValue(base)
    const page = await mount()
    await input(page.querySelectorAll('input[type=number]')[0] as HTMLInputElement, '4')
    await input(page.querySelector('input[type=month]')!, '2091-01')
    expect(page.textContent).toContain('Giữ giá trị đang nhập')
    expect((page.querySelector('button[type=submit]') as HTMLButtonElement).disabled).toBe(true)
    await act(async () => { [...page.querySelectorAll('button')].find(button => button.textContent?.includes('Giữ giá trị đang nhập'))!.click() })
    expect((page.querySelectorAll('input[type=number]')[0] as HTMLInputElement).value).toBe('4')
    expect((page.querySelector('button[type=submit]') as HTMLButtonElement).disabled).toBe(false)
  })
  it('can replace edits with the newly selected policy', async () => {
    fetchPolicy.mockResolvedValue(base)
    const page = await mount()
    await input(page.querySelectorAll('input[type=number]')[0] as HTMLInputElement, '4')
    await input(page.querySelector('input[type=month]')!, '2091-01')
    await act(async () => { [...page.querySelectorAll('button')].find(button => button.textContent?.includes('Dùng chính sách kỳ mới'))!.click() })
    expect((page.querySelectorAll('input[type=number]')[0] as HTMLInputElement).value).toBe('3')
  })
  it('blocks saving when the policy cannot be loaded', async () => {
    fetchPolicy.mockRejectedValue(new Error('offline'))
    const page = await mount()
    await input(page.querySelector('input[type=month]')!, '2091-01')
    expect(page.textContent).toContain('Không tải được chính sách')
    expect((page.querySelector('button[type=submit]') as HTMLButtonElement).disabled).toBe(true)
    fetchPolicy.mockResolvedValue(base)
    await act(async () => { [...page.querySelectorAll('button')].find(button => button.textContent?.includes('Thử lại'))!.click() })
    expect((page.querySelectorAll('input[type=number]')[0] as HTMLInputElement).value).toBe('3')
    expect((page.querySelector('button[type=submit]') as HTMLButtonElement).disabled).toBe(false)
  })
  it('does not substitute default rates when the selected month has no verified policy', async () => {
    fetchPolicy.mockResolvedValue(null)
    const page = await mount()
    await input(page.querySelector('input[type=month]')!, '2091-01')
    expect(page.textContent).toContain('Không tải được chính sách')
    expect((page.querySelector('button[type=submit]') as HTMLButtonElement).disabled).toBe(true)
  })
  it('ignores an older response when the month changes again', async () => {
    let resolveOld!: (value: unknown) => void
    fetchPolicy.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve })).mockResolvedValueOnce({ ...base, overtime_rate: 4 })
    const page = await mount()
    await input(page.querySelector('input[type=month]')!, '2091-01')
    expect((page.querySelector('button[type=submit]') as HTMLButtonElement).disabled).toBe(true)
    await input(page.querySelector('input[type=month]')!, '2091-02')
    await act(async () => { resolveOld(base) })
    expect((page.querySelector('input[type=month]') as HTMLInputElement).value).toBe('2091-02')
    expect((page.querySelectorAll('input[type=number]')[0] as HTMLInputElement).value).toBe('4')
  })
})
