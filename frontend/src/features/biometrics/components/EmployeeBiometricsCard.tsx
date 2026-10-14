import React from 'react';
import { ScanFace, Fingerprint } from 'lucide-react';
import { Employee } from '../../../types';

interface EmployeeBiometricsCardProps {
  employees: Employee[];
  selectedEmpId: string;
  onSelectEmployee: (empId: string) => void;
  currentEmp?: Employee;
}

export const EmployeeBiometricsCard: React.FC<EmployeeBiometricsCardProps> = ({
  employees,
  selectedEmpId,
  onSelectEmployee,
  currentEmp,
}) => {
  return (
    <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-xl p-5 shadow-xs transition-colors">
      <h2 className="text-sm font-bold text-slate-900 dark:text-white font-heading uppercase tracking-wider mb-4">
        Chọn Nhân Sự Cần Cập Nhật
      </h2>

      <div className="mb-4">
        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5 font-semibold">
          Danh sách nhân viên:
        </label>
        <select
          value={selectedEmpId}
          onChange={(e) => onSelectEmployee(e.target.value)}
          className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 cursor-pointer"
        >
          {employees.map((emp) => (
            <option key={emp.employee_id} value={emp.employee_id}>
              {emp.employee_id} - {emp.full_name} ({emp.department})
            </option>
          ))}
        </select>
      </div>

      {/* Selected Employee Card */}
      {currentEmp && (
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200/80 dark:border-[#21264b] space-y-4">
          <div className="flex items-center gap-3">
            <img
              src={
                currentEmp.avatar ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120'
              }
              alt={currentEmp.full_name}
              className="w-14 h-14 rounded-xl object-cover border border-purple-200 dark:border-purple-800"
            />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {currentEmp.full_name}
              </h3>
              <p className="text-xs text-purple-600 dark:text-purple-400 font-mono">
                {currentEmp.employee_id}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {currentEmp.department} • {currentEmp.position}
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200/60 dark:border-[#21264b] space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <ScanFace className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                Face ID:
              </span>
              <span
                className={`font-mono text-[11px] px-2 py-0.5 rounded-md font-semibold ${
                  currentEmp.face_enrolled
                    ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-700/50'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50'
                }`}
              >
                {currentEmp.face_enrolled ? 'ĐÃ CẬP NHẬT' : 'CHƯA ĐĂNG KÝ'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Fingerprint className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Vân tay (FAP30):
              </span>
              <span
                className={`font-mono text-[11px] px-2 py-0.5 rounded-md font-semibold ${
                  currentEmp.fingerprint_enrolled
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50'
                }`}
              >
                {currentEmp.fingerprint_enrolled ? 'ĐÃ CẬP NHẬT' : 'CHƯA ĐĂNG KÝ'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
