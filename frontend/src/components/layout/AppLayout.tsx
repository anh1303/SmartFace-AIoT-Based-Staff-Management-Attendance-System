import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
export const AppLayout: React.FC = () => { const [open, setOpen] = useState(false); return <div className="sf-app"><a className="sf-skip" href="#main-content">Đến nội dung chính</a><Sidebar isOpen={open} onClose={() => setOpen(false)}/><div className="sf-main"><Topbar onToggleSidebar={() => setOpen(v => !v)}/>{import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === 'true' && <div className="sf-demo">DỮ LIỆU MINH HỌA · Thao tác chỉ thay đổi phiên xem thử, chưa kết nối backend/Pi.</div>}<main id="main-content" tabIndex={-1} className="sf-content"><Outlet /></main></div></div>; };
