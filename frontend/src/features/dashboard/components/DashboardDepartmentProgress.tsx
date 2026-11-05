import React from 'react';
import { Users } from 'lucide-react';
import type {
  DashboardDepartmentProgressItem,
  DashboardEmployeeShiftItem,
} from '../api/dashboardApi';

interface DashboardDepartmentProgressProps {
  isAdmin: boolean;
  departmentProgress: DashboardDepartmentProgressItem[];
  employeeList: DashboardEmployeeShiftItem[];
}

export const DashboardDepartmentProgress: React.FC<DashboardDepartmentProgressProps> = ({
  isAdmin,
  departmentProgress,
  employeeList,
}) => {
  const scheduledCount = employeeList.filter((e) => e.hasShift).length;

  return (
    <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-2xl p-5 flex flex-col justify-between shadow-xs transition-colors h-full">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-purple-500" />
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">
            Nhân viên
          </h3>
          {!isAdmin && (
            <span className="ml-auto text-[11px] font-mono text-slate-400 dark:text-slate-500">
              {scheduledCount}/{employeeList.length} có ca
            </span>
          )}
        </div>

        {isAdmin ? (
          <div className="space-y-3 max-h-[195px] overflow-y-auto pr-1">
            {departmentProgress.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                Chưa có dữ liệu phòng ban hôm nay
              </p>
            ) : (
              departmentProgress.map((dept, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: dept.color }}
                      ></span>
                      {dept.name}
                    </span>
                    <span className="font-mono text-slate-600 dark:text-slate-400 font-semibold">
                      {dept.scheduled}/{dept.total}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-[#1f244a] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${dept.pct}%`,
                        backgroundColor: dept.color,
                      }}
                    ></div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[245px] overflow-y-auto pr-1">
            {employeeList.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                Chưa có dữ liệu nhân viên
              </p>
            ) : (
              employeeList.map((emp) => {
                const initials = (emp.fullName || emp.employeeId)
                  .split(' ')
                  .map((w: string) => w[0])
                  .slice(-2)
                  .join('');

                return (
                  <div
                    key={emp.employeeId}
                    className={`flex items-center justify-between p-2 rounded-xl transition-colors ${
                      emp.hasShift
                        ? 'bg-slate-50/80 dark:bg-[#181c38]/60 border border-slate-200/50 dark:border-[#22274d]'
                        : 'bg-transparent border border-transparent opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-full ${
                          emp.hasShift
                            ? 'bg-blue-100 dark:bg-[#1f254b] text-blue-700 dark:text-blue-300'
                            : 'bg-slate-100 dark:bg-[#161a33] text-slate-400 dark:text-slate-500'
                        } font-bold flex items-center justify-center text-xs shrink-0 overflow-hidden`}
                      >
                        {emp.avatar ? (
                          <img
                            src={emp.avatar}
                            alt={emp.fullName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          initials
                        )}
                      </div>
                      <div className="min-w-0">
                        <p
                          className={`text-xs truncate ${
                            emp.hasShift
                              ? 'font-bold text-slate-900 dark:text-white'
                              : 'font-normal text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          {emp.fullName}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate">
                          {emp.employeeId}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 ml-2">
                      {emp.hasShift ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          {emp.shiftName}
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#1a1f3d] text-slate-400 dark:text-slate-500">
                          Nghỉ ca
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};
