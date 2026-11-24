import React from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '../../context/ToastContext';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, ChevronDown, X } from 'lucide-react';

export interface ToastContainerProps {
  onOpenNotifications?: () => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ onOpenNotifications }) => {
  const { toasts, removeToast, openNotifications } = useToast();
  const handleOpenNotifications = onOpenNotifications ?? openNotifications;
  if (!toasts.length) return null;
  return createPortal(
    <div data-toast-layer className="fixed bottom-5 right-4 sm:right-5 z-[100] flex flex-col gap-2 pointer-events-none w-[calc(100%-2rem)] max-w-md" aria-label="Thông báo mới" aria-live="polite" aria-relevant="additions">
      {toasts.map(toast => {
        const Icon = toast.type === 'success' ? CheckCircle2 : toast.type === 'error' ? AlertCircle : toast.type === 'warning' ? AlertTriangle : Info;
        const tone = toast.type === 'success' ? 'text-emerald-700 dark:text-emerald-400' : toast.type === 'error' ? 'text-rose-700 dark:text-rose-400' : 'text-blue-700 dark:text-blue-400';
        const title = toast.title || toast.message;
        return <article key={toast.id} className="pointer-events-auto cursor-pointer flex items-start gap-2 p-3 rounded-xl border border-slate-200 dark:border-[#21264b] bg-white dark:bg-[#161a35] shadow-lg"
          onClick={event => { event.stopPropagation(); removeToast(toast.id); handleOpenNotifications?.(); }}>
          <button type="button" aria-label={`Mở thông báo: ${title}`} className={`flex flex-1 min-w-0 items-start gap-3 text-left rounded focus-visible:outline-2 focus-visible:outline-blue-500 ${tone}`}>
            <span className="p-2 rounded-lg bg-slate-100 dark:bg-[#11152a] shrink-0"><Icon aria-hidden="true" size={18}/></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold break-words">{title}</span><span className="block mt-1 text-xs text-slate-500 dark:text-slate-400">Vừa xong</span></span>
            <ChevronDown aria-hidden="true" size={16} className="mt-1 shrink-0"/>
          </button>
          <button type="button" aria-label="Đóng thông báo" onClick={event => { event.stopPropagation(); removeToast(toast.id); }} className="p-1 rounded text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white focus-visible:outline-2"><X aria-hidden="true" size={16}/></button>
        </article>;
      })}
    </div>, document.body,
  );
};
