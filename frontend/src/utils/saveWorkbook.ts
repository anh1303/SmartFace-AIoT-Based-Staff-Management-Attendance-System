import * as XLSX from 'xlsx';

type SavePicker = (options: object) => Promise<{ createWritable: () => Promise<{ write: (data: ArrayBuffer) => Promise<void>; close: () => Promise<void> }> }>;

export async function saveWorkbook(workbook: XLSX.WorkBook, fileName: string): Promise<boolean> {
  const picker = typeof window === 'undefined' ? undefined : (window as Window & { showSaveFilePicker?: SavePicker }).showSaveFilePicker?.bind(window);
  if (!picker) {
    XLSX.writeFile(workbook, fileName);
    return false;
  }
  try {
    const handle = await picker({ suggestedName: fileName, types: [{ description: 'Excel', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }] });
    const writable = await handle.createWritable();
    await writable.write(XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }));
    await writable.close();
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return false;
    throw error;
  }
}
