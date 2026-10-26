import React, { useState, useRef, useEffect } from 'react';
import {
  Trash2,
  X,
  ChevronDown,
} from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { useDraggable } from '../hooks/useDraggable';
import { NotificationItem } from './NotificationItem';
import { NotificationEmptyState } from './NotificationEmptyState';

const BUBBLE_SIZE = 56; // 56px x 56px
const POPUP_WIDTH = 380; // px

export const FloatingNotificationBubble: React.FC = () => {
  const {
    notifications,
    unreadCount,
    isOpen,
    hasNewAlert,
    setIsOpen,
    removeNotification,
    clearAll,
    markAllAsRead,
    markAsRead,
  } = useNotifications();

  const [visibleCount, setVisibleCount] = useState(5);

  const {
    position,
    isDragging,
    isSnapping,
    handlePointerDown,
    isDraggingRef,
  } = useDraggable({
    elementWidth: BUBBLE_SIZE,
    elementHeight: BUBBLE_SIZE,
  });

  const containerRef = useRef<HTMLDivElement>(null);

  // Reset visibleCount to 5 whenever popover closes
  useEffect(() => {
    if (!isOpen) {
      setVisibleCount(5);
    }
  }, [isOpen]);

  // Toggle open popup only when user clicks (not when dragging)
  const handleBubbleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDraggingRef.current) return;

    setIsOpen((prev) => {
      const nextState = !prev;
      // Mark all as read when opening popup
      if (nextState && unreadCount > 0) {
        markAllAsRead();
      }
      return nextState;
    });
  };

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleDocumentClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, [isOpen, setIsOpen]);

  // Determine smart popover placement relative to bubble
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const isRightHalf = typeof window !== 'undefined' && position.x > window.innerWidth / 2;
  const isBottomHalf = typeof window !== 'undefined' && position.y > window.innerHeight / 2;

  // Compute popup coordinates
  const getPopoverStyle = (): React.CSSProperties => {
    if (isMobile) {
      return {
        position: 'fixed',
        left: '16px',
        right: '16px',
        bottom: '80px',
        maxWidth: 'calc(100vw - 32px)',
        zIndex: 10000,
      };
    }

    const style: React.CSSProperties = {
      position: 'fixed',
      width: `${POPUP_WIDTH}px`,
      zIndex: 10000,
    };

    // Horizontal placement: opens toward screen center
    if (isRightHalf) {
      style.right = `${window.innerWidth - position.x + 12}px`;
    } else {
      style.left = `${position.x + BUBBLE_SIZE + 12}px`;
    }

    // Vertical placement: opens toward screen center
    if (isBottomHalf) {
      style.bottom = `${Math.max(16, window.innerHeight - position.y - BUBBLE_SIZE)}px`;
    } else {
      style.top = `${Math.max(16, position.y)}px`;
    }

    return style;
  };

  // Slice visible notifications based on visibleCount
  const displayNotifications = notifications.slice(0, visibleCount);

  return (
    <div ref={containerRef}>
      {/* 1. Floating Notification Bubble (Trigger) */}
      <div
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
        onPointerDown={handlePointerDown}
        onClick={handleBubbleClick}
        className={`fixed z-[9999] select-none touch-none ${
          isSnapping ? 'transition-all duration-300 ease-out' : ''
        }`}
      >
        <button
          type="button"
          aria-label="Thông báo hệ thống"
          className={`group relative w-14 h-14 rounded-full flex items-center justify-center bg-gradient-to-tr from-[#0a2558] via-[#1d4ed8] to-[#38bdf8] text-white border-2 border-white/90 shadow-[0_10px_25px_-4px_rgba(29,78,216,0.55),0_6px_12px_-4px_rgba(29,78,216,0.4)] hover:shadow-[0_15px_35px_-4px_rgba(29,78,216,0.75)] ring-4 ring-blue-500/25 hover:ring-blue-400/40 transition-all duration-300 cursor-grab active:cursor-grabbing hover:scale-110 active:scale-95 ${
            isDragging ? 'shadow-[0_20px_40px_rgba(29,78,216,0.65)] ring-4 ring-indigo-400/50 scale-105' : ''
          } ${isOpen ? 'ring-4 ring-cyan-400/60 scale-105' : ''}`}
        >
          {/* Ambient Glow Aura around the button */}
          <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 opacity-40 blur-md group-hover:opacity-80 transition-opacity duration-300 pointer-events-none -z-10" />

          {/* Pulse Ping Ring when new alert arrives */}
          {hasNewAlert && (
            <span className="absolute -inset-1 rounded-full bg-cyan-400/50 animate-ping pointer-events-none" />
          )}

          {/* High-Contrast Bell Icon with subtle 3D drop-shadow */}
          <div
            className={`transition-transform duration-300 ${
              hasNewAlert ? 'animate-bell-shake' : ''
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              className="w-7 h-7 text-white fill-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)]"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Solid Bell Body */}
              <path d="M12 2.5C8.41 2.5 5.5 5.41 5.5 9c0 4.8-2.2 6.5-2.5 6.8V17h18v-1.2c-.3-.3-2.5-2-2.5-6.8 0-3.59-2.91-6.5-6.5-6.5z" />
              {/* Bell Clapper */}
              <path d="M9.5 19c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5h-5z" />
            </svg>
          </div>

          {/* Red Unread Badge (Góc trên phải với viền trắng tương phản cao) */}
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1.5 flex items-center justify-center text-[11px] font-black tracking-tight text-white bg-gradient-to-r from-rose-500 to-red-600 rounded-full shadow-[0_2px_8px_rgba(225,29,72,0.6)] border-2 border-white animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* 2. Popover Danh Sách Thông Báo */}
      {isOpen && (
        <div
          style={getPopoverStyle()}
          className="bg-white/95 dark:bg-[#0f1224]/95 backdrop-blur-xl border border-slate-200/90 dark:border-[#1e2448] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[500px] animate-in fade-in zoom-in-95 duration-200"
        >
          {/* Popover Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-[#1d2243] bg-slate-50/70 dark:bg-[#141830]/70">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100 font-heading">
                Thông báo
              </span>
              {notifications.length > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40 rounded-full">
                  {notifications.length}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  title="Xóa tất cả thông báo"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors cursor-pointer text-xs flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Đóng bảng thông báo"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-[#1e2448] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Popover Content */}
          <div className="p-3 overflow-y-auto space-y-2 flex-1 max-h-[380px]">
            {notifications.length === 0 ? (
              // Empty State matching Image 2
              <div className="py-2">
                <NotificationEmptyState />
              </div>
            ) : (
              // List of visible notifications
              <>
                {displayNotifications.map((item) => (
                  <NotificationItem
                    key={item.id}
                    item={item}
                    onRemove={removeNotification}
                    onMarkRead={markAsRead}
                  />
                ))}

                {notifications.length > visibleCount && (
                  <div className="pt-1 pb-0.5">
                    <button
                      type="button"
                      onClick={() => setVisibleCount((prev) => prev + 5)}
                      className="w-full py-2 px-3 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-blue-50/70 hover:bg-blue-100/80 dark:bg-[#151a38] dark:hover:bg-[#1c224b] border border-blue-200/60 dark:border-[#272f60] rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <span>Xem thêm</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
