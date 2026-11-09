import { useEffect, useRef, useState } from 'react';
import { Camera, ScanFace } from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import { useAuth } from '../../../context/AuthContext';
import { faceLoginApi } from '../api/faceLoginApi';
import { cameraDelay, captureJpeg, stopCamera } from '../lib/faceCamera';

export function FaceLoginModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { loginWithFace } = useAuth();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const locked = useRef(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Đang chuẩn bị camera…');
  const [error, setError] = useState('');

  useEffect(() => {
    mounted.current = true;
    const abort = new AbortController();
    controller.current = abort;
    async function open() {
      try {
        if (!(await faceLoginApi.config(abort.signal))) throw new Error('Đăng nhập khuôn mặt chưa được bật. Bạn có thể đăng nhập bằng mật khẩu.');
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera cần HTTPS hoặc localhost và trình duyệt hỗ trợ camera.');
        const camera = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } });
        if (abort.signal.aborted) { stopCamera(camera); return; }
        stream.current = camera;
        for (const track of camera.getTracks()) track.onended = () => {
          if (mounted.current) { setReady(false); setError('Camera đã ngắt. Vui lòng đóng màn hình này và thử lại.'); }
        };
        if (video.current) { video.current.srcObject = camera; await video.current.play(); }
        await cameraDelay(800, abort.signal);
        if (!abort.signal.aborted) { setReady(true); setMessage('Đưa một khuôn mặt vào giữa khung, giữ đủ sáng.'); }
      } catch (failure) {
        stopCamera(stream.current); stream.current = null;
        if (!abort.signal.aborted) {
          setMessage('Chưa thể bắt đầu nhận diện.');
          const denied = failure instanceof DOMException && failure.name === 'NotAllowedError';
          setError(denied ? 'Chưa được phép dùng camera. Hãy cho phép camera trong trình duyệt rồi mở lại.'
            : failure instanceof Error ? failure.message : 'Không mở được camera. Vui lòng thử lại.');
        }
      }
    }
    void open();
    return () => { mounted.current = false; abort.abort(); stopCamera(stream.current); stream.current = null; };
  }, []);

  async function scan() {
    const signal = controller.current?.signal;
    if (locked.current || !ready || !video.current || !signal) return;
    locked.current = true; setBusy(true); setError('');
    const frames: string[] = [];
    try {
      const challenge = await faceLoginApi.challenge(signal);
      setMessage('Nhìn thẳng và giữ khuôn mặt trong khung.');
      for (let index = 0; index < 8; index++) {
        await cameraDelay(200, signal);
        if (!video.current || Date.now() >= challenge.expiresAt) throw new Error('Lượt nhận diện đã hết hạn. Vui lòng thử lại.');
        frames.push(captureJpeg(video.current));
      }
      setMessage('Đang xác thực khuôn mặt…');
      const result = await loginWithFace(challenge.challengeId, frames, signal);
      if (signal.aborted) return;
      if (!result.success) throw new Error(result.message || 'Không thể xác thực. Vui lòng thử lại.');
      stopCamera(stream.current); stream.current = null;
      onSuccess();
    } catch (failure) {
      if (!signal.aborted) { setError(failure instanceof Error ? failure.message : 'Không thể xác thực. Vui lòng thử lại.'); setMessage('Nhìn thẳng vào camera để bắt đầu lại.'); }
    } finally {
      frames.length = 0; locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return <Modal isOpen onClose={() => { if (!locked.current) onClose(); }} title="Đăng nhập bằng khuôn mặt" subtitle="Nhận diện để mở tài khoản SmartFace của bạn" maxWidth="lg">
    <div className="space-y-5">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-950">
        <video ref={video} autoPlay muted playsInline aria-label="Hình ảnh camera đăng nhập" className="h-full w-full object-contain"/>
        {!ready && <div className="absolute inset-0 flex items-center justify-center text-slate-300"><Camera size={40} aria-hidden="true"/></div>}
        {ready && <>
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-slate-950/25 backdrop-blur-sm" style={{ maskImage: 'radial-gradient(ellipse 20% 38% at center, transparent 98%, black 100%)', WebkitMaskImage: 'radial-gradient(ellipse 20% 38% at center, transparent 98%, black 100%)' }}/>
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-[12%] inset-x-[30%] rounded-[50%] border-2 border-white/80"/>
        </>}
      </div>
      <p role="status" aria-live="polite" className="text-sm leading-6">{message}</p>
      {error && <div role="alert" className="sf-feedback error">{error}</div>}
      <p className="sf-secondary text-sm leading-6">Sử dụng khuôn mặt đã đăng ký Face ID trong hệ thống. Giữ khuôn mặt rõ và đủ sáng.</p>
      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" className="sf-button" disabled={busy} onClick={onClose}>Quay lại</button>
        <button type="button" className="sf-button primary" disabled={!ready || busy} onClick={() => void scan()}><ScanFace size={18}/>{busy ? 'Đang nhận diện…' : error ? 'Thử lại' : 'Bắt đầu nhận diện'}</button>
      </div>
    </div>
  </Modal>;
}
