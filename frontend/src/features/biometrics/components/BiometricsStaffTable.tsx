import React from 'react';
import { Search, ChevronDown, Edit } from 'lucide-react';
import { Employee } from '../../../types';

interface BiometricsStaffTableProps {
  employees: Employee[];
  filteredEmployees: Employee[];
  searchTerm: string;
  onSearchChange: (val: string) => void;
  positionFilter: string;
  onPositionFilterChange: (val: string) => void;
  positions: string[];
  onOpenManageModal: (emp: Employee) => void;
}

export const BiometricsStaffTable: React.FC<BiometricsStaffTableProps> = ({
  employees,
  filteredEmployees,
  searchTerm,
  onSearchChange,
  positionFilter,
  onPositionFilterChange,
  positions,
  onOpenManageModal,
}) => {
  return (
    <div className="bg-white dark:bg-[#13162b] border border-slate-300 dark:border-[#28305c] rounded-xl overflow-hidden shadow-xs transition-colors">
      {/* Top Bar 1: Toolbar Header */}
      <div className="p-4 sm:p-5 bg-slate-100 dark:bg-[#0c0f1f] border-b-2 border-slate-300 dark:border-[#28305c] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-white font-heading">
            Danh Sách Trạng Thái Sinh Trắc Học Nhân Viên
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Search by Employee */}
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm tên, mã NV..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-white dark:bg-[#13162b] border border-slate-200 dark:border-[#272d5a] rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Position Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
              Chức vụ:
            </span>
            <div className="relative">
              <select
                value={positionFilter}
                onChange={(e) => onPositionFilterChange(e.target.value)}
                className="bg-white dark:bg-[#13162b] border border-slate-200 dark:border-[#272d5a] rounded-xl pl-3 pr-8 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 appearance-none cursor-pointer"
              >
                <option value="ALL">Tất cả chức vụ</option>
                {positions.map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Bar 2: Table Section */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse table-fixed min-w-[950px]">
          <thead>
            <tr className="border-b-2 border-slate-300 dark:border-[#28305c] bg-slate-200 dark:bg-[#0c0f1f] text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider font-mono">
              <th className="py-4 px-5 w-[240px] border-r border-slate-300 dark:border-[#222956] text-center">Nhân sự</th>
              <th className="py-4 px-4 w-[130px] border-r border-slate-300 dark:border-[#222956] text-center">Mã NV</th>
              <th className="py-4 px-4 w-[180px] border-r border-slate-300 dark:border-[#222956] text-center">Chức vụ</th>
              <th className="py-4 px-4 w-[160px] border-r border-slate-300 dark:border-[#222956] text-center">Khuôn mặt (Face ID)</th>
              <th className="py-4 px-4 w-[160px] border-r border-slate-300 dark:border-[#222956] text-center">Vân tay (FAP30)</th>
              <th className="py-4 px-5 w-[100px] text-center font-bold">Thao tác</th>
            </tr>
          </thead>
          <tbody className="text-slate-700 dark:text-slate-300">
            {filteredEmployees.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-slate-500">
                  Không tìm thấy nhân sự phù hợp với bộ lọc
                </td>
              </tr>
            ) : (
              filteredEmployees.map((emp) => (
                <tr
                  key={emp.employee_id}
                  className="hover:bg-purple-50/40 dark:hover:bg-[#181c38]/50 transition-colors border-b border-slate-200 dark:border-[#202752]"
                >
                  <td className="py-4 px-5 border-r border-slate-200 dark:border-[#202752] max-w-[240px]">
                    <div className="flex items-center gap-3.5 min-w-0" title={emp.full_name}>
                      <img
                        src={
                          emp.avatar ||
                          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'
                        }
                        alt={emp.full_name}
                        className="w-9 h-9 rounded-full object-cover border border-purple-200 dark:border-[#272d5a] shrink-0"
                      />
                      <span className="font-semibold text-slate-900 dark:text-white truncate flex-1" title={emp.full_name}>
                        {emp.full_name}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4 border-r border-slate-200 dark:border-[#202752] text-center">
                    <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-700/50 truncate inline-block max-w-full" title={emp.employee_id}>
                      {emp.employee_id}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-slate-700 dark:text-slate-300 font-medium border-r border-slate-200 dark:border-[#202752] text-center max-w-[180px]">
                    <span className="truncate block" title={emp.position || emp.department || ''}>
                      {emp.position || emp.department}
                    </span>
                  </td>
                  <td className="py-4 px-4 border-r border-slate-200 dark:border-[#202752] text-center">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono ${emp.face_enrolled
                        ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-700/50'
                        : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50'
                        }`}
                    >
                      {emp.face_enrolled ? 'ĐÃ ĐĂNG KÝ' : 'CHƯA ĐĂNG KÝ'}
                    </span>
                  </td>
                  <td className="py-4 px-4 border-r border-slate-200 dark:border-[#202752] text-center">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono ${emp.fingerprint_enrolled
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
                        : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50'
                        }`}
                    >
                      {emp.fingerprint_enrolled ? 'ĐÃ ĐĂNG KÝ' : 'CHƯA ĐĂNG KÝ'}
                    </span>
                  </td>
                  <td className="py-4 px-5 text-center">
                    <button
                      type="button"
                      onClick={() => onOpenManageModal(emp)}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-[#181c38] dark:hover:bg-[#20254b] dark:text-slate-200 border border-slate-200 dark:border-[#272d5a] font-medium text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                    >
                      <Edit className="w-3.5 h-3.5 text-slate-400" />
                      <span>Sửa</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
