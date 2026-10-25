export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  timestamp: string; // ISO string for safe persistence
  read: boolean;
}

export interface DraggablePosition {
  x: number;
  y: number;
}

export interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  isOpen: boolean;
  hasNewAlert: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  addNotification: (params: { message: string; type?: NotificationType; title?: string }) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  markAllAsRead: () => void;
  markAsRead: (id: string) => void;
}
