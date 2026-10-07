import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ToastContainer } from '../common/Toast';

/**
 * AppLayout is a pure presentation component responsible ONLY for layout composition.
 * Route authentication and role authorizations are decoupled and handled by AuthGuard.
 */
export const AppLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f5f7fc] dark:bg-[#0b0d19] text-slate-800 dark:text-slate-100 flex transition-colors duration-200">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Topbar
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#f5f7fc] dark:bg-[#0b0d19] cyber-grid transition-colors duration-200">
          <div className="max-w-7xl mx-auto space-y-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Reusable Global Overlays */}
      <ToastContainer />
    </div>
  );
};