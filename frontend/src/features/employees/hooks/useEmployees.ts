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
    onMutate: () => ({ sessionId: getActiveSessionId() }),
    onSuccess: (data, variables, context) => {
      if (context?.sessionId !== getActiveSessionId()) return;
      queryClient.setQueryData<Employee[]>(EMPLOYEES_QUERY_KEY, rows => [data.employee, ...(rows || []).filter(e => e.id !== data.employee.id)]);
      showToast(`Đã tạo hồ sơ ${data.employee.full_name} (${data.employee.employee_id}). ${data.emailStatus === 'queued' ? 'Email tài khoản đang được gửi nền.' : 'Chưa gửi email tài khoản.'}`, 'success', "Thêm nhân viên thành công");
    },
    onError: (error: Error, variables, context) => {
      if (context?.sessionId !== getActiveSessionId()) return;
      showToast(`Chưa thêm được ${variables.full_name} (${variables.employee_id}): ${error.message || 'Không thể kết nối đến máy chủ'}. Kiểm tra danh sách trước khi thêm lại.`, 'error', 'Không thể thêm nhân viên');
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
      return { previous, optimistic, sessionId };
    },
    onSuccess: (data, { id }, context) => {
      if (context?.sessionId !== getActiveSessionId()) return;
      queryClient.setQueryData<Employee[]>(EMPLOYEES_QUERY_KEY, rows => rows?.map(e => matches(e, id) ? data : e));
      showToast(`Đã cập nhật hồ sơ ${data.full_name} (${data.employee_id}).`, 'success', 'Cập nhật nhân viên thành công');
    },
    onError: (error: Error, { id }, context) => {
      if (context?.sessionId !== getActiveSessionId()) return;
      if (context?.previous && !(error instanceof UncertainWriteError)) queryClient.setQueryData<Employee[]>(EMPLOYEES_QUERY_KEY, rows => rows?.map(e => matches(e, id) && e === context.optimistic ? context.previous! : e));
      showToast(`Nhân viên ${context.previous?.full_name || id} (${context.previous?.employee_id || id}): ${error.message || 'Không thể kết nối đến máy chủ'}. Kiểm tra thông tin hiện tại trước khi lưu lại.`, 'error', 'Không thể cập nhật nhân viên');
    },
    onSettled: (_data, error, _variables, context) => {
      if (context?.sessionId !== getActiveSessionId()) return;
      if (error instanceof UncertainWriteError || (error instanceof ApiError && error.statusCode === 409)) void queryClient.invalidateQueries({ queryKey: EMPLOYEES_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const deleteEmployeeMutation = useMutation({
    mutationKey: ['employee-write', 'delete'],
    onMutate: (id: string) => ({ sessionId: getActiveSessionId(), employee: queryClient.getQueryData<Employee[]>(EMPLOYEES_QUERY_KEY)?.find(e => matches(e, id)) }),
    mutationFn: (id: string) => deleteEmployeeApi(id),
    onSuccess: (_data, _id, context) => {
      if (context?.sessionId !== getActiveSessionId()) return;
      showToast(`Đã xóa hồ sơ ${context.employee?.full_name || _id} (${context.employee?.employee_id || _id}) và tài khoản liên kết.`, 'success', 'Xóa nhân viên thành công');
      queryClient.invalidateQueries({ queryKey: EMPLOYEES_QUERY_KEY });
    },
    onError: (error: Error, _id, context) => {
      if (context?.sessionId !== getActiveSessionId()) return;
      showToast(`Nhân viên ${context.employee?.full_name || _id} (${context.employee?.employee_id || _id}): ${error.message || 'Không thể kết nối đến máy chủ'}. Kiểm tra danh sách nhân viên trước khi thực hiện tiếp.`, 'error', 'Không thể xóa nhân viên');
    },
  });

  const toggleEmployeeStatus = async (id: string) => {
    const currentList = query.data || [];
    const emp = currentList.find(e => e.employee_id === id || e.id === id);
    if (emp) {
      const nextStatus = emp.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await saveUpdate(id, { status: nextStatus });
    }
  };

  const saveUpdate = async (id: string, updates: Partial<Employee>) => {
    const emp = (queryClient.getQueryData<Employee[]>(EMPLOYEES_QUERY_KEY) || []).find(e => matches(e, id));
    const key = emp?.id || id;
    if (pendingIds.current.has(key)) {
      showToast('Nhân viên này đang được lưu. Vui lòng chờ kết quả trước khi sửa tiếp.', 'error', "Không thể cập nhật nhân viên");
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
    deleteEmployee: (id: string) => { return deleteEmployeeMutation.mutateAsync(id); },
    toggleEmployeeStatus,
  };
}
