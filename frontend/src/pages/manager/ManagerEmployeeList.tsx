import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Employee } from '../../types';
import { useDepartmentPositions } from '../../hooks';
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
  DepartmentPositionDrawer,
} from '@/features/employees';

export const ManagerEmployeeList: React.FC = () => {
  const {
    employees,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    toggleEmployeeStatus,
    showToast,
    role,
    currentUser,
  } = useApp();

  const isManager = role === 'manager';
  const managerDept = currentUser?.department;

  const [searchParams, setSearchParams] = useSearchParams();
  const querySearch = searchParams.get('search') || '';

  const [searchTerm, setSearchTerm] = useState(querySearch);
  const [departmentFilter, setDepartmentFilter] = useState(() => {
    if (role === 'manager' && currentUser?.department) {
      return currentUser.department;
    }
    return 'ALL';
  });
  const [positionFilter, setPositionFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    if (isManager && managerDept) {
      setDepartmentFilter(managerDept);
    }
  }, [isManager, managerDept]);

  // Position & Department Management State via reusable hook
  const [deptPositionDrawerOpen, setDeptPositionDrawerOpen] = useState(false);
  const {
    rawDepartmentOptions,
    departmentOptions,
    positionOptions,
    getPositionsByDepartment,
    loadDbPositions,
    loadDbDepartments,
  } = useDepartmentPositions({
    employees,
    isManager,
    managerDept,
    departmentFilter,
  });

  const handleDeptPositionsChanged = () => {
    loadDbPositions();
    loadDbDepartments();
  };

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
  const [newEmp, setNewEmp] = useState<NewEmployeeFormState>(() => {
    const initialDept = role === 'manager' && currentUser?.department ? currentUser.department : 'Nhân sự';
    return {
      employee_id: getNextEmployeeId(employees),
      full_name: '',
      department: initialDept,
      position: 'Nhân viên',
      phone: '',
      email: '',
      status: 'ACTIVE' as const,
      face_enrolled: false,
      fingerprint_enrolled: false,
      hourly_rate: 50000,
      avatar:
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
    };
  });

  const handleOpenAddModal = () => {
    const currentDept =
      isManager && managerDept
        ? managerDept
        : newEmp.department && rawDepartmentOptions.includes(newEmp.department)
        ? newEmp.department
        : rawDepartmentOptions[0] || 'Nhân sự';
    let validPositions = getPositionsByDepartment(currentDept);
    if (isManager) {
      const nonManagerPositions = validPositions.filter(
        (p) =>
          !p.toLowerCase().includes('trưởng phòng') &&
          !p.toLowerCase().includes('quản lý') &&
          !p.toLowerCase().includes('kế toán trưởng')
      );
      if (nonManagerPositions.length > 0) {
        validPositions = nonManagerPositions;
      }
    }
    const currentPos =
      newEmp.position && validPositions.includes(newEmp.position)
        ? newEmp.position
        : validPositions[0] || 'Nhân viên';

    setNewEmp((prev) => ({
      ...prev,
      employee_id: getNextEmployeeId(employees),
      department: currentDept,
      position: currentPos,
    }));
    setAddModalOpen(true);
  };

  // Manager chỉ xem được mình và nhân viên phòng ban mình phụ trách (hoàn toàn ẩn nhân viên phòng khác)
  const scopedEmployees = useMemo(() => {
    if (isManager && managerDept) {
      return employees.filter((emp) => {
        const isMyDept = emp.department?.toLowerCase() === managerDept.toLowerCase();
        const isSelf =
          (currentUser?.employee_id && emp.employee_id === currentUser.employee_id) ||
          (currentUser?.email && emp.email?.toLowerCase() === currentUser.email.toLowerCase());
        return isMyDept || isSelf;
      });
    }
    return employees;
  }, [employees, isManager, managerDept, currentUser]);

  const filteredEmployees = scopedEmployees.filter((emp) => {
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

    const defaultDept = isManager && managerDept ? managerDept : (rawDepartmentOptions[0] || 'Nhân sự');
    const defaultPos = getPositionsByDepartment(defaultDept)[0] || 'Nhân viên';

    setNewEmp({
      employee_id: getNextEmployeeId(updatedEmployees),
      full_name: '',
      department: defaultDept,
      position: defaultPos,
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
        onOpenDeptPositionDrawer={() => setDeptPositionDrawerOpen(true)}
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
        totalCount={scopedEmployees.length}
        departmentFilter={departmentFilter}
        onDepartmentFilterChange={(val) => {
          if (isManager && managerDept && val !== managerDept && val !== 'ALL') {
            return;
          }
          setDepartmentFilter(val);
          setPositionFilter('ALL');
        }}
        departmentOptions={departmentOptions}
        allDepartmentLabel={isManager ? '' : 'Tất cả phòng ban'}
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
        departmentOptions={rawDepartmentOptions}
        positionsByDepartment={getPositionsByDepartment}
        onSubmit={handleAddSubmit}
      />

      {/* Modal Edit Employee */}
      <EditEmployeeModal
        editEmployee={editEmployee}
        onClose={() => setEditEmployee(null)}
        onChangeEditEmployee={setEditEmployee}
        departmentOptions={rawDepartmentOptions}
        positionsByDepartment={getPositionsByDepartment}
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

      {/* Department & Position Management Drawer */}
      <DepartmentPositionDrawer
        isOpen={deptPositionDrawerOpen}
        onClose={() => setDeptPositionDrawerOpen(false)}
        onChanged={handleDeptPositionsChanged}
      />
    </div>
  );
};
export default ManagerEmployeeList;
