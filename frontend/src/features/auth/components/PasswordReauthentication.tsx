import { useState } from 'react';
import { faceLoginApi } from '../api/faceLoginApi';

export function PasswordReauthentication({ onComplete }: { onComplete: () => void }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <form className="mt-4 space-y-3" onSubmit={async event => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try { await faceLoginApi.passwordSession(password); setPassword(''); onComplete(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Chưa xác thực được mật khẩu.'); }
    finally { setBusy(false); }
  }}>
    <label className="sf-field">Xác nhận mật khẩu để tiếp tục<input className="sf-input" type="password" autoComplete="current-password" required maxLength={200} value={password} disabled={busy} onChange={event => setPassword(event.target.value)}/></label>
    {error && <p role="alert" className="sf-feedback error">{error}</p>}
    <button className="sf-button" disabled={busy}>{busy ? 'Đang xác thực…' : 'Xác thực và lưu'}</button>
  </form>;
}
