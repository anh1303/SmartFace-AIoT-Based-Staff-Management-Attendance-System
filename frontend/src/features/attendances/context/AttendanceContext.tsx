import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/features/auth';
import { useAttendance, type AttendanceSocketEventName } from '../hooks/useAttendance';
import type { AttendanceRecord } from '../types';

export type AttendanceSocketListener = (event: AttendanceSocketEventName, payload: any) => void;

export interface AttendanceContextType {
  attendance: AttendanceRecord[];
  isLoading: boolean;
  isError: boolean;
  isTruncated: boolean;
  isSocketConnected: boolean;
  refetchAttendance: () => void;
  addAttendanceRecord: (record: Omit<AttendanceRecord, 'attendance_id'>) => void;
  subscribeAttendanceSocket: (
    listener: AttendanceSocketListener,
    options?: { handlesToast?: boolean },
  ) => () => void;
  _retainData: () => () => void;
}

const AttendanceContext = createContext<AttendanceContextType | undefined>(undefined);

export const AttendanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, isInitializing } = useAuth();
  const [dataConsumers, setDataConsumers] = useState(0);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const listenersRef = useRef<Set<AttendanceSocketListener>>(new Set());
  const detailedToastListenersRef = useRef(0);

  const retainData = useCallback(() => {
    setDataConsumers((count) => count + 1);
    return () => {
      setDataConsumers((count) => Math.max(0, count - 1));
    };
  }, []);

  const subscribeAttendanceSocket = useCallback(
    (listener: AttendanceSocketListener, options?: { handlesToast?: boolean }) => {
      listenersRef.current.add(listener);
      if (options?.handlesToast) {
        detailedToastListenersRef.current += 1;
      }
      return () => {
        listenersRef.current.delete(listener);
        if (options?.handlesToast) {
          detailedToastListenersRef.current = Math.max(0, detailedToastListenersRef.current - 1);
        }
      };
    },
    [],
  );

  const handleSocketEvent = useCallback((event: AttendanceSocketEventName, payload: any) => {
    for (const listener of listenersRef.current) {
      listener(event, payload);
    }
  }, []);

  const hasDetailedToastListener = useCallback(() => detailedToastListenersRef.current > 0, []);

  const attendanceHook = useAttendance(undefined, {
    enabled: Boolean(currentUser) && !isInitializing && dataConsumers > 0,
    connectSocket: Boolean(currentUser) && !isInitializing,
    onSocketEvent: handleSocketEvent,
    onSocketConnectionChange: setIsSocketConnected,
    hasDetailedToastListener,
  });

  const value = useMemo<AttendanceContextType>(() => ({
    attendance: attendanceHook.attendance,
    isLoading: attendanceHook.isLoading,
    isError: attendanceHook.isError,
    isTruncated: attendanceHook.isTruncated,
    isSocketConnected,
    refetchAttendance: attendanceHook.refetchAttendance,
    addAttendanceRecord: attendanceHook.addAttendanceRecord,
    subscribeAttendanceSocket,
    _retainData: retainData,
  }), [
    attendanceHook.attendance,
    attendanceHook.isLoading,
    attendanceHook.isError,
    attendanceHook.isTruncated,
    isSocketConnected,
    attendanceHook.refetchAttendance,
    attendanceHook.addAttendanceRecord,
    subscribeAttendanceSocket,
    retainData,
  ]);

  return (
    <AttendanceContext.Provider value={value}>
      {children}
    </AttendanceContext.Provider>
  );
};

export const useAttendanceContext = (options?: { loadData?: boolean }): AttendanceContextType => {
  const context = useContext(AttendanceContext);
  if (!context) {
    throw new Error('useAttendanceContext must be used within an AttendanceProvider');
  }
  const loadData = options?.loadData ?? true;
  useEffect(() => {
    if (!loadData) return;
    return context._retainData();
  }, [context._retainData, loadData]);
  return context;
};
