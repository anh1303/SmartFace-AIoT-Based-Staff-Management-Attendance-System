import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useEmployees } from '../hooks/useEmployees';
import type { Employee } from '../types';
import { useAuth } from '@/features/auth';

export interface EmployeeContextType {
  employees: Employee[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetchEmployees: () => void;
  addEmployee: (emp: Omit<Employee, 'created_at' | 'updated_at'>) => Promise<unknown>;
  updateEmployee: (id: string, updates: Partial<Employee>) => Promise<unknown>;
  deleteEmployee: (id: string) => Promise<unknown>;
  toggleEmployeeStatus: (id: string) => Promise<void>;
  _retainData: () => () => void;
}

const EmployeeContext = createContext<EmployeeContextType | undefined>(undefined);

export const EmployeeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, isInitializing } = useAuth();
  const [dataConsumers, setDataConsumers] = useState(0);
  const retainData = useCallback(() => {
    setDataConsumers((count) => count + 1);
    return () => {
      setDataConsumers((count) => Math.max(0, count - 1));
    };
  }, []);

  const employeesHook = useEmployees(Boolean(currentUser) && !isInitializing && dataConsumers > 0);

  const value = useMemo<EmployeeContextType>(() => ({
    employees: employeesHook.employees,
    isLoading: employeesHook.isLoading,
    isError: employeesHook.isError,
    error: employeesHook.error,
    refetchEmployees: employeesHook.refetchEmployees,
    addEmployee: employeesHook.addEmployee,
    updateEmployee: employeesHook.updateEmployee,
    deleteEmployee: employeesHook.deleteEmployee,
    toggleEmployeeStatus: employeesHook.toggleEmployeeStatus,
    _retainData: retainData,
  }), [
    employeesHook.employees,
    employeesHook.isLoading,
    employeesHook.isError,
    employeesHook.error,
    employeesHook.refetchEmployees,
    employeesHook.addEmployee,
    employeesHook.updateEmployee,
    employeesHook.deleteEmployee,
    employeesHook.toggleEmployeeStatus,
    retainData,
  ]);

  return (
    <EmployeeContext.Provider value={value}>
      {children}
    </EmployeeContext.Provider>
  );
};

export const useEmployeeContext = (options?: { loadData?: boolean }): EmployeeContextType => {
  const context = useContext(EmployeeContext);
  if (!context) {
    throw new Error('useEmployeeContext must be used within an EmployeeProvider');
  }
  const loadData = options?.loadData ?? true;
  useEffect(() => {
    if (!loadData) return;
    return context._retainData();
  }, [context._retainData, loadData]);
  return context;
};
