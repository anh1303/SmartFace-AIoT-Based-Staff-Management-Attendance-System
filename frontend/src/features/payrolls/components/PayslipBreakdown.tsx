import React from 'react';
import type { PayrollRecord } from '../../../types';
import { calcPayrollAmount } from '../../../utils/payrollUtils';
const money = (n: number) => `${Number(n).toLocaleString('vi-VN')} ₫`;
export function PayslipBreakdown({ record, otRate, penaltyRate }: {
    record: PayrollRecord;
    otRate: number;
    penaltyRate: number;
}) { const hours = Number(record.total_working_hours ?? record.working_hours ?? 0); const rate = Number(record.hourly_rate || 0); const rows: [
    string,
    number
][] = [[`Lương theo công (${hours} giờ × ${money(rate)})`, hours * rate], [`Tăng ca đã duyệt (${record.total_overtime || 0} giờ)`, calcPayrollAmount(record.total_overtime || 0, Number(record.overtime_rate ?? otRate), rate)], [`Phạt trễ / sớm (${record.total_late_early || 0} giờ)`, -calcPayrollAmount(record.total_late_early || 0, Number(record.late_penalty_rate ?? record.late_early_penalty ?? penaltyRate), rate)], ['Phạt vắng ca đã duyệt', -Number(record.total_absence_penalty || 0)], ['Phụ cấp', Number(record.allowance || 0)]]; return <div><dl className="divide-y divide-slate-200">{rows.map(([label, amount]) => <div key={label} className="flex flex-wrap justify-between gap-2 py-4"><dt className="text-slate-500">{label}</dt><dd className={`sf-money font-medium ${amount < 0 ? 'text-rose-700' : ''}`}>{money(amount)}</dd></div>)}<div className="flex flex-wrap justify-between gap-3 py-5"><dt className="font-semibold">Thực lĩnh theo phiếu lương</dt><dd className="text-xl font-semibold sf-money text-blue-700">{money(record.net_salary || 0)}</dd></div></dl><p className="sf-secondary">Chi tiết ưu tiên đơn giá được lưu trong phiếu. Thực lĩnh hiển thị theo kết quả backend; phụ cấp, OT và phạt được đối chiếu riêng.</p>{record.reason && <div className="sf-feedback mt-4"><span>Lý do điều chỉnh: {record.reason}</span></div>}</div>; }
