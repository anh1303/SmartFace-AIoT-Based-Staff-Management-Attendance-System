import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePayroll, type PayrollItemUpdates } from '../hooks/usePayroll';
import type { PayrollRecord, BonusPenaltyPolicy } from '../types';
import { useAuth } from '@/features/auth';

export interface PayrollContextType {
  payroll: PayrollRecord[];
  bonusPenalty: BonusPenaltyPolicy | null;
  selectedPeriod: string;
  setSelectedPeriod: (period: string) => void;
  isLoadingPayroll?: boolean;
  payrollError?: Error | null;
  generatePayroll: (period: string) => Promise<PayrollRecord[] | void>;
  updatePayrollItem: (id: string, updates: PayrollItemUpdates) => Promise<PayrollRecord | void>;
  finalizePayrollPeriod: (period: string) => void;
  unlockPayrollPeriod: (period: string) => void;
  updateBonusPenalty: (data: Partial<Omit<BonusPenaltyPolicy, 'id'>>) => Promise<BonusPenaltyPolicy | void>;
  _retainData: () => () => void;
}

const PayrollContext = createContext<PayrollContextType | undefined>(undefined);

export const PayrollProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, isInitializing } = useAuth();
  const [dataConsumers, setDataConsumers] = useState(0);
  const retainData = useCallback(() => {
    setDataConsumers((count) => count + 1);
    return () => {
      setDataConsumers((count) => Math.max(0, count - 1));
    };
  }, []);

  const payrollHook = usePayroll(Boolean(currentUser) && !isInitializing && dataConsumers > 0);

  const value = useMemo<PayrollContextType>(() => ({
    payroll: payrollHook.payroll,
    bonusPenalty: payrollHook.bonusPenalty,
    selectedPeriod: payrollHook.selectedPeriod,
    setSelectedPeriod: payrollHook.setSelectedPeriod,
    isLoadingPayroll: payrollHook.isLoadingPayroll,
    payrollError: payrollHook.payrollError,
    generatePayroll: async (period: string) => {
      return await payrollHook.generatePayroll(period);
    },
    updatePayrollItem: payrollHook.updatePayrollItem,
    finalizePayrollPeriod: payrollHook.finalizePayrollPeriod,
    unlockPayrollPeriod: payrollHook.unlockPayrollPeriod,
    updateBonusPenalty: async (data) => {
      return await payrollHook.updateBonusPenalty(data);
    },
    _retainData: retainData,
  }), [
    payrollHook.payroll,
    payrollHook.bonusPenalty,
    payrollHook.selectedPeriod,
    payrollHook.setSelectedPeriod,
    payrollHook.isLoadingPayroll,
    payrollHook.payrollError,
    payrollHook.generatePayroll,
    payrollHook.updatePayrollItem,
    payrollHook.finalizePayrollPeriod,
    payrollHook.unlockPayrollPeriod,
    payrollHook.updateBonusPenalty,
    retainData,
  ]);

  return (
    <PayrollContext.Provider value={value}>
      {children}
    </PayrollContext.Provider>
  );
};

export const usePayrollContext = (options?: { loadData?: boolean }): PayrollContextType => {
  const context = useContext(PayrollContext);
  if (!context) {
    throw new Error('usePayrollContext must be used within a PayrollProvider');
  }
  const loadData = options?.loadData ?? true;
  useEffect(() => {
    if (!loadData) return;
    return context._retainData();
  }, [context._retainData, loadData]);
  return context;
};
