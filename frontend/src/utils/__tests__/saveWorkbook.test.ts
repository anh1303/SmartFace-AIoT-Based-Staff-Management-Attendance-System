import { afterEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { saveWorkbook } from '../saveWorkbook';

afterEach(() => vi.unstubAllGlobals());

describe('lưu báo cáo Excel', () => {
  const workbook = () => {
    const result = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(result, XLSX.utils.aoa_to_sheet([['Báo cáo']]), 'Báo cáo');
    return result;
  };

  it('chỉ xác nhận sau khi ghi và đóng tệp', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    const picker = vi.fn().mockResolvedValue({ createWritable: async () => ({ write, close }) });
    vi.stubGlobal('window', { showSaveFilePicker: picker });
    expect(await saveWorkbook(workbook(), 'Bao_cao.xlsx')).toBe(true);
    expect(picker).toHaveBeenCalledWith(expect.objectContaining({ suggestedName: 'Bao_cao.xlsx' }));
    expect(write).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it('không xác nhận khi người dùng hủy', async () => {
    vi.stubGlobal('window', { showSaveFilePicker: vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError')) });
    expect(await saveWorkbook(workbook(), 'Bao_cao.xlsx')).toBe(false);
  });
});
