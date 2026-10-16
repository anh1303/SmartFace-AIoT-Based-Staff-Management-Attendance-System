import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { PositionManagementModal } from '../../components/employees/PositionManagementModal';
import { PositionItem, fetchPositionsApi } from '../../api/positionApi';
import { DepartmentItem, fetchDepartmentsApi } from '../../api/departmentApi';
import { Employee } from '../../types';
import {
  getNextEmployeeId,
  EmployeeListHeader,
  EmployeeListFilters,
  EmployeeTable,
  AddEmployeeModal,
  NewEmployeeFormState,
  EditEmployeeModal,
  ConfirmDeleteEmployeeModal,
  ConfirmStatusEmployeeModal,
} from '../../features/employee-management';

export const ManagerEmployeeList: React.FC = () => {
  const {
    employees,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    toggleEmployeeStatus,
    showToast,
  } = useApp();

  const [searchParams, setSearchParams] = useSearchParams();
  const querySearch = searchParams.get('search') || '';

  const [searchTerm, setSearchTerm] = useState(querySearch);
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [positionFilter, setPositionFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Position & Department Management State
  const [positionModalOpen, setPositionModalOpen] = useState(false);
  const [dbPositions, setDbPositions] = useState<PositionItem[]>([]);
  const [dbDepartments, setDbDepartments] = useState<DepartmentItem[]>([]);

  const loadDbPositions = async () => {
    try {
      const data = await fetchPositionsApi();
      setDbPositions(data);
    } catch {
      // Handled gracefully
    }
  };

  const loadDbDepartments = async () => {
    try {
      const data = await fetchDepartmentsApi();
      setDbDepartments(data);
    } catch {
      // Handled gracefully
    }
  };

  useEffect(() => {
    loadDbPositions();
    loadDbDepartments();
  }, []);

  const departmentOptions = useMemo(() => {
    const list = dbDepartments.map((d) => d.name);
    employees.forEach((e) => {
      const dept = e.department;
      if (dept && !list.includes(dept)) {
        list.push(dept);
      }
    });
    if (list.length === 0) {
      return ['Nhân sự', 'Kế toán', 'Kinh doanh', 'Marketing', 'IT', 'CSKH'];
    }
    return list;
  }, [dbDepartments, employees]);

  const positionOptions = useMemo(() => {
    let positionsToUse = dbPositions;
    if (departmentFilter !== 'ALL') {
      const filteredByDept = dbPositions.filter(
        (p) => p.department_name === departmentFilter
      );
      if (filteredByDept.length > 0) {
        positionsToUse = filteredByDept;
      }
    }

    const list = positionsToUse.map((p) => p.name);
    employees.forEach((e) => {
      if (departmentFilter !== 'ALL' && e.department !== departmentFilter) {
        return;
      }
      const pos = e.position;
      if (pos && !list.includes(pos)) {
        list.push(pos);
      }
    });
    if (list.length === 0) {
      return ['Bảo vệ', 'Nhân viên', 'Thu ngân', 'Quản lý'];
    }
    return list;
  }, [dbPositions, employees, departmentFilter]);

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
  const [newEmp, setNewEmp] = useState<NewEmployeeFormState>(() => ({
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
    avatar:
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
  }));

  const handleOpenAddModal = () => {
    setNewEmp((prev) => ({
      ...prev,
      employee_id: getNextEmployeeId(employees),
    }));
    setAddModalOpen(true);
  };

  const filteredEmployees = employees.filter((emp) => {
    const term = searchTerm.trim().toLowerCase();
    const matchSearch =
      !term ||
      emp.full_name.toLowerCase().includes(term) ||
      emp.employee_id.toLowerCase().includes(term) ||
      emp.email.toLowerCase().includes(term) ||
      emp.phone.toLowerCase().includes(term) ||
      emp.position.toLowerCase().includes(term) ||
      emp.department.toLowerCase().includes(term);

    const matchDept =
      departmentFilter === 'ALL' ||
      emp.department?.toLowerCase() === departmentFilter.toLowerCase();
    const matchPos =
      positionFilter === 'ALL' ||
      emp.position?.toLowerCase() === positionFilter.toLowerCase();
    const matchStatus = statusFilter === 'ALL' || emp.status === statusFilter;

    return matchSearch && matchDept && matchPos && matchStatus;
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmp.full_name || !newEmp.email) {
      showToast('Vui lòng điền đầy đủ họ tên và email', 'error');
      return;
    }

    addEmployee(newEmp);
    setAddModalOpen(false);
    const updatedEmployees = [
      ...employees,
      {
        ...newEmp,
        id: newEmp.employee_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
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
      avatar:
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
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
      {/* Bento Header Banner */}
      <EmployeeListHeader
        onOpenPositionModal={() => setPositionModalOpen(true)}
        onOpenAddModal={handleOpenAddModal}
      />

      {/* Bento Filters and Search Bar */}
      <EmployeeListFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onClearSearch={() => {
          setSearchTerm('');
          setSearchParams({});
        }}
        filteredCount={filteredEmployees.length}
        totalCount={employees.length}
        departmentFilter={departmentFilter}
        onDepartmentFilterChange={(val) => {
          setDepartmentFilter(val);
          setPositionFilter('ALL');
        }}
        departmentOptions={departmentOptions}
        positionFilter={positionFilter}
        onPositionFilterChange={setPositionFilter}
        positionOptions={positionOptions}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      {/* Bento Employees Table */}
      <EmployeeTable
        filteredEmployees={filteredEmployees}
        onOpenEdit={(emp) => setEditEmployee(emp)}
        onOpenStatusToggle={(emp) => setConfirmStatusEmployee(emp)}
      />

      {/* Modal Add Employee */}
      <AddEmployeeModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        newEmp={newEmp}
        onChangeNewEmp={setNewEmp}
        positionOptions={positionOptions}
        onSubmit={handleAddSubmit}
      />

      {/* Modal Edit Employee */}
      <EditEmployeeModal
        editEmployee={editEmployee}
        onClose={() => setEditEmployee(null)}
        onChangeEditEmployee={setEditEmployee}
        positionOptions={positionOptions}
        onSubmit={handleEditSubmit}
        onTriggerDelete={(emp) => {
          setEditEmployee(null);
          setConfirmDeleteEmployee(emp);
        }}
      />

      {/* Confirmation Modal for Delete Employee */}
      <ConfirmDeleteEmployeeModal
        employee={confirmDeleteEmployee}
        onClose={() => setConfirmDeleteEmployee(null)}
        onConfirmDelete={(emp) => {
          deleteEmployee(emp.id || emp.employee_id);
          setConfirmDeleteEmployee(null);
        }}
      />

      {/* Confirmation Modal for Status Change */}
      <ConfirmStatusEmployeeModal
        employee={confirmStatusEmployee}
        onClose={() => setConfirmStatusEmployee(null)}
        onConfirmToggle={(emp) => {
          toggleEmployeeStatus(emp.employee_id);
          setConfirmStatusEmployee(null);
        }}
      />

      {/* Position Management Modal */}
      <PositionManagementModal
        isOpen={positionModalOpen}
        onClose={() => setPositionModalOpen(false)}
        onPositionsChanged={loadDbPositions}
      />
    </div>
  );
};
export default ManagerEmployeeList;
