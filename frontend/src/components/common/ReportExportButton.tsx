import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, FileSpreadsheet, FileText } from 'lucide-react';

export type ReportFormat = 'excel' | 'pdf';

export function ReportExportButton({ onExport, disabled = false }: { onExport: (format: ReportFormat) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const dismiss = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', dismiss); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', dismiss); document.removeEventListener('keydown', escape); };
  }, []);
  return <div className="relative w-fit" ref={root}>
    <button type="button" disabled={disabled} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(!open)} className="h-10 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1a1e3a] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#272d5a] text-xs font-semibold flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
      <Download className="w-4 h-4 text-blue-600" /> Xuất báo cáo <ChevronDown className="w-4 h-4" />
    </button>
    {open && <div className="absolute right-0 top-full mt-2 z-50 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg overflow-hidden">
      {([['excel', 'Xuất Excel', 'Định dạng .xlsx', FileSpreadsheet], ['pdf', 'Xuất PDF', 'Định dạng .pdf', FileText]] as const).map(([format, label, detail, Icon]) => <button key={format} type="button" onClick={() => { setOpen(false); onExport(format); }} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 focus-visible:bg-slate-100 dark:focus-visible:bg-slate-800 border-b last:border-0 border-slate-100 dark:border-slate-700"><Icon className={`w-4 h-4 ${format === 'excel' ? 'text-green-600' : 'text-red-500'}`} /><span><span className="block text-sm font-semibold text-slate-900 dark:text-white">{label}</span><span className="block text-xs text-slate-500 dark:text-slate-400 mt-1">{detail}</span></span></button>)}
    </div>}
  </div>;
}
