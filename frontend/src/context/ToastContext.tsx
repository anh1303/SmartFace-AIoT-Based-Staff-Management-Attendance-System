import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { ToastMessage } from '../types';
import { useOptionalNotifications } from '../features/notifications';

interface ToastContextType {
  toasts: ToastMessage[];
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning', title?: string) => void;
  removeToast: (id: string) => void;
  reportError: (message: string, title?: string, checkpoint?: number) => void;
  getCheckpoint: () => number;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const notifications = useOptionalNotifications();
  const active = useRef<ToastMessage[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const sequence = useRef(0);
  const generations = useRef(new Map<string, number>());
  const getCheckpoint = useCallback(() => sequence.current, []);
  const addNotification = notifications?.addNotification;
  const removeToast = useCallback((id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    generations.current.delete(id);
    active.current = active.current.filter(t => t.id !== id);
    setToasts(active.current);
  }, []);
  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current.clear(); }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info', title = message) => {
    const generation = ++sequence.current;
    const id = `toast_${Date.now()}_${generation}`;
    if (active.current.length === 2) removeToast(active.current[0].id);
    active.current = [...active.current, { id, title, message, type }];
    generations.current.set(id, generation);
    setToasts(active.current);
    timers.current.set(id, setTimeout(() => removeToast(id), 5000));

    // Đồng thời đưa thông báo vào Floating Notification Bubble
    addNotification?.({ title, message, type });
  }, [addNotification, removeToast]);


  const reportError = useCallback((message: string, title = 'Không thực hiện được thao tác', checkpoint = 0) => {
    // Mutation hooks may already have reported this failure with employee/action details.
    if (!active.current.some(t => t.type === 'error' && (generations.current.get(t.id) || 0) > checkpoint && t.message.includes(message))) {
      showToast(message, 'error', title);
    }
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast, reportError, getCheckpoint }}>
      {children}
    </ToastContext.Provider>
  );
};

export function useToast(optional: true): ToastContextType | undefined;
export function useToast(optional?: false): ToastContextType;
export function useToast(optional = false) {
  const context = useContext(ToastContext);
  if (!context && !optional) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
