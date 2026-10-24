import { useState, useEffect, useMemo, useCallback } from 'react';
import { PositionItem, fetchPositionsApi } from '../../../api/positionApi';
import { DepartmentItem, fetchDepartmentsApi } from '../../../api/departmentApi';
import { Employee } from '../../../types';
import { FilterSelectOption } from '../../../components/common';

export interface UseDepartmentPositionsOptions {
  employees?: Employee[];
  isManager?: boolean;
  managerDept?: string | null;
  departmentFilter?: string;
}

const DEFAULT_DEPARTMENTS = ['Nhân sự', 'Kế toán', 'Kinh doanh', 'Marketing', 'IT', 'CSKH'];

/**
 * Feature Hook: Quản lý danh mục phòng ban và chức vụ nhân sự, hỗ trợ tự động đồng bộ từ Database
 * và phân quyền bộ lọc/chọn lựa cho Quản lý (Manager).
 */
export function useDepartmentPositions(options: UseDepartmentPositionsOptions = {}) {
  const { employees = [], isManager = false, managerDept = null, departmentFilter = 'ALL' } = options;

  const [dbPositions, setDbPositions] = useState<PositionItem[]>([]);
  const [dbDepartments, setDbDepartments] = useState<DepartmentItem[]>([]);

  const loadDbPositions = useCallback(async () => {
    try {
      const data = await fetchPositionsApi();
      setDbPositions(data);
    } catch {
      // Handled gracefully
    }
  }, []);

  const loadDbDepartments = useCallback(async () => {
    try {
      const data = await fetchDepartmentsApi();
      setDbDepartments(data);
    } catch {
      // Handled gracefully
    }
  }, []);

  useEffect(() => {
    loadDbPositions();
    loadDbDepartments();
  }, [loadDbPositions, loadDbDepartments]);

  // Danh sách tên phòng ban thuần (dùng cho modal thêm / sửa)
  const rawDepartmentOptions = useMemo<string[]>(() => {
    if (isManager && managerDept) {
      return [managerDept];
    }
    const list = dbDepartments.map((d) => d.name);
    employees.forEach((e) => {
      const dept = e.department;
      if (dept && !list.includes(dept)) {
        list.push(dept);
      }
    });
    if (list.length === 0) {
      return DEFAULT_DEPARTMENTS;
    }
    return list;
  }, [dbDepartments, employees, isManager, managerDept]);

  // Bộ lọc phòng ban: Manager chỉ mở khóa 1 phòng ban duy nhất mình quản lý (các phòng khác disabled + khóa)
  const departmentOptions = useMemo<(string | FilterSelectOption)[]>(() => {
    const list = dbDepartments.map((d) => d.name);
    employees.forEach((e) => {
      const dept = e.department;
      if (dept && !list.includes(dept)) {
        list.push(dept);
      }
    });
    const baseList = list.length > 0 ? list : DEFAULT_DEPARTMENTS;

    if (isManager && managerDept) {
      return baseList.map((deptName) => {
        const isMyDept = deptName.toLowerCase() === managerDept.toLowerCase();
        return {
          value: deptName,
          label: isMyDept ? deptName : `${deptName} (Khóa)`,
          disabled: !isMyDept,
        };
      });
    }

    return baseList;
  }, [dbDepartments, employees, isManager, managerDept]);

  // Hàm tra cứu chức vụ theo phòng ban
  const getPositionsByDepartment = useCallback(
    (deptName: string): string[] => {
      if (!deptName) return [];
      const matching = dbPositions
        .filter(
          (p) =>
            (p.department_name && p.department_name.toLowerCase() === deptName.toLowerCase()) ||
            (p.department_code && p.department_code.toLowerCase() === deptName.toLowerCase())
        )
        .map((p) => p.name);

      employees.forEach((e) => {
        if (e.department?.toLowerCase() === deptName.toLowerCase() && e.position) {
          if (!matching.includes(e.position)) {
            matching.push(e.position);
          }
        }
      });

      if (matching.length > 0) return matching;

      if (import.meta.env.DEV) {
        console.warn(`[useDepartmentPositions:DEV_ONLY] Chưa có chức vụ nào được cấu hình cho phòng ban '${deptName}' trong CSDL`);
      }
      return ['Nhân viên'];
    },
    [dbPositions, employees]
  );

  // Bộ lọc chức vụ: Manager chỉ thấy các chức vụ thuộc phòng ban mình phụ trách
  const positionOptions = useMemo<string[]>(() => {
    const effectiveDept = isManager && managerDept ? managerDept : departmentFilter;

    let positionsToUse = dbPositions;
    if (effectiveDept !== 'ALL') {
      const filteredByDept = dbPositions.filter(
        (p) =>
          (p.department_name && p.department_name.toLowerCase() === effectiveDept.toLowerCase()) ||
          (p.department_code && p.department_code.toLowerCase() === effectiveDept.toLowerCase())
      );
      if (filteredByDept.length > 0) {
        positionsToUse = filteredByDept;
      }
    }

    const list = positionsToUse.map((p) => p.name);
    employees.forEach((e) => {
      if (effectiveDept !== 'ALL' && e.department?.toLowerCase() !== effectiveDept.toLowerCase()) {
        return;
      }
      const pos = e.position;
      if (pos && !list.includes(pos)) {
        list.push(pos);
      }
    });

    if (list.length === 0) {
      if (effectiveDept !== 'ALL') {
        return getPositionsByDepartment(effectiveDept);
      }
      return ['Nhân viên'];
    }
    return list;
  }, [dbPositions, employees, departmentFilter, isManager, managerDept, getPositionsByDepartment]);

  return {
    dbPositions,
    dbDepartments,
    rawDepartmentOptions,
    departmentOptions,
    positionOptions,
    getPositionsByDepartment,
    loadDbPositions,
    loadDbDepartments,
  };
}
