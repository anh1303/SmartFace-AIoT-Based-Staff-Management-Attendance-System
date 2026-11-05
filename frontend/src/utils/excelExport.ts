import * as XLSX from 'xlsx';

export interface ExportToExcelOptions {
  sheetName: string;
  headers: string[];
  rows: (string | number | boolean | null | undefined)[][];
  fileName: string;
  colWidths?: { wch: number }[];
  /**
   * Tùy chọn hàm điều chỉnh nội dung đo độ rộng cho từng cột (ví dụ: lược bỏ ghi chú [...] trong ô)
   */
  measureText?: (colIdx: number, val: any) => string;
}

/**
 * Tự động tính toán độ rộng tối ưu cho từng cột để file Excel mở ra vừa vặn
 */
export const calculateAutoFitWidths = (
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
  measureText?: (colIdx: number, val: any) => string
): { wch: number }[] => {
  return headers.map((header, colIdx) => {
    let maxLen = header.length;
    rows.forEach((row) => {
      const val = row[colIdx];
      if (val !== undefined && val !== null) {
        const text = measureText ? measureText(colIdx, val) : String(val);
        const len = text.length;
        if (len > maxLen) {
          maxLen = len;
        }
      }
    });
    // Thêm khoảng đệm 3 ký tự, độ rộng tối thiểu 12 ký tự
    return { wch: Math.max(maxLen + 3, 12) };
  });
};

/**
 * Xuất dữ liệu bảng ra file Excel (.xlsx) chuẩn
 */
export const exportToExcel = ({
  sheetName,
  headers,
  rows,
  fileName,
  colWidths,
  measureText,
}: ExportToExcelOptions): void => {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  const widths = colWidths || calculateAutoFitWidths(headers, rows, measureText);
  worksheet['!cols'] = widths;

  const validSheetName = (sheetName || 'Sheet1').slice(0, 31);
  XLSX.utils.book_append_sheet(workbook, worksheet, validSheetName);

  const cleanFileName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  XLSX.writeFile(workbook, cleanFileName);
};

