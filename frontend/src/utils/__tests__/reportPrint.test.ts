import { describe, expect, it } from 'vitest';
import { buildReportHtml } from '../reportPrint';

describe('bản in báo cáo', () => {
  it('giữ dữ liệu tiếng Việt và mã hóa nội dung trong bảng', () => {
    const html = buildReportHtml({ sheetName: 'Báo cáo chấm công', fileName: 'report.xlsx', headers: ['Họ tên'], rows: [['Nguyễn <An>']] });
    expect(html).toContain('@page{size:A4 portrait;margin:0}');
    expect(html).toContain('Nguyễn &lt;An&gt;');
    expect(html).toContain('<title>report</title>');
    expect(html).not.toContain('Người lập biểu');
  });
});
