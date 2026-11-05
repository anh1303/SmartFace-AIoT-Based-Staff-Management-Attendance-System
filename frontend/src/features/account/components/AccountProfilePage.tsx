import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Camera, Check } from 'lucide-react';
import { profileApi, meApi, type AccountProfile, type ProfileInput } from '@/features/auth';
import { useAuth, getActiveSessionId, getActiveUsername } from '../../../context/AuthContext';
import { PageHeaderBanner } from '../../../components/common/PageHeaderBanner';
import { PasswordForm } from './PasswordForm';

export const AccountProfilePage: React.FC = () => {
  const { currentUser, sessionId } = useAuth();
  const username = currentUser?.username || currentUser?.employee_id || 'anonymous';
  const query = useQuery({ queryKey: ['accountProfile', username], queryFn: profileApi.get, enabled: !!currentUser });
  return <div className="space-y-6">
    <PageHeaderBanner title="Hồ sơ cá nhân" icon={<div className="w-10 h-10 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0"><User className="w-5 h-5" /></div>}/>
    {query.isPending ? <div role="status" className="sf-empty">Đang tải hồ sơ…</div> : query.isError ? <div className="sf-feedback error" role="alert">{query.error.message} <button className="underline" onClick={() => query.refetch()}>Thử lại</button></div> : query.data && <ProfileEditor key={`${username}-${sessionId}`} profile={query.data} username={username}/>}
  </div>;
};

function ProfileEditor({ profile, username }: { profile: AccountProfile; username: string }) {
  const [tab, setTab] = useState<'personal' | 'security' | 'work'>('personal');
  const [draft, setDraft] = useState<ProfileInput>({ display_name: profile.display_name, contact_email: profile.contact_email, phone: profile.phone });
  const [avatar, setAvatar] = useState(profile.avatar);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState('');
  const [validationError, setValidationError] = useState('');
  const [saved, setSaved] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const client = useQueryClient();
  const { setCurrentUserSession } = useAuth();
  const dirty = draft.display_name !== profile.display_name || draft.contact_email !== profile.contact_email || draft.phone !== profile.phone || avatar !== profile.avatar;
  useEffect(() => { if (!dirty) return; const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [dirty]);
  const update = useMutation({
    mutationFn: async (input: ProfileInput) => {
      const capturedSessionId = getActiveSessionId();
      return { data: await profileApi.update(input), capturedSessionId };
    },
    onSuccess: async ({ data, capturedSessionId }) => {
      if (getActiveSessionId() !== capturedSessionId || getActiveUsername() !== username) return;
      client.setQueryData(['accountProfile', username], data);
      client.invalidateQueries({ queryKey: ['employees'] });
      setSaved(true);
      const session = await meApi();
      if (session && getActiveSessionId() === capturedSessionId && getActiveUsername() === username) {
        setCurrentUserSession(session);
        const store = localStorage.getItem('userSession') ? localStorage : sessionStorage;
        store.setItem('userSession', JSON.stringify(session));
      }
    },
  });
  const save = (next: ProfileInput, nextAvatar = avatar) => {
    if (update.isPending || imageBusy) return;
    if (next.display_name.trim().length < 2 || next.display_name.trim().length > 100) { setValidationError('Họ và tên cần có từ 2 đến 100 ký tự.'); return; }
    if (next.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.contact_email)) { setValidationError('Email không hợp lệ.'); return; }
    if (!/^[+\d\s().-]*$/.test(next.phone)) { setValidationError('Số điện thoại không hợp lệ.'); return; }
    setValidationError('');
    if (next.display_name === profile.display_name && next.contact_email === profile.contact_email && next.phone === profile.phone && nextAvatar === profile.avatar) return;
    setSaved(false);
    update.mutate({ ...next, avatar: nextAvatar });
  };
  const upload = async (selected: File | undefined) => {
    if (!selected) return;
    setImageError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type) || selected.size > 5 * 1024 * 1024) { setImageError('Chọn ảnh JPG, PNG hoặc WebP, tối đa 5MB.'); return; }
    setImageBusy(true);
    try {
      const bitmap = await createImageBitmap(selected);
      if (bitmap.width < 1 || bitmap.height < 1 || bitmap.width > 12000 || bitmap.height > 12000) { bitmap.close(); throw new Error('Ảnh có kích thước không phù hợp.'); }
      const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
      const context = canvas.getContext('2d');
      if (!context) { bitmap.close(); throw new Error('Không xử lý được ảnh.'); }
      const size = Math.min(bitmap.width, bitmap.height);
      context.drawImage(bitmap, (bitmap.width - size) / 2, (bitmap.height - size) / 2, size, size, 0, 0, 256, 256);
      bitmap.close();
      const nextAvatar = canvas.toDataURL('image/jpeg', .86);
      setAvatar(nextAvatar);
      setSaved(false);
    } catch (error) { setImageError(error instanceof Error ? error.message : 'Không đọc được ảnh.'); }
    finally { setImageBusy(false); if (file.current) file.current.value = ''; }
  };
  const tabs = [{ id: 'personal', label: 'Thông tin cá nhân' }, { id: 'security', label: 'Bảo mật tài khoản' }, { id: 'work', label: 'Thông tin công tác' }] as const;
  return <section className="sf-panel p-5 sm:p-6">
    <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-[#272d5a] pb-5" role="tablist" aria-label="Mục hồ sơ">
      {tabs.map(item => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === item.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-[#181c38] dark:text-slate-300 dark:hover:bg-[#20254b]'}`}>{item.label}</button>)}
    </div>
    {tab === 'personal' && <div role="tabpanel" className="space-y-5 pt-6">
      <div className="flex flex-wrap gap-5 items-center">
        <div className="sf-profile-avatar">{avatar ? <img src={avatar} alt="Ảnh đại diện tài khoản"/> : <User size={36}/>}</div>
        <div className="space-y-2"><h2 className="font-semibold">Ảnh đại diện</h2>
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Chọn ảnh đại diện" onChange={e => upload(e.target.files?.[0])} disabled={update.isPending || imageBusy}/>
          <div className="flex flex-wrap gap-2"><button type="button" className="sf-button" onClick={() => file.current?.click()} disabled={update.isPending || imageBusy}><Camera size={16}/>Đổi ảnh</button></div>
        </div>
      </div>
      {imageError && <p role="alert" className="text-rose-700 text-sm">{imageError}</p>}
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="sf-field">Họ và tên<input className="sf-input" value={draft.display_name} required minLength={2} maxLength={100} autoComplete="name" disabled={update.isPending} onChange={e => { setDraft({ ...draft, display_name: e.target.value }); setSaved(false); }}/></label>
        <label className="sf-field">Email<input className="sf-input" type="email" value={draft.contact_email} maxLength={100} autoComplete="email" disabled={update.isPending} onChange={e => { setDraft({ ...draft, contact_email: e.target.value }); setSaved(false); }}/></label>
        <label className="sf-field">Số điện thoại<input className="sf-input" type="tel" maxLength={20} pattern="[+0-9 ().-]*" value={draft.phone} autoComplete="tel" disabled={update.isPending} onChange={e => { setDraft({ ...draft, phone: e.target.value }); setSaved(false); }}/></label>
      </div>
      {update.isError && <div className="sf-feedback error" role="alert">{update.error.message} <button className="underline" onClick={() => save(draft, avatar)}>Thử lưu lại</button></div>}
      {validationError && <div className="sf-feedback error" role="alert">{validationError}</div>}
      {saved && <div className="sf-feedback" role="status"><Check size={17}/>Đã lưu thông tin.</div>}
      <div className="sf-footer"><button type="button" className="sf-button primary" disabled={update.isPending || imageBusy} onClick={() => save(draft)}>{update.isPending ? 'Đang lưu…' : 'Lưu'}</button></div>
    </div>}
    {tab === 'security' && <div role="tabpanel" className="pt-6"><PasswordForm/></div>}
    {tab === 'work' && <div role="tabpanel" className="pt-6"><dl className="divide-y divide-slate-200 dark:divide-[#272d5a]">{[
      ['Mã nhân viên', profile.account.employee_code || 'Chưa liên kết hồ sơ nhân viên'],
      ['Phòng ban', profile.account.department || 'Chưa phân phòng ban'],
      ['Chức vụ', profile.account.position || 'Chưa khai báo'],
      ['Ngày vào làm', profile.account.joined_at ? new Date(profile.account.joined_at).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Chưa có thông tin'],
      ['Trạng thái', profile.account.status === 'ACTIVE' ? 'Hoạt động' : profile.account.status === 'INACTIVE' ? 'Tạm ngưng' : 'Chưa có thông tin'],
    ].map(([label, value]) => <div key={label} className="flex justify-between gap-4 py-4 text-sm"><dt className="sf-secondary">{label}</dt><dd className="font-semibold text-right">{value}</dd></div>)}</dl></div>}
  </section>;
}

