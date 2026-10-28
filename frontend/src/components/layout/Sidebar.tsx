import React, { useRef, useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ScanFace, LayoutDashboard, CalendarDays, Clock, User, FileText, Users, Banknote, Fingerprint, LogOut, ExternalLink, Server, X, BarChart3 } from 'lucide-react';
import { useDialogFocus } from '../common/useDialogFocus';
export const Sidebar: React.FC<{
    isOpen: boolean;
    onClose: () => void;
}> = ({ isOpen, onClose }) => {
    const { role, currentUser, logout } = useAuth();
    const navigate = useNavigate();
    const ref = useRef<HTMLElement>(null);
    const [mobile,setMobile]=useState(()=>window.innerWidth<1024);
    useEffect(()=>{const resize=()=>setMobile(window.innerWidth<1024);window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[]);
    useDialogFocus(ref, isOpen && mobile, onClose);
    const groups = role === 'admin' || role === 'manager' ? [
        { label: 'Không gian làm việc', items: [['Tổng quan hệ thống', 'dashboard', LayoutDashboard]] },
        { label: 'Nhân sự', items: [['Nhân viên', 'employees', Users], ['Sinh trắc học', 'biometrics', Fingerprint]] },
        { label: 'Vận hành', items: [['Lịch làm việc', 'schedule', CalendarDays], ['Theo dõi chấm công', 'attendance', Clock], ['Thiết bị', 'devices', Server]] },
        { label: 'Tài chính', items: [['Bảng lương & xét duyệt', 'payroll', Banknote], ['Báo cáo & thống kê', 'reports', BarChart3]] }
    ] : [{ label: 'Công việc', items: [['Bàn làm việc', 'dashboard', LayoutDashboard], ['Lịch làm việc', 'schedule', CalendarDays], ['Lịch sử chấm công', 'attendance', Clock]] }, { label: 'Cá nhân', items: [['Hồ sơ & sinh trắc', 'profile', User], ['Lương tạm tính', 'salary-estimate', Banknote], ['Lịch sử phiếu lương', 'salary-history', FileText]] }];
    const base = role === 'admin' || role === 'manager' ? '/app/manager/' : '/app/employee/';
    return <>{isOpen && <div className="sf-nav-backdrop lg:hidden" onClick={onClose}/>}
 <aside inert={mobile && !isOpen} aria-hidden={mobile && !isOpen ? true : undefined} ref={ref} role={isOpen ? 'dialog' : undefined} aria-modal={isOpen ? true : undefined} aria-label="Điều hướng SmartFace" className={`sf-sidebar ${isOpen ? 'is-open' : ''}`}>
 <div className="sf-brand"><ScanFace size={30}/><span>SmartFace</span><button className="sf-icon-button lg:hidden ml-auto" aria-label="Đóng điều hướng" onClick={onClose}><X size={20}/></button></div>
 <div className="px-5 pb-5 text-xs text-slate-500">Chấm công · Nhân sự · Tiền lương</div>
 <nav className="flex-1 overflow-y-auto px-3">{groups.map(group => <div className="mb-6" key={group.label}><p className="sf-nav-label">{group.label}</p>{group.items.map(([label, path, Icon]) => { const I = Icon as typeof User; return <NavLink key={String(path)} to={base + path} onClick={onClose} className={({ isActive }) => `sf-nav-link ${isActive ? 'active' : ''}`}><I size={19}/><span>{String(label)}</span></NavLink>; })}</div>)}<NavLink to="/app/account/profile" onClick={onClose} className={({isActive})=>`sf-nav-link ${isActive?'active':''}`}><User size={18}/>Hồ sơ tài khoản</NavLink><NavLink to="/policies" onClick={onClose} className="sf-nav-link"><FileText size={18}/>Chính sách công ty</NavLink><NavLink to="/" onClick={onClose} className="sf-nav-link"><ExternalLink size={18}/>Trang giới thiệu</NavLink></nav>
 <div className="sf-user"><span className="sf-avatar"><User size={20}/></span><div className="min-w-0 flex-1"><p className="font-semibold text-sm truncate">{currentUser?.full_name}</p><p className="text-xs text-slate-500">{role === 'admin' ? 'Quản trị viên' : role === 'manager' ? 'Quản lý' : 'Nhân viên'}</p></div><button className="sf-icon-button" aria-label="Đăng xuất" onClick={() => { logout(); navigate('/login'); }}><LogOut size={18}/></button></div>
 </aside></>;
};
