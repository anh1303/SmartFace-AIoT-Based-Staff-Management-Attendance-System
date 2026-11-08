import { ActionButton } from '@/components/common/ActionFeedback';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import type { NotificationItem as NotificationItemType } from '../types/notification.types';
import { formatRelativeTime } from '../utils/timeAgo';
import { NotificationContent } from './NotificationContent';

export function NotificationItem({ item, onRemove, onMarkRead }: {
  item: NotificationItemType; onRemove: (id: string) => Promise<void>; onMarkRead?: (id: string) => Promise<void>;
}) {
  const Icon = item.type === 'success' ? CheckCircle2 : item.type === 'error' ? AlertCircle : item.type === 'warning' ? AlertTriangle : Info;
  const tone = item.type === 'success' ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40'
    : item.type === 'error' ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40'
    : 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40';
  return <article className={`relative flex items-start gap-3 p-3.5 rounded-xl border ${item.read
    ? 'bg-white/60 dark:bg-[#12162a]/60 border-slate-200/70 dark:border-[#1d2243]/70'
    : 'bg-white dark:bg-[#161a35] border-blue-200 dark:border-blue-900/60'}`}>
    {!item.read && <span aria-label="Chưa đọc" className="absolute -left-1 top-5 w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400"/>}
    <div className={`p-2 rounded-lg shrink-0 ${tone}`}><Icon aria-hidden="true" size={17}/></div>
    <div className="min-w-0 flex-1">
      <NotificationContent title={item.title} description={item.message} type={item.type} onOpen={!item.read && onMarkRead ? () => onMarkRead(item.id) : undefined}/>
      <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{formatRelativeTime(item.timestamp)}</p>
    </div>
    <ActionButton busyLabel="Đang xóa…" aria-label="Xóa thông báo" title="Xóa thông báo" className="p-1 shrink-0 rounded text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400" onClick={() => onRemove(item.id)}><X aria-hidden="true" size={16}/></ActionButton>
  </article>;
}
