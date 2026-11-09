import type { NotificationItem } from './types/notification.types';

const genericTitles = new Set(['Thành công', 'Thông báo mới', 'Lỗi hệ thống', 'Cảnh báo']);

/** Repair known historical templates without inventing an employee identity. */
export function restoreNotification(item: NotificationItem): NotificationItem {
  const message = item.message.trim();
  const face = /^Đã lưu Face ID thành công[.!]?$/i.test(message);
  const photos = /^Đã thêm \d+ ảnh vào danh sách mẫu!?$/i.test(message)
    || /^Đã thêm \d+ ảnh chụp từ Camera vào danh sách mẫu \(Hiện có \d+\/\d+ ảnh\)!?$/i.test(message);
  if (face || photos) return {
    ...item,
    title: face ? 'Lưu Face ID thành công' : 'Thêm ảnh mẫu thành công',
    message: `${message} Thông báo cũ không lưu tên và mã nhân viên nên không thể xác định người được thao tác từ thông báo này. Vui lòng mở hồ sơ nhân viên để kiểm tra trạng thái sinh trắc học.`,
  };
  return genericTitles.has(item.title) ? { ...item, title: message || item.title } : item;
}
