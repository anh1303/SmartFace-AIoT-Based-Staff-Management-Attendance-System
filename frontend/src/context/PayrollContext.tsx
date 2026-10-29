import React, { createContext, useContext, useMemo } from 'react';
import { usePayroll } from '../hooks/usePayroll';
import type { PayrollItemUpdates } from '../api/payrollApi';
import { PayrollRecord, BonusPenaltyPolicy } from '../types';

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
}

const PayrollContext = createContext<PayrollContextType | undefined>(undefined);

export const PayrollProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const payrollHook = usePayroll();

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
  ]);

  return (
    <PayrollContext.Provider value={value}>
      {children}
    </PayrollContext.Provider>
  );
};

export const usePayrollContext = (): PayrollContextType => {
  const context = useContext(PayrollContext);
  if (!context) {
    throw new Error('usePayrollContext must be used within a PayrollProvider');
  }
  return context;
};
