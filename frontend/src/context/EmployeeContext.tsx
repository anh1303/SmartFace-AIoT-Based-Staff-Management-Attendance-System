import React, { createContext, useContext, useMemo } from 'react';
import { useEmployees } from '../hooks/useEmployees';
import { Employee } from '../types';

export interface EmployeeContextType {
  employees: Employee[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetchEmployees: () => void;
  addEmployee: (emp: Omit<Employee, 'created_at' | 'updated_at'>) => void;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;
  toggleEmployeeStatus: (id: string) => void;
}

const EmployeeContext = createContext<EmployeeContextType | undefined>(undefined);

export const EmployeeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const employeesHook = useEmployees();

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
