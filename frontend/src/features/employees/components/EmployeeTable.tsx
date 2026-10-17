import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanFace, Fingerprint, Lock } from 'lucide-react';
import { Employee } from '../../../types';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { isAnotherManager } from '../../../utils/permissionUtils';
import {
  TableContainer,
  TableHead,
  TableHeadRow,
  TableHeadCell,
  TableBody,
  TableRow,
  TableCell,
  TableEmpty,
  CodeBadge,
  StatusBadge,
  ActionEditButton,
} from '../../../components/common';

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
    <TableContainer minWidth="1000px">
      <TableHead>
        <TableHeadRow>
          <TableHeadCell width="230px" align="left">Nhân viên</TableHeadCell>
          <TableHeadCell width="110px">Mã NV</TableHeadCell>
          <TableHeadCell width="180px">Phòng ban & Chức vụ</TableHeadCell>
          <TableHeadCell width="210px">Liên hệ</TableHeadCell>
          <TableHeadCell width="120px">Sinh trắc AI</TableHeadCell>
          <TableHeadCell width="140px">Lương theo giờ</TableHeadCell>
          <TableHeadCell width="120px">Trạng thái</TableHeadCell>
          <TableHeadCell width="100px" isLast>Thao tác</TableHeadCell>
        </TableHeadRow>
      </TableHead>
      <TableBody>
        {filteredEmployees.length === 0 ? (
          <TableEmpty colSpan={8} message="Không tìm thấy nhân viên nào phù hợp." />
        ) : (
          filteredEmployees.map((emp) => {
            const restricted = isAnotherManager(emp, currentUser);

            return (
              <TableRow key={emp.employee_id}>
                {/* Employee Profile */}
                <TableCell align="left" className="px-5">
                  <div
                    onClick={() => handleRowClick(emp)}
                    className={`flex items-center gap-3.5 group min-w-0 text-left ${restricted ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'
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
                            className={`w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-[#272d5a] transition-all shadow-xs ${restricted ? 'grayscale-25' : 'group-hover:border-purple-500'
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
                              className={`font-bold text-xs sm:text-sm truncate ${restricted
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
                    </TableCell>

                    {/* ID */}
                    <TableCell>
                      {restricted ? (
                        <CodeBadge variant="slate" title="Không có quyền xem chi tiết quản lý khác">
                          <Lock className="w-3 h-3 text-slate-400" />
                          <span>{emp.employee_id}</span>
                        </CodeBadge>
                      ) : (
                        <CodeBadge
                          variant="purple"
                          onClick={() => handleRowClick(emp)}
                          title={emp.employee_id}
                        >
                          {emp.employee_id}
                        </CodeBadge>
                      )}
                    </TableCell>

                    {/* Department & Position */}
                    <TableCell>
                      <p className="font-semibold text-slate-900 dark:text-white truncate" title={emp.department || ''}>
                        {emp.department}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate" title={emp.position || ''}>
                        {emp.position}
                      </p>
                    </TableCell>

                    {/* Contact */}
                    <TableCell className="font-mono text-[11px]">
                      <p className="text-slate-800 dark:text-slate-200 font-medium truncate" title={emp.email || ''}>
                        {emp.email}
                      </p>
                      <p className="text-slate-400 dark:text-slate-500 truncate" title={emp.phone || ''}>
                        {emp.phone}
                      </p>
                    </TableCell>

                    {/* Biometrics */}
                    <TableCell>
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
                          className={`p-1.5 rounded-lg border transition-all ${restricted
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
                          className={`p-1.5 rounded-lg border transition-all ${restricted
                            ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-[#181c38] text-slate-400 border-slate-200 dark:border-slate-800'
                            : emp.fingerprint_enrolled
                              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 shadow-xs cursor-pointer hover:scale-105'
                              : 'bg-slate-100 dark:bg-[#181c38] text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700/50 hover:bg-slate-200 dark:hover:bg-[#20254b] hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer hover:scale-105'
                            }`}
                        >
                          <Fingerprint className="w-4 h-4" />
                        </button>
                      </div>
                    </TableCell>

                    {/* Hourly Rate */}
                    <TableCell className="font-mono text-slate-900 dark:text-white font-semibold text-xs">
                      {(emp.hourly_rate ?? 0).toLocaleString('vi-VN')} ₫
                    </TableCell>

                    {/* Status Toggle */}
                    <TableCell>
                      <StatusBadge
                        status={emp.status}
                        disabled={restricted}
                        onClick={() => {
                          if (restricted) return;
                          onOpenStatusToggle(emp);
                        }}
                        title={restricted ? 'Không có quyền thay đổi trạng thái quản lý khác' : undefined}
                      />
                    </TableCell>

                    {/* Action */}
                    <TableCell isLast>
                      <ActionEditButton
                        disabled={restricted}
                        onClick={() => {
                          if (restricted) return;
                          onOpenEdit(emp);
                        }}
                        title={restricted ? 'Không có quyền chỉnh sửa quản lý khác' : undefined}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
      </TableBody>
    </TableContainer>
  );
};
