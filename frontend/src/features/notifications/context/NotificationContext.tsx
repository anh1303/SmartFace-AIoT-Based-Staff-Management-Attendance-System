import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  NotificationItem,
  NotificationType,
  NotificationContextType,
} from '../types/notification.types';

const NOTIFICATIONS_STORAGE_KEY = 'smartface_notifications_cache';
const MAX_STORED_NOTIFICATIONS = 30;

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

function getDefaultTitle(type: NotificationType): string {
  switch (type) {
    case 'success':
      return 'Thành công';
    case 'error':
      return 'Lỗi hệ thống';
    case 'warning':
      return 'Cảnh báo';
    case 'info':
    default:
      return 'Thông báo mới';
  }
}

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      // Chỉ phục hồi thông báo nếu phiên đăng nhập còn hoạt động
      const hasActiveSession = Boolean(
        sessionStorage.getItem('userSession') || localStorage.getItem('userSession')
      );
      if (!hasActiveSession) {
        sessionStorage.removeItem(NOTIFICATIONS_STORAGE_KEY);
        localStorage.removeItem(NOTIFICATIONS_STORAGE_KEY);
        return [];
      }

      const saved = sessionStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.slice(0, MAX_STORED_NOTIFICATIONS);
        }
      }
    } catch {
      // Ignore cache errors
    }
    return [];
  });

  const [isOpen, setIsOpen] = useState(false);
  const [hasNewAlert, setHasNewAlert] = useState(false);

  // Sync to sessionStorage (chỉ lưu trong phiên hiện tại)
  useEffect(() => {
    try {
      const hasActiveSession = Boolean(
        sessionStorage.getItem('userSession') || localStorage.getItem('userSession')
      );
      if (hasActiveSession && notifications.length > 0) {
        sessionStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications));
      } else {
        sessionStorage.removeItem(NOTIFICATIONS_STORAGE_KEY);
        localStorage.removeItem(NOTIFICATIONS_STORAGE_KEY);
      }
    } catch {
      // Ignore quota exceeded
    }
  }, [notifications]);

  // Compute unread count
  const unreadCount = useMemo(() => {
    return notifications.filter((item) => !item.read).length;
  }, [notifications]);

  // Add notification
  const addNotification = useCallback(
    ({
      message,
      type = 'info',
      title,
    }: {
      message: string;
      type?: NotificationType;
      title?: string;
    }) => {
      // Chỉ nhận thông báo khi đang trong phiên đăng nhập và bỏ qua thông báo đăng xuất
      const hasActiveSession = Boolean(
        sessionStorage.getItem('userSession') || localStorage.getItem('userSession')
      );
      if (!hasActiveSession || message.toLowerCase().includes('đã đăng xuất')) {
        return;
      }

      const resolvedTitle = title || getDefaultTitle(type);
      const newItem: NotificationItem = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title: resolvedTitle,
        message,
        type,
        timestamp: new Date().toISOString(),
        read: false,
      };

      setNotifications((prev) => [newItem, ...prev.slice(0, MAX_STORED_NOTIFICATIONS - 1)]);

      // Trigger bell shake animation
      setHasNewAlert(true);
      setTimeout(() => setHasNewAlert(false), 1200);
    },
    []
  );

  // Remove single notification
  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // Clear all (xóa sạch cả state và storage)
  const clearAll = useCallback(() => {
    setNotifications([]);
    try {
      sessionStorage.removeItem(NOTIFICATIONS_STORAGE_KEY);
      localStorage.removeItem(NOTIFICATIONS_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);



  // Mark all as read
  const markAllAsRead = useCallback(() => {
    setNotifications((prev) =>
      prev.map((item) => (item.read ? item : { ...item, read: true }))
    );
  }, []);

  // Mark single as read
  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, read: true } : item))
    );
  }, []);

  const value = useMemo<NotificationContextType>(
    () => ({
      notifications,
      unreadCount,
      isOpen,
      hasNewAlert,
      setIsOpen,
      addNotification,
      removeNotification,
      clearAll,
      markAllAsRead,
      markAsRead,
    }),
    [
      notifications,
      unreadCount,
      isOpen,
      hasNewAlert,
      addNotification,
      removeNotification,
      clearAll,
      markAllAsRead,
      markAsRead,
    ]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const useOptionalNotifications = () => {
  return useContext(NotificationContext);
};

