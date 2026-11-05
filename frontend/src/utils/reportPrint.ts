import type { ExportToExcelOptions } from './excelExport';

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function buildReportHtml({ sheetName, headers, rows, fileName }: ExportToExcelOptions): string {
  const cells = (values: unknown[], tag: string) => values.map(value => `<${tag}>${escapeHtml(value)}</${tag}>`).join('');
  const date = new Date();
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${escapeHtml(fileName.replace(/\.xlsx$/i, ''))}</title>
  <style>@page{size:A4 portrait;margin:0}body{margin:15mm;font-family:"Times New Roman",serif;color:#000;font-size:11pt}h1{text-align:center;font-size:16pt;margin:28px 0 6px;text-transform:uppercase}.date{text-align:center;font-style:italic;margin-bottom:20px}table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:8pt}th,td{border:1px solid #000;padding:5px;overflow-wrap:anywhere;vertical-align:top}thead{display:table-header-group}tr{break-inside:avoid}</style></head><body>
  <h1>${escapeHtml(sheetName)}</h1><div class="date">Ngày lập: ${date.toLocaleDateString('vi-VN')}</div>
  <table><thead><tr>${cells(headers, 'th')}</tr></thead><tbody>${rows.map(row => `<tr>${cells(row, 'td')}</tr>`).join('')}</tbody></table></body></html>`;
}

export function printReport(options: ExportToExcelOptions): void {
  printHtml(buildReportHtml(options));
}

export function printHtml(html: string): void {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc || !frame.contentWindow) { frame.remove(); throw new Error('Không thể mở bản in báo cáo'); }
  doc.open(); doc.write(html); doc.close();
  const previousTitle = document.title;
  document.title = doc.title;
  const restoreTitle = () => { document.title = previousTitle; };
  frame.contentWindow.addEventListener('afterprint', restoreTitle, { once: true });
  frame.contentWindow.focus();
  frame.contentWindow.print();
  setTimeout(() => { restoreTitle(); frame.remove(); }, 60000);
}
