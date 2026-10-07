import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import {
  Search,
  Filter,
  Plus,
  Edit,
  ScanFace,
  Fingerprint,
  Briefcase,
  AlertTriangle,
  X
} from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { PositionManagementModal } from '../../components/employees/PositionManagementModal';
import { PositionItem, fetchPositionsApi } from '../../api/positionApi';
import { Employee } from '../../types';

function getNextEmployeeId(employeesList: Employee[]): string {
  const maxNum = employeesList.reduce((max, emp) => {
    const match = emp.employee_id.match(/NV-(\d+)/i);
    if (match) {
      const num = parseInt(match[1], 10);
      return num > max ? num : max;
    }
    return max;
  }, 0);
  return `NV-${String(maxNum + 1).padStart(3, '0')}`;
}

export const ManagerEmployeeList: React.FC = () => {
  const { employees, addEmployee, updateEmployee, deleteEmployee, toggleEmployeeStatus, showToast } = useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const querySearch = searchParams.get('search') || '';

  const [searchTerm, setSearchTerm] = useState(querySearch);
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Position Management Modal State
  const [positionModalOpen, setPositionModalOpen] = useState(false);
  const [dbPositions, setDbPositions] = useState<PositionItem[]>([]);

  const loadDbPositions = async () => {
    try {
      const data = await fetchPositionsApi();
      setDbPositions(data);
    } catch {
      // Handled gracefully
    }
  };

  useEffect(() => {
    loadDbPositions();
  }, []);

  const positionOptions = useMemo(() => {
    const list = dbPositions.map(p => p.name);
    employees.forEach(e => {
      const pos = e.department || e.position;
      if (pos && !list.includes(pos)) {
        list.push(pos);
      }
    });
    if (list.length === 0) {
      return ['Bảo vệ', 'Nhân viên', 'Thu ngân', 'Quản lý'];
    }
    return list;
  }, [dbPositions, employees]);

  useEffect(() => {
    if (querySearch) {
      setSearchTerm(querySearch);
    }
  }, [querySearch]);

  // Modal States
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [confirmStatusEmployee, setConfirmStatusEmployee] = useState<Employee | null>(null);
  const [confirmDeleteEmployee, setConfirmDeleteEmployee] = useState<Employee | null>(null);

  // Form state for Add
  const [newEmp, setNewEmp] = useState(() => ({
    employee_id: getNextEmployeeId(employees),
    full_name: '',
    department: 'Nhân viên',
    position: 'Nhân viên bán hàng',
    phone: '',
    email: '',
    status: 'ACTIVE' as const,
    face_enrolled: false,
    fingerprint_enrolled: false,
    hourly_rate: 50000,
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
  }));

  const handleOpenAddModal = () => {
    setNewEmp(prev => ({
      ...prev,
      employee_id: getNextEmployeeId(employees)
    }));
    setAddModalOpen(true);
  };

  const filteredEmployees = employees.filter(emp => {
    const term = searchTerm.trim().toLowerCase();
    const matchSearch = !term ||
      emp.full_name.toLowerCase().includes(term) ||
      emp.employee_id.toLowerCase().includes(term) ||
      emp.email.toLowerCase().includes(term) ||
      emp.phone.toLowerCase().includes(term) ||
      emp.position.toLowerCase().includes(term) ||
      emp.department.toLowerCase().includes(term);

    const matchDept = departmentFilter === 'ALL' || emp.department === departmentFilter;
    const matchStatus = statusFilter === 'ALL' || emp.status === statusFilter;

    return matchSearch && matchDept && matchStatus;
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmp.full_name || !newEmp.email) {
      showToast('Vui lòng điền đầy đủ họ tên và email', 'error');
      return;
    }

    addEmployee(newEmp);
    setAddModalOpen(false);
    // Reset form with next ID
    const updatedEmployees = [...employees, { ...newEmp, id: newEmp.employee_id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }];
    setNewEmp({
      employee_id: getNextEmployeeId(updatedEmployees),
      full_name: '',
      department: 'Nhân viên',
      position: 'Nhân viên bán hàng',
      phone: '',
      email: '',
      status: 'ACTIVE',
      face_enrolled: false,
      fingerprint_enrolled: false,
      hourly_rate: 50000,
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editEmployee) return;

    updateEmployee(editEmployee.employee_id, {
      full_name: editEmployee.full_name,
      department: editEmployee.department,
      position: editEmployee.position,
      email: editEmployee.email,
      phone: editEmployee.phone,
      hourly_rate: editEmployee.hourly_rate,
      fingerprint_enrolled: editEmployee.fingerprint_enrolled,
    });
    setEditEmployee(null);
  };

  return (
    <div className="space-y-6">
      {/* Bento Header Banner with Continuous Shifting Gradient & Floating Blobs */}
      <div className="bento-hero-gradient rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all">
        {/* Ambient Floating & Morphing Blurred Blobs */}
        <div className="absolute -top-14 -right-10 w-72 h-72 bg-gradient-to-br from-purple-500/30 to-fuchsia-500/25 dark:from-purple-600/35 dark:to-fuchsia-600/25 rounded-full blur-3xl pointer-events-none animate-blob-1" />
        <div className="absolute -bottom-16 left-1/4 w-64 h-64 bg-gradient-to-tr from-indigo-500/30 to-blue-500/20 dark:from-indigo-600/30 dark:to-blue-600/20 rounded-full blur-3xl pointer-events-none animate-blob-2" />
        <div className="absolute top-1/4 right-1/3 w-48 h-48 bg-gradient-to-r from-violet-400/25 to-pink-400/25 dark:from-violet-500/25 dark:to-pink-500/20 rounded-full blur-2xl pointer-events-none animate-blob-3" />

        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-heading tracking-tight">
              Quản Lý Danh Sách Nhân Sự
            </h1>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Quản lý hồ sơ nhân viên, trạng thái kích hoạt và đăng ký sinh trắc học Face ID / Vân tay.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPositionModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-white/80 hover:bg-white text-slate-700 dark:bg-[#181c38]/90 dark:hover:bg-[#20254b] dark:text-slate-200 border border-purple-200/80 dark:border-[#272d5a] backdrop-blur-sm text-xs font-semibold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <Briefcase className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span>Quản lý chức vụ</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center gap-2 shadow-xs shadow-purple-500/25 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm nhân viên mới</span>
          </button>
        </div>
      </div>

      {/* Bento Filters and Search Bar */}
      <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-xl p-4 flex flex-col lg:flex-row items-center justify-between gap-4 shadow-xs transition-colors">
        <div className="relative w-full lg:w-96 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên, mã NV, email, vị trí, SĐT..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSearchParams({});
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 shrink-0 bg-slate-100 dark:bg-[#0f1224] px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-[#21264b]">
            {filteredEmployees.length} / {employees.length}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Filter className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>Chức vụ:</span>
          </div>
          <select
            value={departmentFilter}
            onChange={e => setDepartmentFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer"
          >
            <option value="ALL">Tất cả chức vụ</option>
            {positionOptions.map(pos => (
              <option key={pos} value={pos}>{pos}</option>
            ))}
          </select>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 ml-2">
            <span>Trạng thái:</span>
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hoạt động (ACTIVE)</option>
            <option value="INACTIVE">Tạm ngưng (INACTIVE)</option>
          </select>
        </div>
      </div>

      {/* Bento Employees Table */}
      <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-xl overflow-hidden shadow-xs transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 dark:bg-[#0f1224]/80 border-b border-slate-200/80 dark:border-[#21264b] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono text-[11px]">
              <tr>
                <th className="py-4 px-5 font-medium">Nhân sự</th>
                <th className="py-4 px-4 font-medium">Mã NV</th>
                <th className="py-4 px-4 font-medium">Chức vụ & Phòng ban</th>
                <th className="py-4 px-4 font-medium">Liên hệ</th>
                <th className="py-4 px-4 font-medium">Sinh trắc AI</th>
                <th className="py-4 px-4 font-medium">Lương / giờ (VNĐ)</th>
                <th className="py-4 px-4 font-medium">Trạng thái</th>
                <th className="py-4 px-5 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1d2243] text-slate-700 dark:text-slate-300">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    Không tìm thấy nhân viên nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map(emp => (
                  <tr key={emp.employee_id} className="hover:bg-purple-50/40 dark:hover:bg-[#181c38]/50 transition-colors">
                    {/* Employee Profile */}
                    <td className="py-4 px-5">
                      <div
                        onClick={() => navigate(`/app/manager/employee-detail?id=${emp.employee_id}`)}
                        className="flex items-center gap-3.5 cursor-pointer group"
                        title="Bấm để xem hồ sơ chi tiết"
                      >
                        <img
                          src={emp.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"}
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
                    <td className="py-4 px-4 font-mono font-bold text-purple-600 dark:text-purple-400">
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
                    <td className="py-4 px-4">
                      <p className="font-semibold text-slate-900 dark:text-white">{emp.position}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{emp.department}</p>
                    </td>

                    {/* Contact */}
                    <td className="py-4 px-4 font-mono text-[11px]">
                      <p className="text-slate-800 dark:text-slate-200 font-medium">{emp.email}</p>
                      <p className="text-slate-400 dark:text-slate-500">{emp.phone}</p>
                    </td>

                    {/* Biometrics */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/app/manager/biometrics?employee_id=${emp.employee_id}`)}
                          title={emp.face_enrolled ? "Face ID: Đã đăng ký (Bấm để cập nhật)" : "Face ID: Chưa đăng ký (Bấm để đăng ký)"}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer hover:scale-105 ${emp.face_enrolled
                            ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/30 hover:bg-purple-100 dark:hover:bg-purple-500/20 shadow-xs'
                            : 'bg-slate-100 dark:bg-[#181c38] text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700/50 hover:bg-slate-200 dark:hover:bg-[#20254b] hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                        >
                          <ScanFace className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/app/manager/biometrics?employee_id=${emp.employee_id}&tab=fingerprint`)}
                          title={emp.fingerprint_enrolled ? "Vân tay: Đã đăng ký (Bấm để cập nhật)" : "Vân tay: Chưa đăng ký (Bấm để đăng ký)"}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer hover:scale-105 ${emp.fingerprint_enrolled
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 shadow-xs'
                            : 'bg-slate-100 dark:bg-[#181c38] text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700/50 hover:bg-slate-200 dark:hover:bg-[#20254b] hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                        >
                          <Fingerprint className="w-4 h-4" />
                        </button>
                      </div>
                    </td>

                    {/* Hourly Rate */}
                    <td className="py-4 px-4 font-mono text-slate-900 dark:text-white font-semibold text-xs">
                      {((emp.hourly_rate ?? 0)).toLocaleString('vi-VN')} ₫
                    </td>

                    {/* Status Toggle */}
                    <td className="py-4 px-4">
                      <button
                        type="button"
                        onClick={() => setConfirmStatusEmployee(emp)}
                        className={`px-3 py-1 rounded-full text-[10px] font-bold font-mono transition-all cursor-pointer ${emp.status === 'ACTIVE'
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100'
                          : 'bg-slate-100 dark:bg-[#181c38] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-[#272d5a] hover:bg-slate-200'
                          }`}
                      >
                        {emp.status === 'ACTIVE' ? 'HOẠT ĐỘNG' : 'TẠM NGƯNG'}
                      </button>
                    </td>

                    {/* Action */}
                    <td className="py-4 px-5 text-right">
                      <button
                        type="button"
                        onClick={() => setEditEmployee(emp)}
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

      {/* Modal Add Employee */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Thêm nhân viên mới vào hệ thống"
        subtitle="Thông tin sẽ được đồng bộ ngay vào máy quét khuôn mặt AIoT"
        maxWidth="lg"
      >
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Mã nhân viên (ID)</label>
              <input
                type="text"
                required
                readOnly
                value={newEmp.employee_id}
                className="w-full px-3 py-2 bg-slate-100 dark:bg-[#0f1224]/60 border border-slate-200 dark:border-[#21264b] rounded-xl text-xs text-slate-500 dark:text-slate-400 font-mono cursor-not-allowed select-none focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Họ và tên</label>
              <input
                type="text"
                required
                placeholder="Ví dụ: Hoàng Minh Trí"
                value={newEmp.full_name}
                onChange={e => setNewEmp({ ...newEmp, full_name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Chức vụ</label>
              <select
                value={newEmp.department}
                onChange={e => setNewEmp({ ...newEmp, department: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white cursor-pointer focus:outline-none focus:border-purple-500"
              >
                {positionOptions.map(pos => (
                  <option key={pos} value={pos}>{pos}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Chức danh / Vị trí</label>
              <input
                type="text"
                required
                value={newEmp.position}
                onChange={e => setNewEmp({ ...newEmp, position: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Email doanh nghiệp</label>
              <input
                type="email"
                required
                placeholder="tri.hoang@company.com"
                value={newEmp.email}
                onChange={e => setNewEmp({ ...newEmp, email: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Số điện thoại</label>
              <input
                type="text"
                required
                placeholder="0912.345.678"
                value={newEmp.phone}
                onChange={e => setNewEmp({ ...newEmp, phone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Lương theo giờ (VNĐ)</label>
              <input
                type="number"
                required
                step="1000"
                min="1000"
                placeholder="50000"
                value={newEmp.hourly_rate}
                onChange={e => setNewEmp({ ...newEmp, hourly_rate: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-200 dark:border-[#21264b]">
            <button
              type="button"
              onClick={() => setAddModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#181c38] transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-xs transition-all cursor-pointer"
            >
              Lưu nhân viên mới
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Edit Employee */}
      <Modal
        isOpen={Boolean(editEmployee)}
        onClose={() => setEditEmployee(null)}
        title={`Chỉnh sửa thông tin: ${editEmployee?.full_name}`}
        subtitle={`Mã nhân viên: ${editEmployee?.employee_id}`}
        maxWidth="lg"
      >
        {editEmployee && (
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Họ và tên</label>
                <input
                  type="text"
                  required
                  value={editEmployee.full_name}
                  onChange={e => setEditEmployee({ ...editEmployee, full_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Chức vụ</label>
                <select
                  value={editEmployee.department}
                  onChange={e => setEditEmployee({ ...editEmployee, department: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white cursor-pointer focus:outline-none focus:border-purple-500"
                >
                  {positionOptions.map(pos => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Chức danh</label>
                <input
                  type="text"
                  required
                  value={editEmployee.position}
                  onChange={e => setEditEmployee({ ...editEmployee, position: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Lương theo giờ (VNĐ)</label>
                <input
                  type="number"
                  required
                  step="1000"
                  min="1000"
                  value={editEmployee.hourly_rate}
                  onChange={e => setEditEmployee({ ...editEmployee, hourly_rate: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={editEmployee.email}
                  onChange={e => setEditEmployee({ ...editEmployee, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Số điện thoại</label>
                <input
                  type="text"
                  required
                  value={editEmployee.phone}
                  onChange={e => setEditEmployee({ ...editEmployee, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-[#21264b]">
              <button
                type="button"
                onClick={() => setEditEmployee(null)}
                className="px-4 py-2 rounded-xl text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#181c38] transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  const empToDelete = editEmployee;
                  setEditEmployee(null);
                  setConfirmDeleteEmployee(empToDelete);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 dark:bg-rose-600/20 dark:hover:bg-rose-600 dark:text-rose-300 dark:hover:text-white dark:border-rose-500/30 transition-all cursor-pointer"
              >
                Xóa nhân viên
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-xs transition-all cursor-pointer"
              >
                Xác nhận cập nhật thông tin
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Confirmation Modal for Delete Employee */}
      <Modal
        isOpen={Boolean(confirmDeleteEmployee)}
        onClose={() => setConfirmDeleteEmployee(null)}
        title="Xác nhận xóa vĩnh viễn nhân sự"
        subtitle={`Nhân sự: ${confirmDeleteEmployee?.full_name} (${confirmDeleteEmployee?.employee_id})`}
        maxWidth="md"
      >
        {confirmDeleteEmployee && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-xs text-slate-700 dark:text-slate-300 space-y-3">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-300 font-bold">
                <AlertTriangle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />
                <span>CẢNH BÁO: XÓA VĨNH VIỄN KHỎI CƠ SỞ DỮ LIỆU</span>
              </div>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                Nhân viên: <strong className="text-slate-900 dark:text-white">{confirmDeleteEmployee.full_name}</strong> (Mã: <span className="font-mono text-purple-600 dark:text-purple-400">{confirmDeleteEmployee.employee_id}</span> • Chức vụ: {confirmDeleteEmployee.department})
              </p>
              <div className="space-y-1 text-[11px] text-rose-700 dark:text-rose-300/90 bg-rose-100/60 dark:bg-rose-950/60 p-3 rounded-xl border border-rose-200 dark:border-rose-900/50">
                <p>• Toàn bộ dữ liệu hồ sơ, tài khoản đăng nhập, vector sinh trắc học Face ID, dữ liệu vân tay FAP30 và lịch sử liên quan sẽ bị <strong>XÓA VĨNH VIỄN</strong> trên cơ sở dữ liệu.</p>
                <p className="text-rose-600 dark:text-rose-400 font-semibold">• Thao tác này KHÔNG THỂ KHÔI PHỤC lại được.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteEmployee(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-[#181c38] dark:hover:bg-[#20254b] dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteEmployee(confirmDeleteEmployee.id || confirmDeleteEmployee.employee_id);
                  setConfirmDeleteEmployee(null);
                }}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Xác nhận xóa vĩnh viễn</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirmation Modal for Status Change */}
      <Modal
        isOpen={!!confirmStatusEmployee}
        onClose={() => setConfirmStatusEmployee(null)}
        title="Xác nhận thay đổi trạng thái nhân sự"
        subtitle={`Nhân sự: ${confirmStatusEmployee?.full_name} (${confirmStatusEmployee?.employee_id})`}
        maxWidth="md"
      >
        {confirmStatusEmployee && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#21264b] text-xs text-slate-700 dark:text-slate-300 space-y-2">
              <p className="font-semibold text-slate-900 dark:text-white">
                Bạn có chắc chắn muốn chuyển trạng thái nhân sự này?
              </p>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Trạng thái hiện tại: <strong className={confirmStatusEmployee.status === 'ACTIVE' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}>
                  {confirmStatusEmployee.status === 'ACTIVE' ? 'ĐANG HOẠT ĐỘNG' : 'TẠM NGƯNG'}
                </strong> ➔ Chuyển thành: <strong className={confirmStatusEmployee.status === 'ACTIVE' ? 'text-slate-500' : 'text-emerald-600 dark:text-emerald-400'}>
                  {confirmStatusEmployee.status === 'ACTIVE' ? 'TẠM NGƯNG' : 'ĐANG HOẠT ĐỘNG'}
                </strong>
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Khi tạm ngưng, quyền check-in tại các cổng camera AIoT và bảng tính công sẽ được điều chỉnh tương ứng.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmStatusEmployee(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-[#181c38] dark:hover:bg-[#20254b] dark:text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  toggleEmployeeStatus(confirmStatusEmployee.employee_id);
                  setConfirmStatusEmployee(null);
                }}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-xs cursor-pointer"
              >
                Xác nhận thay đổi
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Position Management Modal */}
      <PositionManagementModal
        isOpen={positionModalOpen}
        onClose={() => setPositionModalOpen(false)}
        onPositionsChanged={() => {
          loadDbPositions();
        }}
      />
    </div>
  );
};

