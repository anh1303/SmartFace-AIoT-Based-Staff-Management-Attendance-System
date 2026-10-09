import React from 'react';
import { useToast } from '../../context/ToastContext';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none max-w-md md:max-w-lg w-full">
      {toasts.map(toast => {
        let icon = <Info className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0" />;
        let borderClass = 'border-purple-200 bg-purple-50/95 text-purple-950 dark:border-purple-500/30 dark:bg-[#18152e]/95 dark:text-purple-100 shadow-md';

        if (toast.type === 'success') {
          icon = <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />;
          borderClass = 'border-emerald-200 bg-emerald-50/95 text-emerald-950 dark:border-emerald-500/30 dark:bg-[#0e221c]/95 dark:text-emerald-100 shadow-md';
        } else if (toast.type === 'error') {
          icon = <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />;
          borderClass = 'border-rose-200 bg-rose-50/95 text-rose-950 dark:border-rose-500/30 dark:bg-[#271317]/95 dark:text-rose-100 shadow-md';
        } else if (toast.type === 'warning') {
          icon = <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />;
          borderClass = 'border-amber-200 bg-amber-50/95 text-amber-950 dark:border-amber-500/30 dark:bg-[#291e0f]/95 dark:text-amber-100 shadow-md';
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl border backdrop-blur-md transition-all duration-300 transform translate-y-0 ${borderClass}`}
          >
            <div className="flex items-center gap-3">
              {icon}
              <span className="text-sm font-medium">{toast.message}</span>
            </div>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};