import { describe, expect, it } from 'vitest'
import policy from '../../src/content/company-policy.json'
import { calcPayrollAmount } from '../../src/utils/payrollUtils'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

describe('Published company policy', () => {
  it('matches the default multiplier examples used in payroll', () => {
    const content = JSON.stringify(policy)
    expect(calcPayrollAmount(8, 2, 100000)).toBe(1600000)
    expect(calcPayrollAmount(2, 2, 100000)).toBe(400000)
    expect(calcPayrollAmount(1, 1.5, 100000)).toBe(150000)
    expect(content).toContain('1.600.000₫')
    expect(content).toContain('2.650.000₫')
    expect(content).not.toContain('25% tiền công')
    expect(content).not.toContain('2.550.000₫')
    const documentation = readFileSync(fileURLToPath(new URL('../../../docs/rule/COMPANY_POLICY.md', import.meta.url)), 'utf8')
    const defaults = readFileSync(fileURLToPath(new URL('../../../backend/src/common/payroll-policy.ts', import.meta.url)), 'utf8')
    expect(documentation).toContain('1.600.000 đồng')
    expect(documentation).toContain('19.825.000 đồng')
    expect(defaults).toMatch(/overtime_rate:\s*2,\s*late_early_penalty:\s*1\.5,\s*absence_penalty_rate:\s*2/)
  })
})
