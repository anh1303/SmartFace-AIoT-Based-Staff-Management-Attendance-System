import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../lib/queryClient';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { ThemeProvider } from '../context/ThemeContext';
import { ToastProvider } from '../context/ToastContext';
import { AuthProvider } from '../context/AuthContext';
import { AppProvider } from '../context/AppContext';

interface AppProvidersProps {
  children: React.ReactNode;
}

/**
 * AppProviders consolidates all application-level providers into a single, clean tree:
 * 1. ErrorBoundary: Catches unhandled runtime render errors
 * 2. ThemeProvider: Global dark/light theme management
 * 3. QueryClientProvider: TanStack React Query singleton cache
 * 4. ToastProvider: Global notification toast system
 * 5. AuthProvider: Session & Auth management (with race condition protection)
 * 6. AppProvider: Application domain state (Employees, Shifts, Attendance, Payroll)
 * 7. BrowserRouter: HTML5 History API Routing
 */
export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AppProvider>
            <BrowserRouter>
              {children}
            </BrowserRouter>
          </AppProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

