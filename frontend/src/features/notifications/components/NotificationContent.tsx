import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { NotificationType } from '../types/notification.types';

const titleColors: Record<NotificationType, string> = {
  success: 'text-emerald-700 dark:text-emerald-400',
  info: 'text-blue-700 dark:text-blue-400',
  error: 'text-rose-700 dark:text-rose-400',
  warning: 'text-blue-700 dark:text-blue-400',
};

export function NotificationContent({ title, description, type, onOpen }: {
  title: string; description: string; type: NotificationType; onOpen?: () => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');
  const detailsId = useId();
  return <div className="min-w-0 flex-1">
    <button type="button" aria-expanded={expanded} aria-controls={expanded ? detailsId : undefined}
      className={`flex w-full items-start gap-2 text-left text-sm font-semibold rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500 ${titleColors[type]}`}
      onClick={async () => {
        setExpanded(!expanded);
        if (!expanded) {
          setError('');
          try { await onOpen?.(); } catch { setError('Chưa đánh dấu đã đọc được. Vui lòng thử lại.'); }
        }
      }}>
      <span className="min-w-0 flex-1 break-words">{title}</span>
      <ChevronDown aria-hidden="true" size={15} className={`mt-0.5 shrink-0 transition-transform motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`}/>
    </button>
    {expanded && <p id={detailsId} className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap break-words">{description}</p>}
    {error && <p role="alert" className="mt-2 text-sm text-rose-700 dark:text-rose-400">{error}</p>}
  </div>;
}
