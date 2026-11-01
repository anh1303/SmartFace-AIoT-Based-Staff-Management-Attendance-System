import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockApiFetch = vi.fn()
vi.mock('../../src/api/client', () => ({
  apiFetch: (...args: any[]) => mockApiFetch(...args),
}))

import { fetchEmployeesApi } from '../../src/features/employees/api/employeeApi'

describe('Employee API full pagination (101+ employees)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches all pages and retains the 101st employee', async () => {
    const page1Items = Array.from({ length: 100 }, (_, i) => ({
      id: `emp-id-${i + 1}`,
      employee_code: `EMP${String(i + 1).padStart(3, '0')}`,
      full_name: `Employee ${i + 1}`,
      status: 'ACTIVE',
    }))

    const page2Items = [
      {
        id: 'emp-id-101',
        employee_code: 'EMP101',
        full_name: 'Employee 101',
        status: 'ACTIVE',
      },
    ]

    mockApiFetch.mockImplementation(async (url: string) => {
      if (url.includes('page=1')) {
        return {
          success: true,
          data: {
            items: page1Items,
            pagination: { page: 1, limit: 100, totalPages: 2, totalItems: 101 },
          },
        }
      }
      if (url.includes('page=2')) {
        return {
          success: true,
          data: {
            items: page2Items,
            pagination: { page: 2, limit: 100, totalPages: 2, totalItems: 101 },
          },
        }
      }
      return { success: false }
    })

    const employees = await fetchEmployeesApi()

    expect(mockApiFetch).toHaveBeenCalledTimes(2)
    expect(employees).toHaveLength(101)
    expect(employees[100].employee_id).toBe('EMP101')
    expect(employees[100].full_name).toBe('Employee 101')
  })
})
