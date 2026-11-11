// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { FloatingNotificationBubble } from '../../src/features/notifications/components/FloatingNotificationBubble'

vi.mock('../../src/features/notifications/context/NotificationContext', () => ({ useNotifications: () => ({
  notifications: [{ id: '1', title: 'Alert', message: 'Details', timestamp: '2026-11-10T12:00:00Z', type: 'info', read: false }],
  unreadCount: 1, isOpen: true, setIsOpen: () => {}, markAsRead: async () => {}, removeNotification: async () => {},
  markAllAsRead: async () => { throw new Error('Không kết nối được máy chủ') },
  clearAll: async () => { throw new Error('Không kết nối được máy chủ') },
}) }))
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

it('keeps each bulk-action error below its own button rather than adding toolbar columns', async () => {
  const host = document.createElement('div'); document.body.appendChild(host)
  const root = createRoot(host)
  try {
    await act(async () => root.render(<FloatingNotificationBubble />))
    const read = [...host.querySelectorAll('button')].find(button => button.textContent?.includes('Đánh dấu đã đọc'))!
    const clear = [...host.querySelectorAll('button')].find(button => button.textContent?.includes('Xóa tất cả'))!
    await act(async () => { read.click(); clear.click() })
    const errors = host.querySelectorAll('[role=alert]')
    expect(errors).toHaveLength(2)
    for (const error of errors) expect(error.parentElement?.querySelectorAll('button')).toHaveLength(1)
    expect(errors[0].parentElement?.contains(read)).toBe(true)
    expect(errors[1].parentElement?.contains(clear)).toBe(true)
  } finally { await act(async () => root.unmount()); host.remove() }
})
