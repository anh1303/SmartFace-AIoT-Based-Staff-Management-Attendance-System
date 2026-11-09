import { expect, it } from 'vitest';
import { restoreNotification } from '../../src/features/notifications/notificationHistory';
it('labels legacy face notifications honestly instead of assigning an employee that was never recorded', () => {
  const old = { id: 'old', title: 'Thành công', message: 'Đã lưu Face ID thành công.', type: 'success' as const, timestamp: '2026-11-08T15:00:00Z', read: false };
  const result = restoreNotification(old);
  expect(result.title).toBe('Lưu Face ID thành công');
  expect(result.message).toContain('Thông báo cũ không lưu tên và mã nhân viên');
  expect(restoreNotification(result)).toEqual(result);
});
it('preserves the full identity and detail in new notifications', () => {
  const item = { id: 'new', title: 'Thêm ảnh mẫu thành công', message: 'Đã thêm 3 ảnh mẫu cho An (NV1).', type: 'success' as const, timestamp: '', read: false };
  expect(restoreNotification(item)).toEqual(item);
});
it('also identifies missing details in history that already has an action title', () => {
  const item = { id: 'old-photo', title: 'Thêm ảnh mẫu thành công', message: 'Đã thêm 3 ảnh vào danh sách mẫu!', type: 'success' as const, timestamp: '', read: false };
  expect(restoreNotification(item).message).toContain('Thông báo cũ không lưu tên và mã nhân viên');
});
