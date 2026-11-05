import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { profileApi } from '@/features/auth';
import { useAuth, getActiveSessionId, getActiveUsername } from '../../../context/AuthContext';

export function PasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [visible, setVisible] = useState([false, false, false]);
  const [validation, setValidation] = useState('');
  const [currentError, setCurrentError] = useState('');
  const checkSequence = useRef(0);
  const { logout } = useAuth();
  const navigate = useNavigate();
  const verifyCurrent = async (password: string) => {
    if (!password || mutation.isPending) return;
    const sequence = ++checkSequence.current;
    try {
      await profileApi.verifyPassword(password);
      if (sequence === checkSequence.current) setCurrentError('');
    } catch (error) {
      if (sequence === checkSequence.current) setCurrentError(error instanceof Error ? error.message : 'Không thể kiểm tra mật khẩu hiện tại.');
    }
  };
  const mutation = useMutation({
    mutationFn: async () => {
      const sessionId = getActiveSessionId(), username = getActiveUsername();
      const result = await profileApi.changePassword(current, next);
      return { sessionId, username, result };
    },
    onSuccess: async ({ sessionId, username, result }) => {
      if (getActiveSessionId() !== sessionId || getActiveUsername() !== username) return;
      setCurrent(''); setNext(''); setConfirm('');
      const emailStatus = result?.email_status;
      const message = emailStatus === 'sent'
        ? 'Đổi mật khẩu thành công. Email thông báo đã được gửi. Vui lòng đăng nhập lại.'
        : 'Đổi mật khẩu thành công. Chưa gửi được email thông báo. Vui lòng đăng nhập lại.';
      try { await logout(); } finally { navigate('/login', { replace: true, state: { passwordChangeMessage: message } }); }
    },
  });
  const fields = [
    { label: 'Mật khẩu hiện tại', placeholder: 'Vui lòng nhập mật khẩu hiện tại', value: current, set: setCurrent, autocomplete: 'current-password' },
    { label: 'Mật khẩu mới', placeholder: 'Vui lòng nhập mật khẩu muốn thay đổi', value: next, set: setNext, autocomplete: 'new-password' },
    { label: 'Nhập lại mật khẩu mới', placeholder: 'Vui lòng nhập lại mật khẩu mới', value: confirm, set: setConfirm, autocomplete: 'new-password' },
  ];
  return <section id="security" className="sf-panel p-5 sm:p-6">
    <h2 className="text-lg font-semibold flex gap-2 items-center"><Lock size={19}/>Tài khoản & mật khẩu</h2>
    <form className="space-y-4 mt-5" onSubmit={e => {
      e.preventDefault(); checkSequence.current++; setValidation(''); setCurrentError(''); mutation.reset();
      if (next !== confirm) { setValidation('Mật khẩu nhập lại không khớp.'); return; }
      if (next.length < 8 || !/[a-z]/.test(next) || !/[A-Z]/.test(next) || !/[0-9]/.test(next) || !/[^A-Za-z0-9\s]/.test(next)) { setValidation('Mật khẩu mới chưa đáp ứng yêu cầu.'); return; }
      if (new TextEncoder().encode(next).length > 72) { setValidation('Mật khẩu tối đa 72 byte.'); return; }
      if (next === current) { setValidation('Mật khẩu mới cần khác mật khẩu hiện tại.'); return; }
      mutation.mutate();
    }}>
      {fields.map((field, index) => <label className="sf-field" key={field.label}>{field.label}
        <div className="relative"><input className="sf-input w-full pr-12" required type={visible[index] ? 'text' : 'password'} autoComplete={field.autocomplete} placeholder={field.placeholder} value={field.value} disabled={mutation.isPending} aria-invalid={index === 0 && Boolean(currentError)} onBlur={index === 0 ? e => { void verifyCurrent(e.target.value); } : undefined} onChange={e => { if (index === 0) { checkSequence.current++; setCurrentError(''); } field.set(e.target.value); setValidation(''); mutation.reset(); }}/>
          <button className="sf-icon-button absolute right-1 top-1/2 -translate-y-1/2" type="button" aria-label={`${visible[index] ? 'Ẩn' : 'Hiện'} ${field.label.toLowerCase()}`} onClick={() => setVisible(old => old.map((value, i) => i === index ? !value : value))}>{visible[index] ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
        </div>
        {index === 0 && currentError && <span role="alert" className="text-sm font-semibold text-rose-600 dark:text-rose-400">{currentError}</span>}
      </label>)}
      <p className="sf-secondary">Mật khẩu mới cần ít nhất 8 ký tự, gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt.</p>
      {(validation || mutation.isError) && <div role="alert" className="text-sm font-semibold text-rose-600 dark:text-rose-400">{validation || mutation.error?.message}</div>}
      <div className="sf-footer"><button className="sf-button primary" disabled={mutation.isPending}>{mutation.isPending ? 'Đang đổi mật khẩu…' : 'Đổi mật khẩu'}</button></div>
    </form>
  </section>;
}
