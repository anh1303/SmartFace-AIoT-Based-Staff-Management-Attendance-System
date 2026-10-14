import { Employee } from '../../../types';

export function getNextEmployeeId(employeesList: Employee[]): string {
  const maxNum = employeesList.reduce((max, emp) => {
    const match = emp.employee_id.match(/NV-(\d+)/i);
    if (match) {
      const num = parseInt(match[1], 10);
      return num > max ? num : max;
    }
    return max;
  }, 0);
  return `NV-${String(maxNum + 1).padStart(3, '0')}`;
}
