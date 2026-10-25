import React, { createContext, useContext, useMemo } from 'react';
import { useAttendance } from '@/features/attendances';
import { AttendanceRecord } from '../types';

export interface AttendanceContextType {
  attendance: AttendanceRecord[];
  isLoading: boolean;
  isError: boolean;
  refetchAttendance: () => void;
  addAttendanceRecord: (record: Omit<AttendanceRecord, 'attendance_id'>) => void;
}

const AttendanceContext = createContext<AttendanceContextType | undefined>(undefined);

export const AttendanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const attendanceHook = useAttendance();

  const value = useMemo<AttendanceContextType>(() => ({
    attendance: attendanceHook.attendance,
    isLoading: attendanceHook.isLoading,
    isError: attendanceHook.isError,
    refetchAttendance: attendanceHook.refetchAttendance,
    addAttendanceRecord: attendanceHook.addAttendanceRecord,
  }), [
    attendanceHook.attendance,
    attendanceHook.isLoading,
    attendanceHook.isError,
    attendanceHook.refetchAttendance,
    attendanceHook.addAttendanceRecord,
  ]);

  return (
    <AttendanceContext.Provider value={value}>
      {children}
    </AttendanceContext.Provider>
  );
};

export const useAttendanceContext = (): AttendanceContextType => {
  const context = useContext(AttendanceContext);
  if (!context) {
    throw new Error('useAttendanceContext must be used within an AttendanceProvider');
  }
  return context;
};
