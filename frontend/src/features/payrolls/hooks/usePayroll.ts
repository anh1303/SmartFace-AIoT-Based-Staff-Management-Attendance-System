import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchPayrollApi,
  fetchBonusPenaltyApi,
  generatePayrollApi,
  updatePayrollItemApi,
  finalizePayrollPeriodApi,
  unlockPayrollPeriodApi,
  updateBonusPenaltyApi,
  PayrollItemUpdates,
} from '../api/payrollApi';
import { PayrollRecord, BonusPenaltyPolicy } from '../../../types';
import { useToast } from '../../../context/ToastContext';

export const PAYROLL_QUERY_KEY = ['payroll'];
export const BONUS_PENALTY_QUERY_KEY = ['bonusPenalty'];
export type { PayrollItemUpdates };

export function usePayroll() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [selectedPeriod, setSelectedPeriod] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const payrollQuery = useQuery({
    queryKey: PAYROLL_QUERY_KEY,
    queryFn: fetchPayrollApi,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const bonusPenaltyQuery = useQuery({
    queryKey: [...BONUS_PENALTY_QUERY_KEY, selectedPeriod],
    queryFn: () => fetchBonusPenaltyApi(selectedPeriod),
    staleTime: 1000 * 60 * 10,
    retry: 1,
  });

  const generatePayrollMutation = useMutation({
    mutationFn: (period: string) => generatePayrollApi(period),
    onSuccess: (_records, period) => {
      setSelectedPeriod(period);
      showToast(`Đã tính lại bảng lương kỳ ${period}. Kiểm tra số liệu trước khi chốt lương.`, 'success', "Tính bảng lương thành công");
      queryClient.invalidateQueries({ queryKey: PAYROLL_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['attendanceAdjustments'] });
    },
    onError: (err: Error, period) => {
      showToast(`Lỗi khi tính toán bảng lương kỳ ${period}: ${err.message || ''}`, 'error', "Không thể tính bảng lương");
    },
  });

  const updatePayrollItemMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: PayrollItemUpdates }) =>
      updatePayrollItemApi(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYROLL_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['attendanceAdjustments'] });
    },
    onError: (err: Error) => {
      showToast(`Lỗi khi cập nhật phiếu lương: ${err.message || ''}`, 'error', "Không thể cập nhật phiếu lương");
    },
  });

  const finalizePayrollPeriodMutation = useMutation({
    mutationFn: (period: string) => finalizePayrollPeriodApi(period),
    onSuccess: (_data, period) => {
      showToast(`Đã chốt bảng lương kỳ ${period}. Các phiếu thuộc phạm vi được chốt đã được khóa chỉnh sửa.`, 'success', "Chốt bảng lương thành công");
      queryClient.invalidateQueries({ queryKey: PAYROLL_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['attendanceAdjustments'] });
    },
    onError: (err: Error, period) => {
      showToast(`Lỗi khi chốt bảng lương kỳ ${period}: ${err.message || ''}`, 'error', "Không thể chốt bảng lương");
    },
  });

  const unlockPayrollPeriodMutation = useMutation({
    mutationFn: (period: string) => unlockPayrollPeriodApi(period),
    onSuccess: (_records, period) => {
      showToast(`Đã mở khóa bảng lương kỳ ${period} để chỉnh sửa. Các phiếu đã quyết toán sớm vẫn giữ khóa.`, 'success', "Mở khóa bảng lương thành công");
      queryClient.invalidateQueries({ queryKey: PAYROLL_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['attendanceAdjustments'] });
    },
    onError: (err: Error, period) => {
      showToast(`Lỗi khi mở khoá bảng lương kỳ ${period}: ${err.message || ''}`, 'error', "Không thể mở khóa bảng lương");
    },
  });

  const updateBonusPenaltyMutation = useMutation({
    mutationFn: (data: Partial<Omit<BonusPenaltyPolicy, 'id'>>) => updateBonusPenaltyApi(data),
    onSuccess: (_result, data) => {
      showToast(`Đã lưu chính sách thưởng/phạt cho kỳ ${data.effective_period || selectedPeriod}.`, 'success', 'Cập nhật chính sách lương thành công');
      queryClient.invalidateQueries({ queryKey: BONUS_PENALTY_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: PAYROLL_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['attendanceAdjustments'] });
    },
    onError: (err: Error) => {
      showToast(`Lỗi khi cập nhật chính sách thưởng/phạt: ${err.message || ''}`, 'error', "Không thể cập nhật chính sách lương");
    },
  });

  return {
    payroll: payrollQuery.data || [],
    bonusPenalty: bonusPenaltyQuery.data || null,
    selectedPeriod,
    setSelectedPeriod,
    isLoadingPayroll: payrollQuery.isLoading,
    payrollError: payrollQuery.error,
    generatePayroll: (period: string) => generatePayrollMutation.mutateAsync(period),
    updatePayrollItem: (id: string, updates: PayrollItemUpdates) =>
      updatePayrollItemMutation.mutateAsync({ id, updates }),
    finalizePayrollPeriod: (period: string) => finalizePayrollPeriodMutation.mutateAsync(period),
    unlockPayrollPeriod: (period: string) => unlockPayrollPeriodMutation.mutateAsync(period),
    updateBonusPenalty: (data: Partial<Omit<BonusPenaltyPolicy, 'id'>>) => updateBonusPenaltyMutation.mutateAsync(data),
  };
}
