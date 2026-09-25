import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchEmployeesApi, createEmployeeApi, updateEmployeeApi } from '../api/employeeApi';
import { Employee } from '../types';
import { useToast } from '../context/ToastContext';

export const EMPLOYEES_QUERY_KEY = ['employees'];

export function useEmployees() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const query = useQuery({
    queryKey: EMPLOYEES_QUERY_KEY,
    queryFn: fetchEmployeesApi,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
    retry: 1,
  });

  const addEmployeeMutation = useMutation({
    mutationFn: (newEmp: Omit<Employee, 'created_at' | 'updated_at'>) => createEmployeeApi(newEmp),
    onSuccess: (_data, variables) => {
      showToast(`Đã thêm nhân viên ${variables.full_name} vào CSDL thành công`, 'success');
      queryClient.invalidateQueries({ queryKey: EMPLOYEES_QUERY_KEY });
    },
    onError: (error: Error) => {
      showToast(`Lỗi khi thêm nhân viên: ${error.message || 'Không thể kết nối đến máy chủ'}`, 'error');
    },
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Employee> }) => updateEmployeeApi(id, updates),
    onSuccess: () => {
      showToast('Đã cập nhật thông tin nhân viên thành công', 'success');
      queryClient.invalidateQueries({ queryKey: EMPLOYEES_QUERY_KEY });
    },
    onError: (error: Error) => {
      showToast(`Lỗi khi cập nhật nhân viên: ${error.message || 'Không thể kết nối đến máy chủ'}`, 'error');
    },
  });

  const toggleEmployeeStatus = (id: string) => {
    const currentList = query.data || [];
    const emp = currentList.find(e => e.employee_id === id || e.id === id);
    if (emp) {
      const nextStatus = emp.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      updateEmployeeMutation.mutate({ id, updates: { status: nextStatus } });
    }
  };

  return {
    employees: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetchEmployees: query.refetch,
    addEmployee: (emp: Omit<Employee, 'created_at' | 'updated_at'>) => addEmployeeMutation.mutate(emp),
    updateEmployee: (id: string, updates: Partial<Employee>) => updateEmployeeMutation.mutate({ id, updates }),
    toggleEmployeeStatus,
  };
}
