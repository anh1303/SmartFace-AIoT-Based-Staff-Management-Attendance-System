import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useShifts } from '../hooks/useShifts';
import type { WorkShift } from '../types';
import { useAuth } from '@/features/auth';

export interface ShiftContextType {
  workShifts: WorkShift[];
  isLoading: boolean;
  isError: boolean;
  refetchShifts: () => void;
  assignOrUpdateShift: (shift: Omit<WorkShift, 'shift_id'> & { shift_id?: string }) => Promise<WorkShift>;
  _retainData: () => () => void;
}

const ShiftContext = createContext<ShiftContextType | undefined>(undefined);

export const ShiftProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, isInitializing } = useAuth();
  const [dataConsumers, setDataConsumers] = useState(0);
  const retainData = useCallback(() => {
    setDataConsumers((count) => count + 1);
    return () => {
      setDataConsumers((count) => Math.max(0, count - 1));
    };
  }, []);

  const shiftsHook = useShifts(Boolean(currentUser) && !isInitializing && dataConsumers > 0);

  const value = useMemo<ShiftContextType>(() => ({
    workShifts: shiftsHook.workShifts,
    isLoading: shiftsHook.isLoading,
    isError: shiftsHook.isError,
    refetchShifts: shiftsHook.refetchShifts,
    assignOrUpdateShift: shiftsHook.assignOrUpdateShift,
    _retainData: retainData,
  }), [
    shiftsHook.workShifts,
    shiftsHook.isLoading,
    shiftsHook.isError,
    shiftsHook.refetchShifts,
    shiftsHook.assignOrUpdateShift,
    retainData,
  ]);

  return (
    <ShiftContext.Provider value={value}>
      {children}
    </ShiftContext.Provider>
  );
};

export const useShiftContext = (options?: { loadData?: boolean }): ShiftContextType => {
  const context = useContext(ShiftContext);
  if (!context) {
    throw new Error('useShiftContext must be used within a ShiftProvider');
  }
  const loadData = options?.loadData ?? true;
  useEffect(() => {
    if (!loadData) return;
    return context._retainData();
  }, [context._retainData, loadData]);
  return context;
};
