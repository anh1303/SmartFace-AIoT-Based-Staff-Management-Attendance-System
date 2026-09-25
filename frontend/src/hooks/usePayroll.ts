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
} from '../api/payrollApi';
import { PayrollRecord, BonusPenaltyPolicy } from '../types';
import { useToast } from '../context/ToastContext';

export const PAYROLL_QUERY_KEY = ['payroll'];
export const BONUS_PENALTY_QUERY_KEY = ['bonusPenalty'];

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
    queryKey: BONUS_PENALTY_QUERY_KEY,
    queryFn: fetchBonusPenaltyApi,
    staleTime: 1000 * 60 * 10,
    retry: 1,
  });

  const generatePayrollMutation = useMutation({
    mutationFn: (period: string) => generatePayrollApi(period),
    onSuccess: (_records, period) => {
      setSelectedPeriod(period);
      showToast(`Đã tính toán bảng lương kỳ ${period} từ CSDL`, 'success');
      queryClient.invalidateQueries({ queryKey: PAYROLL_QUERY_KEY });
    },
    onError: (err: Error, period) => {
      showToast(`Lỗi khi tính toán bảng lương kỳ ${period}: ${err.message || ''}`, 'error');
    },
  });

  const updatePayrollItemMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<PayrollRecord> }) => updatePayrollItemApi(id, updates),
    onSuccess: () => {
      showToast('Đã lưu thay đổi phiếu lương vào CSDL', 'success');
      queryClient.invalidateQueries({ queryKey: PAYROLL_QUERY_KEY });
    },
    onError: (err: Error) => {
      showToast(`Lỗi khi cập nhật phiếu lương: ${err.message || ''}`, 'error');
    },
  });

  const finalizePayrollPeriodMutation = useMutation({
    mutationFn: (period: string) => finalizePayrollPeriodApi(period),
    onSuccess: (_data, period) => {
      showToast(`Đã chốt bảng lương kỳ ${period} trong CSDL`, 'success');
      queryClient.invalidateQueries({ queryKey: PAYROLL_QUERY_KEY });
    },
    onError: (err: Error, period) => {
      showToast(`Lỗi khi chốt bảng lương kỳ ${period}: ${err.message || ''}`, 'error');
    },
  });

  const unlockPayrollPeriodMutation = useMutation({
    mutationFn: (period: string) => unlockPayrollPeriodApi(period),
    onSuccess: (_records, period) => {
      showToast(`Đã mở khoá bảng lương kỳ ${period} trong CSDL`, 'warning');
      queryClient.invalidateQueries({ queryKey: PAYROLL_QUERY_KEY });
    },
    onError: (err: Error, period) => {
      showToast(`Lỗi khi mở khoá bảng lương kỳ ${period}: ${err.message || ''}`, 'error');
    },
  });

  const updateBonusPenaltyMutation = useMutation({
    mutationFn: (data: { overtime_rate?: number; late_early_penalty?: number; description?: string }) => updateBonusPenaltyApi(data),
    onSuccess: () => {
      showToast('Cập nhật chính sách thưởng/phạt vào CSDL thành công', 'success');
      queryClient.invalidateQueries({ queryKey: BONUS_PENALTY_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: PAYROLL_QUERY_KEY });
    },
    onError: (err: Error) => {
      showToast(`Lỗi khi cập nhật chính sách thưởng/phạt: ${err.message || ''}`, 'error');
    },
  });

  return {
    payroll: payrollQuery.data || [],
    bonusPenalty: bonusPenaltyQuery.data || null,
    selectedPeriod,
    setSelectedPeriod,
    isLoadingPayroll: payrollQuery.isLoading,
    generatePayroll: (period: string) => generatePayrollMutation.mutateAsync(period),
    updatePayrollItem: (id: string, updates: Partial<PayrollRecord>) => updatePayrollItemMutation.mutate({ id, updates }),
    finalizePayrollPeriod: (period: string) => finalizePayrollPeriodMutation.mutate(period),
    unlockPayrollPeriod: (period: string) => unlockPayrollPeriodMutation.mutate(period),
    updateBonusPenalty: (data: { overtime_rate?: number; late_early_penalty?: number; description?: string }) => updateBonusPenaltyMutation.mutateAsync(data),
  };
}
