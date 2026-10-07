import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';
import { queryClient } from '../../lib/queryClient';
import { logger } from '../../utils/logger';

const errorBoundaryLogger = logger.child('ErrorBoundary');

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    errorBoundaryLogger.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleHardReload = () => {
    queryClient.clear();
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  private toggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-[#f5f7fc] dark:bg-[#0b0d19] text-slate-900 dark:text-slate-200 flex items-center justify-center p-4 sm:p-6 font-sans">
          <div className="max-w-xl w-full bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 rounded-full blur-[90px] pointer-events-none" />

            {/* Error Header */}
            <div className="flex items-center gap-3.5 mb-6">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-xs">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white font-heading tracking-tight">
                  Đã xảy ra lỗi giao diện
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Ứng dụng gặp sự cố không mong muốn trong quá trình kết xuất.
                </p>
              </div>
            </div>

            {/* Error Message Card */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] text-xs space-y-2 mb-6">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-semibold">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>Chi tiết lỗi:</span>
              </div>
              <p className="text-slate-700 dark:text-slate-300 font-mono text-[11px] break-words">
                {this.state.error?.message || 'Không thể xác định nguyên nhân sự cố'}
              </p>
            </div>

            {/* Collapsible Stack Trace */}
            {this.state.errorInfo && (
              <div className="mb-6">
                <button
                  type="button"
                  onClick={this.toggleDetails}
                  className="flex items-center justify-between w-full text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 py-1"
                >
                  <span>Xem thông tin kỹ thuật (Stack Trace)</span>
                  {this.state.showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {this.state.showDetails && (
                  <pre className="mt-2 p-3 bg-slate-50 dark:bg-[#0f1224] rounded-xl border border-slate-200 dark:border-[#272d5a] text-[10px] font-mono text-slate-600 dark:text-slate-400 overflow-x-auto max-h-48 whitespace-pre-wrap leading-relaxed">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200 dark:border-[#21264b]">
              <button
                type="button"
                onClick={this.handleReset}
                className="py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Thử lại</span>
              </button>
              <button
                type="button"
                onClick={this.handleHardReload}
                className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1a1e3a] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#272d5a] font-semibold text-xs transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Làm mới trang</span>
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1a1e3a] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#272d5a] font-semibold text-xs transition-colors flex items-center justify-center gap-2"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Về trang chủ</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
