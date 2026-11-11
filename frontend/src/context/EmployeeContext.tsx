import React, { createContext, useContext, useMemo } from 'react';
import { useEmployees } from '../features/employees/hooks/useEmployees';
import { Employee } from '../types';
import { useAuth } from './AuthContext';

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
}

const EmployeeContext = createContext<EmployeeContextType | undefined>(undefined);

export const EmployeeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, isInitializing } = useAuth();
  const employeesHook = useEmployees(Boolean(currentUser) && !isInitializing);

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
  ]);

  return (
    <EmployeeContext.Provider value={value}>
      {children}
    </EmployeeContext.Provider>
  );
};

export const useEmployeeContext = (): EmployeeContextType => {
  const context = useContext(EmployeeContext);
  if (!context) {
    throw new Error('useEmployeeContext must be used within an EmployeeProvider');
  }
  return context;
};
