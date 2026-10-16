import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanFace, Fingerprint, Edit, Lock } from 'lucide-react';
import { Employee } from '../../../types';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { isAnotherManager } from '../../../utils/permissionUtils';

interface EmployeeTableProps {
  filteredEmployees: Employee[];
  onOpenEdit: (emp: Employee) => void;
  onOpenStatusToggle: (emp: Employee) => void;
}

export const EmployeeTable: React.FC<EmployeeTableProps> = ({
  filteredEmployees,
  onOpenEdit,
  onOpenStatusToggle,
}) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const handleRowClick = (emp: Employee) => {
    if (isAnotherManager(emp, currentUser)) {
      showToast(
        `Quản lý không có quyền xem trang chi tiết của Quản lý khác (${emp.full_name})!`,
        'warning'
      );
      return;
    }
    navigate(`/app/manager/employee-detail?id=${emp.employee_id}`);
  };

  return (
    <div className="bg-white dark:bg-[#13162b] border border-slate-300 dark:border-[#28305c] rounded-xl overflow-hidden shadow-xs transition-colors">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse table-fixed min-w-[1000px]">
          <thead>
            <tr className="border-b-2 border-slate-300 dark:border-[#28305c] bg-slate-200 dark:bg-[#0c0f1f] text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider font-mono">
              <th className="py-4 px-5 border-r border-slate-300 dark:border-[#222956] text-center w-[230px]">Nhân sự</th>
              <th className="py-4 px-4 border-r border-slate-300 dark:border-[#222956] text-center w-[110px]">Mã NV</th>
              <th className="py-4 px-4 border-r border-slate-300 dark:border-[#222956] text-center w-[180px]">Chức vụ & Phòng ban</th>
              <th className="py-4 px-4 border-r border-slate-300 dark:border-[#222956] text-center w-[210px]">Liên hệ</th>
              <th className="py-4 px-4 border-r border-slate-300 dark:border-[#222956] text-center w-[120px]">Sinh trắc AI</th>
              <th className="py-4 px-4 border-r border-slate-300 dark:border-[#222956] text-center w-[140px]">Lương theo giờ</th>
              <th className="py-4 px-4 border-r border-slate-300 dark:border-[#222956] text-center w-[120px]">Trạng thái</th>
              <th className="py-4 px-5 text-center font-bold w-[100px]">Thao tác</th>
            </tr>
          </thead>
          <tbody className="text-slate-700 dark:text-slate-300">
            {filteredEmployees.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-slate-500">
                  Không tìm thấy nhân viên nào phù hợp.
                </td>
              </tr>
            ) : (
              filteredEmployees.map((emp) => {
                const restricted = isAnotherManager(emp, currentUser);

                return (
                  <tr
                    key={emp.employee_id}
                    className="hover:bg-purple-50/40 dark:hover:bg-[#181c38]/50 transition-colors border-b border-slate-200 dark:border-[#202752]"
                  >
                    {/* Employee Profile */}
                    <td className="py-4 px-5 border-r border-slate-200 dark:border-[#202752]">
                      <div
                        onClick={() => handleRowClick(emp)}
                        className={`flex items-center gap-3.5 group min-w-0 ${
                          restricted ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'
                        }`}
                        title={
                          restricted
                            ? `Quản lý khác (${emp.full_name}) - Không có quyền xem chi tiết`
                            : emp.full_name
                        }
                      >
                        <div className="relative shrink-0">
                          <img
                            src={
                              emp.avatar ||
                              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'
                            }
                            alt={emp.full_name}
                            className={`w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-[#272d5a] transition-all shadow-xs ${
                              restricted ? 'grayscale-25' : 'group-hover:border-purple-500'
                            }`}
                          />
                          {restricted && (
                            <span
                              className="absolute -bottom-1 -right-1 bg-amber-500 text-white rounded-full p-0.5 shadow-xs"
                              title="Quản lý khác (Bị giới hạn quyền)"
                            >
                              <Lock className="w-2.5 h-2.5" />
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p
                              className={`font-bold text-xs sm:text-sm truncate ${
                                restricted
                                  ? 'text-slate-800 dark:text-slate-200'
                                  : 'text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors'
                              }`}
                              title={emp.full_name}
                            >
                              {emp.full_name}
                            </p>
                            {restricted && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-1 py-0.2 rounded border border-amber-300/80 dark:border-amber-800/40">
                                Quản lý khác
                              </span>
                            )}
                          </div>
                          <p
                            className="text-[11px] text-slate-400 dark:text-slate-500 font-mono truncate"
                            title={`Ngày vào: ${new Date(emp.created_at).toLocaleDateString('vi-VN')}`}
                          >
                            Ngày vào: {new Date(emp.created_at).toLocaleDateString('vi-VN')}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* ID */}
                    <td className="py-4 px-4 font-mono font-bold text-purple-600 dark:text-purple-400 border-r border-slate-200 dark:border-[#202752] text-center">
                      {restricted ? (
                        <span
                          className="bg-slate-100 dark:bg-[#181c38] text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700/60 text-xs inline-flex items-center gap-1 cursor-not-allowed"
                          title="Không có quyền xem chi tiết quản lý khác"
                        >
                          <Lock className="w-3 h-3 text-slate-400" />
                          <span>{emp.employee_id}</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRowClick(emp)}
                          className="hover:underline cursor-pointer bg-purple-50 dark:bg-purple-500/10 px-2 py-0.5 rounded-lg border border-purple-200/80 dark:border-purple-500/20 max-w-full truncate inline-block"
                          title={emp.employee_id}
                        >
                          {emp.employee_id}
                        </button>
                      )}
                    </td>

                    {/* Department & Position */}
                    <td className="py-4 px-4 border-r border-slate-200 dark:border-[#202752] text-center">
                      <p className="font-semibold text-slate-900 dark:text-white truncate" title={emp.position || ''}>
                        {emp.position}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate" title={emp.department || ''}>
                        {emp.department}
                      </p>
                    </td>

                    {/* Contact */}
                    <td className="py-4 px-4 font-mono text-[11px] border-r border-slate-200 dark:border-[#202752] text-center">
                      <p className="text-slate-800 dark:text-slate-200 font-medium truncate" title={emp.email || ''}>
                        {emp.email}
                      </p>
                      <p className="text-slate-400 dark:text-slate-500 truncate" title={emp.phone || ''}>
                        {emp.phone}
                      </p>
                    </td>

                    {/* Biometrics */}
                    <td className="py-4 px-4 border-r border-slate-200 dark:border-[#202752] text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          disabled={restricted}
                          onClick={() => {
                            if (restricted) return;
                            navigate(`/app/manager/biometrics?employee_id=${emp.employee_id}`);
                          }}
                          title={
                            restricted
                              ? 'Không có quyền truy cập sinh trắc học của quản lý khác'
                              : emp.face_enrolled
                              ? 'Face ID: Đã đăng ký (Bấm để cập nhật)'
                              : 'Face ID: Chưa đăng ký (Bấm để đăng ký)'
                          }
                          className={`p-1.5 rounded-lg border transition-all ${
                            restricted
                              ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-[#181c38] text-slate-400 border-slate-200 dark:border-slate-800'
                              : emp.face_enrolled
                              ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/30 hover:bg-purple-100 dark:hover:bg-purple-500/20 shadow-xs cursor-pointer hover:scale-105'
                              : 'bg-slate-100 dark:bg-[#181c38] text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700/50 hover:bg-slate-200 dark:hover:bg-[#20254b] hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer hover:scale-105'
                          }`}
                        >
                          <ScanFace className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={restricted}
                          onClick={() => {
                            if (restricted) return;
                            navigate(
                              `/app/manager/biometrics?employee_id=${emp.employee_id}&tab=fingerprint`
                            );
                          }}
                          title={
                            restricted
                              ? 'Không có quyền truy cập sinh trắc học của quản lý khác'
                              : emp.fingerprint_enrolled
                              ? 'Vân tay: Đã đăng ký (Bấm để cập nhật)'
                              : 'Vân tay: Chưa đăng ký (Bấm để đăng ký)'
                          }
                          className={`p-1.5 rounded-lg border transition-all ${
                            restricted
                              ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-[#181c38] text-slate-400 border-slate-200 dark:border-slate-800'
                              : emp.fingerprint_enrolled
                              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 shadow-xs cursor-pointer hover:scale-105'
                              : 'bg-slate-100 dark:bg-[#181c38] text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700/50 hover:bg-slate-200 dark:hover:bg-[#20254b] hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer hover:scale-105'
                          }`}
                        >
                          <Fingerprint className="w-4 h-4" />
                        </button>
                      </div>
                    </td>

                    {/* Hourly Rate */}
                    <td className="py-4 px-4 font-mono text-slate-900 dark:text-white font-semibold text-xs border-r border-slate-200 dark:border-[#202752] text-center">
                      {(emp.hourly_rate ?? 0).toLocaleString('vi-VN')} ₫
                    </td>

                    {/* Status Toggle */}
                    <td className="py-4 px-4 border-r border-slate-200 dark:border-[#202752] text-center">
                      <button
                        type="button"
                        disabled={restricted}
                        onClick={() => {
                          if (restricted) return;
                          onOpenStatusToggle(emp);
                        }}
                        title={restricted ? 'Không có quyền thay đổi trạng thái quản lý khác' : undefined}
                        className={`px-3 py-1 rounded-full text-[10px] font-bold font-mono transition-all ${
                          restricted
                            ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-[#181c38] text-slate-400 border border-slate-200 dark:border-slate-700'
                            : emp.status === 'ACTIVE'
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 cursor-pointer'
                            : 'bg-slate-100 dark:bg-[#181c38] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-[#272d5a] hover:bg-slate-200 cursor-pointer'
                        }`}
                      >
                        {emp.status === 'ACTIVE' ? 'HOẠT ĐỘNG' : 'TẠM NGƯNG'}
                      </button>
                    </td>

                    {/* Action */}
                    <td className="py-4 px-5 text-center">
                      <button
                        type="button"
                        disabled={restricted}
                        onClick={() => {
                          if (restricted) return;
                          onOpenEdit(emp);
                        }}
                        title={restricted ? 'Không có quyền chỉnh sửa quản lý khác' : undefined}
                        className={`px-3.5 py-1.5 rounded-xl border font-medium text-xs inline-flex items-center gap-1.5 transition-all shadow-xs ${
                          restricted
                            ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-[#181c38] text-slate-400 border-slate-200 dark:border-slate-800'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-[#181c38] dark:hover:bg-[#20254b] dark:text-slate-200 border-slate-200 dark:border-[#272d5a] cursor-pointer'
                        }`}
                      >
                        <Edit className="w-3.5 h-3.5 text-slate-400" />
                        <span>Sửa</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
