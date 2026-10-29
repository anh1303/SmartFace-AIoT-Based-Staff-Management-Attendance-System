import React from 'react';
import type { PayrollRecord } from '../../../types';

const money = (n: number) => `${Number(n).toLocaleString('vi-VN')} ₫`;

export function PayrollFreshness({ record }: { record: PayrollRecord }) {
  return <div className="space-y-2">
    {record.needs_recalculation && <p className="sf-feedback warning" role="status">Cần tính lại: dữ liệu nguồn đã thay đổi.</p>}
    {record.requires_reconciliation && <p className="sf-feedback warning" role="status">Cần đối soát: các điều chỉnh chưa được xác nhận với dữ liệu nguồn. Phiếu chưa thể chốt.</p>}
  </div>;
}

export function PayslipBreakdown({ record }: {
  record: PayrollRecord;
  otRate?: number;
  penaltyRate?: number;
}) {
  const breakdown = record.breakdown;
  const rows: [string, number][] = breakdown ? [
    ['Lương theo công', breakdown.base_salary],
    [`Tăng ca đã duyệt (${record.total_overtime ?? 0} giờ)`, breakdown.overtime_pay],
    [`Phạt trễ / sớm (${record.total_late_early ?? 0} giờ)`, -breakdown.late_early_deduction],
    ['Phạt vắng ca đã duyệt', -breakdown.absence_deduction],
    ['Phụ cấp', breakdown.allowance],
  ] : [];
  return <div className="space-y-3">
    <PayrollFreshness record={record}/>
    {!breakdown && <p className="sf-feedback warning">Chưa có chi tiết tính lương cho phiếu này. Cần đối soát dữ liệu trước khi tính lại.</p>}
    <dl className="divide-y divide-slate-200">
      {rows.map(([label, amount]) => <div key={label} className="flex flex-wrap justify-between gap-2 py-4">
        <dt className="text-slate-500">{label}</dt><dd className={`sf-money font-medium ${amount < 0 ? 'text-rose-700' : ''}`}>{money(amount)}</dd>
      </div>)}
      <div className="flex flex-wrap justify-between gap-3 py-5"><dt className="font-semibold">Thực lĩnh theo phiếu lương</dt><dd className="text-xl font-semibold sf-money text-blue-700">{money(record.net_salary)}</dd></div>
    </dl>
    <p className="sf-secondary">Các khoản và thực lĩnh hiển thị theo kết quả đã lưu của hệ thống.</p>
    {record.reason && <div className="sf-feedback mt-4"><span>Lý do điều chỉnh: {record.reason}</span></div>}
  </div>;
}
