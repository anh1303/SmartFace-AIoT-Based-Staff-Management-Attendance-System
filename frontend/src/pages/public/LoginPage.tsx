import {PublicThemeToggle} from '../../components/public/PublicThemeToggle';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ScanFace, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
export const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [visible, setVisible] = useState(false);
    const [remember, setRemember] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const demo = import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === 'true';
    const submit = async (user = identifier, pass = password) => { setBusy(true); setError(''); try {
        const result = await login(user, pass, remember);
        if (result.success)
            navigate(result.role === 'employee' ? '/app/employee/dashboard' : '/app/manager/dashboard');
        else
            setError(result.message || 'Không thể đăng nhập. Vui lòng thử lại.');
    }
    finally {
        setBusy(false);
    } };
    return <div className="sf-login"><section className="sf-login-story"><img className="sf-login-backdrop" src="/images/smartface-team.webp" width={1122} height={1402} fetchPriority="high" alt=""/><div className="sf-login-shade" aria-hidden="true"/><div className="sf-login-brand-row"><Link to="/" className="sf-brand !p-0"><ScanFace size={32}/><span>SmartFace</span></Link><PublicThemeToggle/></div><div className="sf-login-editorial"><p className="sf-eyebrow">CON NGƯỜI LÀ TRỌNG TÂM</p><h1>Công việc rõ ràng.<br/>Đội ngũ an tâm.</h1><p>Từ ngày làm việc đến kỳ lương, cùng nhau tạo nên một nơi làm việc minh bạch hơn.</p></div><p className="sf-login-note">Chấm công · Nhân sự · Tiền lương <span>· Hình ảnh minh họa</span></p></section><section className="sf-login-form"><div className="w-full max-w-sm"><p className="text-blue-700 text-sm font-semibold mb-3">CHÀO MỪNG TRỞ LẠI</p><h2 className="text-3xl font-semibold">Đăng nhập SmartFace</h2><p className="text-slate-500 mt-3 mb-8">Tiếp tục công việc của bạn.</p><form className="space-y-5" onSubmit={e => { e.preventDefault(); submit(); }}><label className="sf-field">Tên đăng nhập<input className="sf-input" name="username" autoComplete="username" value={identifier} onChange={e => setIdentifier(e.target.value)} required disabled={busy} placeholder="Tên đăng nhập hoặc email"/></label><label className="sf-field">Mật khẩu<div className="relative"><input className="sf-input pr-12" name="password" autoComplete="current-password" type={visible ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required disabled={busy}/><button className="sf-icon-button absolute right-1 top-0" type="button" aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setVisible(v => !v)}>{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} disabled={busy}/>Ghi nhớ phiên đăng nhập</label>{error && <div role="alert" className="sf-feedback error">{error}</div>}<button className="sf-button primary w-full" disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}<ArrowRight size={18}/></button></form><Link to="/" className="inline-block text-sm text-slate-500 mt-6 hover:text-blue-700">← Trang giới thiệu</Link><Link to="/policies" className="inline-block text-sm text-blue-700 mt-6 ml-5">Chính sách công ty</Link>{demo && <div className="mt-8 border-t border-slate-200 pt-5"><p className="text-xs text-amber-800 mb-3">Bản xem thử · dữ liệu minh họa, chưa kết nối backend</p><div className="flex flex-wrap gap-2">{[['admin', 'Quản trị'], ['manager', 'Quản lý'], ['employee', 'Nhân viên']].map(([role, label]) => <button key={role} className="sf-button" disabled={busy} onClick={() => submit(`demo-${role}`, 'demo')}>{label}</button>)}</div></div>}</div></section></div>;
};
