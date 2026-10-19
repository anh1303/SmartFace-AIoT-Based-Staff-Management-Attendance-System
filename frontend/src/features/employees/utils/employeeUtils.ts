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

export function formatCurrencyVND(val: number | undefined | null): string {
  if (val === undefined || val === null || val === 0) return '';
  return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function parseCurrencyVND(str: string): number {
  const digits = str.replace(/\D/g, '');
  return digits === '' ? 0 : parseInt(digits, 10);
}

