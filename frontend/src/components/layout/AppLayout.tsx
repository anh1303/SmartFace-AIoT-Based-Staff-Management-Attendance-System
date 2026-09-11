import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ToastContainer } from '../common/Toast';

export const AppLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex">
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

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-950 cyber-grid">
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
