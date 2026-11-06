import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { fetchEmployeesApi, createEmployeeApi, updateEmployeeApi, deleteEmployeeApi } from '../api/employeeApi';
import { Employee } from '../../../types';
import { useToast } from '../../../context/ToastContext';
import { getActiveSessionId } from '../../../context/AuthContext';
import { ApiError } from '../../../api/client';
import { UncertainWriteError } from '../../operations/commandApi';

export const EMPLOYEES_QUERY_KEY = ['employees'];

export function useEmployees() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const pendingIds = useRef(new Set<string>());
  const matches = (e: Employee, id: string) => e.id === id || e.employee_id === id;

  const query = useQuery({
    queryKey: EMPLOYEES_QUERY_KEY,
    queryFn: fetchEmployeesApi,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
    retry: 1,
  });

  const addEmployeeMutation = useMutation({
    mutationKey: ['employee-write', 'create'],
    mutationFn: (newEmp: Omit<Employee, 'created_at' | 'updated_at'>) => createEmployeeApi(newEmp),
    onMutate: (emp) => { showToast(`Đang lưu nhân viên ${emp.full_name}…`, 'info'); return { sessionId: getActiveSessionId() }; },
    onSuccess: (data, variables, context) => {
      if (context?.sessionId !== getActiveSessionId()) return;
      queryClient.setQueryData<Employee[]>(EMPLOYEES_QUERY_KEY, rows => [data.employee, ...(rows || []).filter(e => e.id !== data.employee.id)]);
      showToast(`Đã tạo nhân viên ${variables.full_name}. ${data.emailStatus === 'queued' ? 'Email tài khoản đang được gửi nền.' : 'Chưa gửi email tài khoản.'}`, 'success');
    },
    onError: (error: Error, _variables, context) => {
      if (context?.sessionId !== getActiveSessionId()) return;
      showToast(`Lỗi khi thêm nhân viên: ${error.message || 'Không thể kết nối đến máy chủ'}`, 'error');
    },
  });

  const updateEmployeeMutation = useMutation({
    mutationKey: ['employee-write', 'update'],
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Employee> }) => updateEmployeeApi(id, updates),
    onMutate: async ({ id, updates }) => {
      const sessionId = getActiveSessionId();
      await queryClient.cancelQueries({ queryKey: EMPLOYEES_QUERY_KEY });
      if (sessionId !== getActiveSessionId()) return { sessionId };
      const previous = queryClient.getQueryData<Employee[]>(EMPLOYEES_QUERY_KEY)?.find(e => matches(e, id));
      queryClient.setQueryData<Employee[]>(EMPLOYEES_QUERY_KEY, rows => rows?.map(e => matches(e, id) ? { ...e, ...updates } : e));
      const optimistic = queryClient.getQueryData<Employee[]>(EMPLOYEES_QUERY_KEY)?.find(e => matches(e, id));
      showToast(`Đang lưu thay đổi của ${previous?.full_name || id}…`, 'info');
      return { previous, optimistic, sessionId };
    },
    onSuccess: (data, { id }, context) => {
      if (context?.sessionId !== getActiveSessionId()) return;
      queryClient.setQueryData<Employee[]>(EMPLOYEES_QUERY_KEY, rows => rows?.map(e => matches(e, id) ? data : e));
      showToast('Đã cập nhật thông tin nhân viên thành công', 'success');
    },
    onError: (error: Error, { id }, context) => {
      if (context?.sessionId !== getActiveSessionId()) return;
      if (context?.previous && !(error instanceof UncertainWriteError)) queryClient.setQueryData<Employee[]>(EMPLOYEES_QUERY_KEY, rows => rows?.map(e => matches(e, id) && e === context.optimistic ? context.previous! : e));
      showToast(`Lỗi khi cập nhật nhân viên: ${error.message || 'Không thể kết nối đến máy chủ'}`, 'error');
    },
    onSettled: (_data, error, _variables, context) => {
      if (context?.sessionId !== getActiveSessionId()) return;
      if (error instanceof UncertainWriteError || (error instanceof ApiError && error.statusCode === 409)) void queryClient.invalidateQueries({ queryKey: EMPLOYEES_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const deleteEmployeeMutation = useMutation({
    mutationKey: ['employee-write', 'delete'],
    onMutate: (id) => { showToast(`Đang xóa nhân viên ${id}…`, 'info'); return { sessionId: getActiveSessionId() }; },
    mutationFn: (id: string) => deleteEmployeeApi(id),
    onSuccess: (_data, _id, context) => {
      if (context?.sessionId !== getActiveSessionId()) return;
      showToast('Đã xóa vĩnh viễn nhân viên khỏi cơ sở dữ liệu thành công', 'success');
      queryClient.invalidateQueries({ queryKey: EMPLOYEES_QUERY_KEY });
    },
    onError: (error: Error, _id, context) => {
      if (context?.sessionId !== getActiveSessionId()) return;
      showToast(`Lỗi khi xóa nhân viên: ${error.message || 'Không thể kết nối đến máy chủ'}`, 'error');
    },
  });

  const toggleEmployeeStatus = (id: string) => {
    const currentList = query.data || [];
    const emp = currentList.find(e => e.employee_id === id || e.id === id);
    if (emp) {
      const nextStatus = emp.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      void saveUpdate(id, { status: nextStatus }).catch(() => {});
    }
  };

  const saveUpdate = async (id: string, updates: Partial<Employee>) => {
    const emp = (queryClient.getQueryData<Employee[]>(EMPLOYEES_QUERY_KEY) || []).find(e => matches(e, id));
    const key = emp?.id || id;
    if (pendingIds.current.has(key)) {
      showToast('Nhân viên này đang được lưu. Vui lòng chờ kết quả trước khi sửa tiếp.', 'warning');
      throw new Error('Đang lưu thay đổi trước');
    }
    pendingIds.current.add(key);
    try { return await updateEmployeeMutation.mutateAsync({ id, updates: { ...updates, updated_at: emp?.updated_at } }); }
    finally { pendingIds.current.delete(key); }
  };
  return {
    employees: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetchEmployees: query.refetch,
    addEmployee: (emp: Omit<Employee, 'created_at' | 'updated_at'>) => addEmployeeMutation.mutateAsync(emp),
    updateEmployee: saveUpdate,
    deleteEmployee: (id: string) => { deleteEmployeeMutation.mutate(id); },
    toggleEmployeeStatus,
  };
}
