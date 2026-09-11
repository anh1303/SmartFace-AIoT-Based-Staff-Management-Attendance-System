import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Users, 
  Search, 
  Filter, 
  Plus, 
  Edit, 
  CheckCircle2, 
  XCircle, 
  ScanFace, 
  Fingerprint, 
  Mail, 
  Phone, 
  Building2,
  Lock,
  Briefcase
} from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { Employee } from '../../types';

export const ManagerEmployeeList: React.FC = () => {
  const { employees, addEmployee, updateEmployee, toggleEmployeeStatus, showToast } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal States
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [confirmStatusEmployee, setConfirmStatusEmployee] = useState<Employee | null>(null);

  // Form state for Add
  const [newEmp, setNewEmp] = useState({
    employee_id: `NV-${String(employees.length + 1).padStart(3, '0')}`,
    full_name: '',
    department: 'Kỹ thuật AI',
    position: 'Kỹ sư phần mềm',
    phone: '',
    email: '',
    status: 'ACTIVE' as const,
    face_enrolled: true,
    fingerprint_enrolled: true,
    base_salary: 18000000,
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
  });

  const filteredEmployees = employees.filter(emp => {
    const matchSearch = 
      emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employee_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase());
    
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
    // Reset form
    setNewEmp({
      employee_id: `NV-${String(employees.length + 2).padStart(3, '0')}`,
      full_name: '',
      department: 'Kỹ thuật AI',
      position: 'Kỹ sư phần mềm',
      phone: '',
      email: '',
      status: 'ACTIVE',
      face_enrolled: true,
      fingerprint_enrolled: true,
      base_salary: 18000000,
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
      base_salary: editEmployee.base_salary,
      face_enrolled: editEmployee.face_enrolled,
      fingerprint_enrolled: editEmployee.fingerprint_enrolled,
    });
    setEditEmployee(null);
  };

  return (
    <div className="space-y-6">
      {/* Bento Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white font-heading tracking-tight">
              Quản Lý Danh Sách Nhân Sự
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-mono font-medium border border-blue-500/20">
              {employees.length} NHÂN SỰ
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Quản lý hồ sơ nhân viên, trạng thái kích hoạt và đăng ký sinh trắc học Face ID / Vân tay.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setAddModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-md transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm nhân viên mới</span>
        </button>
      </div>

      {/* Bento Filters and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="relative w-full lg:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên, mã NV, email..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5 text-blue-400" />
            <span>Phòng ban:</span>
          </div>
          <select
            value={departmentFilter}
            onChange={e => setDepartmentFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">Tất cả phòng ban</option>
            <option value="Kỹ thuật AI">Kỹ thuật AI</option>
            <option value="Vận hành & IT">Vận hành & IT</option>
            <option value="Nhân sự & HR">Nhân sự & HR</option>
            <option value="Kinh doanh & Dự án">Kinh doanh & Dự án</option>
          </select>

          <div className="flex items-center gap-1.5 text-xs text-slate-400 ml-2">
            <span>Trạng thái:</span>
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hoạt động (ACTIVE)</option>
            <option value="INACTIVE">Tạm ngưng (INACTIVE)</option>
          </select>
        </div>
      </div>

      {/* Bento Employees Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 border-b border-slate-800 text-slate-500 uppercase tracking-wider font-mono text-[11px]">
              <tr>
                <th className="py-3.5 px-4 font-medium">Nhân sự</th>
                <th className="py-3.5 px-4 font-medium">Mã NV</th>
                <th className="py-3.5 px-4 font-medium">Phòng ban & Vị trí</th>
                <th className="py-3.5 px-4 font-medium">Liên hệ</th>
                <th className="py-3.5 px-4 font-medium">Sinh trắc AI</th>
                <th className="py-3.5 px-4 font-medium">Lương cơ bản</th>
                <th className="py-3.5 px-4 font-medium">Trạng thái</th>
                <th className="py-3.5 px-4 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-slate-300">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    Không tìm thấy nhân viên nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map(emp => (
                  <tr key={emp.employee_id} className="hover:bg-slate-800/40 transition-colors">
                    {/* Employee Profile */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={emp.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"}
                          alt={emp.full_name}
                          className="w-9 h-9 rounded-full object-cover border border-slate-700"
                        />
                        <div>
                          <p className="font-semibold text-white">{emp.full_name}</p>
                          <p className="text-[11px] text-slate-400 font-mono">
                            Ngày vào: {new Date(emp.created_at).toLocaleDateString('vi-VN')}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* ID */}
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-400">
                      {emp.employee_id}
                    </td>

                    {/* Department & Position */}
                    <td className="py-3.5 px-4">
                      <p className="text-white font-medium">{emp.department}</p>
                      <p className="text-[11px] text-slate-400">{emp.position}</p>
                    </td>

                    {/* Contact */}
                    <td className="py-3.5 px-4">
                      <p className="text-slate-300 font-mono text-[11px]">{emp.email}</p>
                      <p className="text-slate-500 font-mono text-[11px]">{emp.phone}</p>
                    </td>

                    {/* Biometrics */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          title={emp.face_enrolled ? "Face ID: Đã đăng ký" : "Chưa đăng ký Face ID"}
                          className={`p-1.5 rounded-lg ${
                            emp.face_enrolled
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : 'bg-slate-800 text-slate-600'
                          }`}
                        >
                          <ScanFace className="w-4 h-4" />
                        </span>
                        <span
                          title={emp.fingerprint_enrolled ? "Vân tay: Đã đăng ký" : "Chưa đăng ký Vân tay"}
                          className={`p-1.5 rounded-lg ${
                            emp.fingerprint_enrolled
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                              : 'bg-slate-800 text-slate-600'
                          }`}
                        >
                          <Fingerprint className="w-4 h-4" />
                        </span>
                      </div>
                    </td>

                    {/* Base Salary */}
                    <td className="py-3.5 px-4 font-mono text-white font-medium">
                      {(emp.base_salary || 0).toLocaleString('vi-VN')} ₫
                    </td>

                    {/* Status Toggle */}
                    <td className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() => setConfirmStatusEmployee(emp)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono transition-all ${
                          emp.status === 'ACTIVE'
                            ? 'bg-green-500/10 text-green-500 border border-green-500/20 hover:bg-green-500/20'
                            : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        {emp.status === 'ACTIVE' ? 'HOẠT ĐỘNG' : 'TẠM NGƯNG'}
                      </button>
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setEditEmployee(emp)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs flex items-center gap-1.5 ml-auto transition-colors"
                      >
                        <Edit className="w-3.5 h-3.5 text-blue-400" />
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
              <label className="block text-xs font-semibold text-slate-300 mb-1">Mã nhân viên (ID)</label>
              <input
                type="text"
                required
                value={newEmp.employee_id}
                onChange={e => setNewEmp({ ...newEmp, employee_id: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Họ và tên</label>
              <input
                type="text"
                required
                placeholder="Ví dụ: Hoàng Minh Trí"
                value={newEmp.full_name}
                onChange={e => setNewEmp({ ...newEmp, full_name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Phòng ban</label>
              <select
                value={newEmp.department}
                onChange={e => setNewEmp({ ...newEmp, department: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
              >
                <option value="Kỹ thuật AI">Kỹ thuật AI</option>
                <option value="Vận hành & IT">Vận hành & IT</option>
                <option value="Nhân sự & HR">Nhân sự & HR</option>
                <option value="Kinh doanh & Dự án">Kinh doanh & Dự án</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Chức danh / Vị trí</label>
              <input
                type="text"
                required
                value={newEmp.position}
                onChange={e => setNewEmp({ ...newEmp, position: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Email doanh nghiệp</label>
              <input
                type="email"
                required
                placeholder="tri.hoang@company.com"
                value={newEmp.email}
                onChange={e => setNewEmp({ ...newEmp, email: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Số điện thoại</label>
              <input
                type="text"
                required
                placeholder="0912.345.678"
                value={newEmp.phone}
                onChange={e => setNewEmp({ ...newEmp, phone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">Lương cơ bản hợp đồng (VNĐ)</label>
              <input
                type="number"
                required
                step="500000"
                value={newEmp.base_salary}
                onChange={e => setNewEmp({ ...newEmp, base_salary: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono"
              />
            </div>
          </div>

          {/* Biometrics Enroll Toggles */}
          <div className="pt-2 p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
            <span className="text-xs font-semibold text-blue-400">Thiết lập đăng ký sinh trắc học:</span>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newEmp.face_enrolled}
                  onChange={e => setNewEmp({ ...newEmp, face_enrolled: e.target.checked })}
                  className="rounded bg-slate-900 border-slate-700 text-blue-600"
                />
                <span>Kích hoạt Face ID 512-D</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newEmp.fingerprint_enrolled}
                  onChange={e => setNewEmp({ ...newEmp, fingerprint_enrolled: e.target.checked })}
                  className="rounded bg-slate-900 border-slate-700 text-blue-600"
                />
                <span>Kích hoạt Vân tay FAP30</span>
              </label>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setAddModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs text-slate-300 hover:bg-slate-800"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md"
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
                <label className="block text-xs font-semibold text-slate-300 mb-1">Họ và tên</label>
                <input
                  type="text"
                  required
                  value={editEmployee.full_name}
                  onChange={e => setEditEmployee({ ...editEmployee, full_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Phòng ban</label>
                <select
                  value={editEmployee.department}
                  onChange={e => setEditEmployee({ ...editEmployee, department: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                >
                  <option value="Kỹ thuật AI">Kỹ thuật AI</option>
                  <option value="Vận hành & IT">Vận hành & IT</option>
                  <option value="Nhân sự & HR">Nhân sự & HR</option>
                  <option value="Kinh doanh & Dự án">Kinh doanh & Dự án</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Chức danh</label>
                <input
                  type="text"
                  required
                  value={editEmployee.position}
                  onChange={e => setEditEmployee({ ...editEmployee, position: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Lương cơ bản (VNĐ)</label>
                <input
                  type="number"
                  required
                  step="500000"
                  value={editEmployee.base_salary}
                  onChange={e => setEditEmployee({ ...editEmployee, base_salary: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={editEmployee.email}
                  onChange={e => setEditEmployee({ ...editEmployee, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Số điện thoại</label>
                <input
                  type="text"
                  required
                  value={editEmployee.phone}
                  onChange={e => setEditEmployee({ ...editEmployee, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono"
                />
              </div>
            </div>

            <div className="pt-2 p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center gap-6">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editEmployee.face_enrolled}
                  onChange={e => setEditEmployee({ ...editEmployee, face_enrolled: e.target.checked })}
                  className="rounded bg-slate-900 border-slate-700 text-blue-600"
                />
                <span>Kích hoạt Face ID 512-D</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editEmployee.fingerprint_enrolled}
                  onChange={e => setEditEmployee({ ...editEmployee, fingerprint_enrolled: e.target.checked })}
                  className="rounded bg-slate-900 border-slate-700 text-blue-600"
                />
                <span>Kích hoạt Vân tay FAP30</span>
              </label>
            </div>

            <div className="pt-4 flex justify-end gap-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditEmployee(null)}
                className="px-4 py-2 rounded-xl text-xs text-slate-300 hover:bg-slate-800"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md"
              >
                Xác nhận cập nhật thông tin
              </button>
            </div>
          </form>
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
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-2">
              <p className="font-semibold text-white">
                Bạn có chắc chắn muốn chuyển trạng thái nhân sự này?
              </p>
              <p className="text-slate-400 leading-relaxed">
                Trạng thái hiện tại: <strong className={confirmStatusEmployee.status === 'ACTIVE' ? 'text-green-400' : 'text-slate-400'}>
                  {confirmStatusEmployee.status === 'ACTIVE' ? 'ĐANG HOẠT ĐỘNG' : 'TẠM NGƯNG'}
                </strong> ➔ Chuyển thành: <strong className={confirmStatusEmployee.status === 'ACTIVE' ? 'text-slate-400' : 'text-green-400'}>
                  {confirmStatusEmployee.status === 'ACTIVE' ? 'TẠM NGƯNG' : 'ĐANG HOẠT ĐỘNG'}
                </strong>
              </p>
              <p className="text-[11px] text-slate-500">
                Khi tạm ngưng, quyền check-in tại các cổng camera AIoT và bảng tính công sẽ được điều chỉnh tương ứng.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmStatusEmployee(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  toggleEmployeeStatus(confirmStatusEmployee.employee_id);
                  setConfirmStatusEmployee(null);
                }}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md"
              >
                Xác nhận thay đổi
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
