import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanFace, Fingerprint, Edit } from 'lucide-react';
import { Employee } from '../../../types';

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

  return (
    <div className="bg-white dark:bg-[#13162b] border border-slate-300 dark:border-[#28305c] rounded-xl overflow-hidden shadow-xs transition-colors">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-300 dark:border-[#28305c] bg-slate-200 dark:bg-[#0c0f1f] text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider font-mono">
              <th className="py-4 px-5 border-r border-slate-300 dark:border-[#222956] text-center">Nhân sự</th>
              <th className="py-4 px-4 border-r border-slate-300 dark:border-[#222956] text-center">Mã NV</th>
              <th className="py-4 px-4 border-r border-slate-300 dark:border-[#222956] text-center">Chức vụ & Phòng ban</th>
              <th className="py-4 px-4 border-r border-slate-300 dark:border-[#222956] text-center">Liên hệ</th>
              <th className="py-4 px-4 border-r border-slate-300 dark:border-[#222956] text-center">Sinh trắc AI</th>
              <th className="py-4 px-4 border-r border-slate-300 dark:border-[#222956] text-center">Lương / giờ (VNĐ)</th>
              <th className="py-4 px-4 border-r border-slate-300 dark:border-[#222956] text-center">Trạng thái</th>
              <th className="py-4 px-5 text-center font-bold">Thao tác</th>
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
              filteredEmployees.map((emp) => (
                <tr
                  key={emp.employee_id}
                  className="hover:bg-purple-50/40 dark:hover:bg-[#181c38]/50 transition-colors border-b border-slate-200 dark:border-[#202752]"
                >
                  {/* Employee Profile */}
                  <td className="py-4 px-5 border-r border-slate-200 dark:border-[#202752]">
                    <div
                      onClick={() => navigate(`/app/manager/employee-detail?id=${emp.employee_id}`)}
                      className="flex items-center gap-3.5 cursor-pointer group"
                      title="Bấm để xem hồ sơ chi tiết"
                    >
                      <img
                        src={
                          emp.avatar ||
                          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'
                        }
                        alt={emp.full_name}
                        className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-[#272d5a] group-hover:border-purple-500 transition-all shadow-xs"
                      />
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors text-xs sm:text-sm">
                          {emp.full_name}
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                          Ngày vào: {new Date(emp.created_at).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* ID */}
                  <td className="py-4 px-4 font-mono font-bold text-purple-600 dark:text-purple-400 border-r border-slate-200 dark:border-[#202752] text-center">
                    <button
                      type="button"
                      onClick={() => navigate(`/app/manager/employee-detail?id=${emp.employee_id}`)}
                      className="hover:underline cursor-pointer bg-purple-50 dark:bg-purple-500/10 px-2 py-0.5 rounded-lg border border-purple-200/80 dark:border-purple-500/20"
                      title="Bấm để xem chi tiết"
                    >
                      {emp.employee_id}
                    </button>
                  </td>

                  {/* Department & Position */}
                  <td className="py-4 px-4 border-r border-slate-200 dark:border-[#202752] text-center">
                    <p className="font-semibold text-slate-900 dark:text-white">{emp.position}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {emp.department}
                    </p>
                  </td>

                  {/* Contact */}
                  <td className="py-4 px-4 font-mono text-[11px] border-r border-slate-200 dark:border-[#202752] text-center">
                    <p className="text-slate-800 dark:text-slate-200 font-medium">{emp.email}</p>
                    <p className="text-slate-400 dark:text-slate-500">{emp.phone}</p>
                  </td>

                  {/* Biometrics */}
                  <td className="py-4 px-4 border-r border-slate-200 dark:border-[#202752] text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          navigate(`/app/manager/biometrics?employee_id=${emp.employee_id}`)
                        }
                        title={
                          emp.face_enrolled
                            ? 'Face ID: Đã đăng ký (Bấm để cập nhật)'
                            : 'Face ID: Chưa đăng ký (Bấm để đăng ký)'
                        }
                        className={`p-1.5 rounded-lg border transition-all cursor-pointer hover:scale-105 ${
                          emp.face_enrolled
                            ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/30 hover:bg-purple-100 dark:hover:bg-purple-500/20 shadow-xs'
                            : 'bg-slate-100 dark:bg-[#181c38] text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700/50 hover:bg-slate-200 dark:hover:bg-[#20254b] hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                      >
                        <ScanFace className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            `/app/manager/biometrics?employee_id=${emp.employee_id}&tab=fingerprint`
                          )
                        }
                        title={
                          emp.fingerprint_enrolled
                            ? 'Vân tay: Đã đăng ký (Bấm để cập nhật)'
                            : 'Vân tay: Chưa đăng ký (Bấm để đăng ký)'
                        }
                        className={`p-1.5 rounded-lg border transition-all cursor-pointer hover:scale-105 ${
                          emp.fingerprint_enrolled
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 shadow-xs'
                            : 'bg-slate-100 dark:bg-[#181c38] text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700/50 hover:bg-slate-200 dark:hover:bg-[#20254b] hover:text-slate-700 dark:hover:text-slate-300'
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
                      onClick={() => onOpenStatusToggle(emp)}
                      className={`px-3 py-1 rounded-full text-[10px] font-bold font-mono transition-all cursor-pointer ${
                        emp.status === 'ACTIVE'
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100'
                          : 'bg-slate-100 dark:bg-[#181c38] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-[#272d5a] hover:bg-slate-200'
                      }`}
                    >
                      {emp.status === 'ACTIVE' ? 'HOẠT ĐỘNG' : 'TẠM NGƯNG'}
                    </button>
                  </td>

                  {/* Action */}
                  <td className="py-4 px-5 text-center">
                    <button
                      type="button"
                      onClick={() => onOpenEdit(emp)}
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
