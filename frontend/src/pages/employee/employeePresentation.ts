import type { WorkShift } from '../../types';

export const shiftNames: Record<WorkShift['shift_type'], string> = {
  MORNING: 'Ca sáng', AFTERNOON: 'Ca chiều', OFFICE_HOURS: 'Ca hành chính', OTHER: 'Ca khác', OFF: 'Nghỉ ca',
};
export const money = (value: number | null | undefined) => value == null ? '—' : `${Number(value).toLocaleString('vi-VN')}đ`;
export const quantity = (value: number | null | undefined, unit: string) => value == null ? '—' : `${Number(value).toLocaleString('vi-VN')} ${unit}`;
export const shortDate = (date: string) => date.slice(5).split('-').reverse().join('/');
