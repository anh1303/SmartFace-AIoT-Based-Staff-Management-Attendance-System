import React, { createContext, useContext, useMemo } from 'react';
import { useShifts } from '../hooks/useShifts';
import { WorkShift } from '../types';

export interface ShiftContextType {
  workShifts: WorkShift[];
  isLoading: boolean;
  isError: boolean;
  refetchShifts: () => void;
  assignOrUpdateShift: (shift: Omit<WorkShift, 'shift_id'> & { shift_id?: string }) => void;
}

const ShiftContext = createContext<ShiftContextType | undefined>(undefined);

export const ShiftProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const shiftsHook = useShifts();

  const value = useMemo<ShiftContextType>(() => ({
    workShifts: shiftsHook.workShifts,
    isLoading: shiftsHook.isLoading,
    isError: shiftsHook.isError,
    refetchShifts: shiftsHook.refetchShifts,
    assignOrUpdateShift: shiftsHook.assignOrUpdateShift,
  }), [
    shiftsHook.workShifts,
    shiftsHook.isLoading,
    shiftsHook.isError,
    shiftsHook.refetchShifts,
    shiftsHook.assignOrUpdateShift,
  ]);

  return (
    <ShiftContext.Provider value={value}>
      {children}
    </ShiftContext.Provider>
  );
};

export const useShiftContext = (): ShiftContextType => {
  const context = useContext(ShiftContext);
  if (!context) {
    throw new Error('useShiftContext must be used within a ShiftProvider');
  }
  return context;
};
