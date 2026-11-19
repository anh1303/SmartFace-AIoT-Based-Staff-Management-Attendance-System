import { useEffect, useRef, useState } from 'react';
import { Camera, ScanFace } from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import { useAuth } from '../context/AuthContext';
import { FaceLoginHttpError, faceLoginApi } from '../api/faceLoginApi';
import { cameraDelay, captureJpeg, stopCamera } from '../lib/faceCamera';
import { FACE_LOGIN_TIMEOUTS, withBoundedSignal } from '../lib/faceLoginRequest';

const MIN_INTERVAL_MS = 200;
const TIMEOUT_MESSAGE = 'Không nhận diện được trong thời gian cho phép. Vui lòng thử lại.';

function isAbortOrTimeoutError(failure: unknown): boolean {
  const name = (failure as { name?: string } | null)?.name;
  const message = (failure as { message?: string } | null)?.message ?? '';
  return (
    name === 'TimeoutError' ||
    name === 'AbortError' ||
    message === 'The operation timed out.' ||
    message === 'The operation was aborted.'
  );
}

/**
 * Streaming face login: one fresh frame per acknowledged request, at most one
 * in flight, at least 200 ms between frame starts. Uses monotonic performance.now()
 * with server remainingMs (subtracting request RTT) and an independent deadline timer.
 */
export function FaceLoginModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { completeFaceLogin, isLoggingOut } = useAuth();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const controller = useRef<AbortController | null>(null);
  const scanController = useRef<AbortController | null>(null);
  const deadlineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const locked = useRef(false);
  const completing = useRef(false);
  const loggingOut = useRef(false);
  loggingOut.current = Boolean(isLoggingOut);
  const generation = useRef(0);
  const activeAttempt = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [message, setMessage] = useState('Đang chuẩn bị camera…');
  const [error, setError] = useState('');

  function clearDeadlineTimer() {
    if (deadlineTimer.current !== null) {
      clearTimeout(deadlineTimer.current);
      deadlineTimer.current = null;
    }
  }

  function cancelActive() {
    generation.current += 1; // fence stale responses before the async cancel
    clearDeadlineTimer();
    scanController.current?.abort();
    scanController.current = null;
    const id = activeAttempt.current;
    activeAttempt.current = null;
    if (id && !completing.current) void faceLoginApi.cancel(id);
  }

  useEffect(() => {
    mounted.current = true;
    const abort = new AbortController();
    controller.current = abort;
    async function open() {
      try {
        const enabled = await withBoundedSignal(FACE_LOGIN_TIMEOUTS.CONFIG_MS, abort.signal, (sig) => faceLoginApi.config(sig));
        if (!enabled) throw new Error('Đăng nhập khuôn mặt chưa được bật. Bạn có thể đăng nhập bằng mật khẩu.');
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera cần HTTPS hoặc localhost và trình duyệt hỗ trợ camera.');
        const camera = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } });
        if (abort.signal.aborted) { stopCamera(camera); return; }
        stream.current = camera;
        for (const track of camera.getTracks()) track.onended = () => {
          if (mounted.current) { cancelActive(); setReady(false); setError('Camera đã ngắt. Vui lòng đóng màn hình này và thử lại.'); }
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
            : isAbortOrTimeoutError(failure) ? TIMEOUT_MESSAGE
            : failure instanceof Error ? failure.message : 'Không mở được camera. Vui lòng thử lại.');
        }
      }
    }
    void open();
    return () => { mounted.current = false; cancelActive(); abort.abort(); stopCamera(stream.current); stream.current = null; };
  }, []);

  async function scan() {
    const modalSignal = controller.current?.signal;
    if (locked.current || !ready || !video.current || !modalSignal || modalSignal.aborted) return;
    locked.current = true; setBusy(true); setError('');
    const myGeneration = ++generation.current;
    const scanAbort = new AbortController();
    scanController.current = scanAbort;
    const signal = scanAbort.signal;
    let deadlineExpired = false;
    const current = () => !modalSignal.aborted && !signal.aborted && !deadlineExpired && generation.current === myGeneration && mounted.current;

    let localDeadlineMono = Infinity;
    const scheduleDeadlineTimer = (newDeadlineMono: number) => {
      localDeadlineMono = Math.min(localDeadlineMono, newDeadlineMono);
      clearDeadlineTimer();
      const delayMs = Math.max(0, localDeadlineMono - performance.now());
      deadlineTimer.current = setTimeout(() => {
        deadlineExpired = true;
        scanAbort.abort(new Error(TIMEOUT_MESSAGE));
      }, delayMs);
    };

    try {
      const tStartReq = performance.now();
      const attempt = await withBoundedSignal(FACE_LOGIN_TIMEOUTS.START_MS, signal, (sig) => faceLoginApi.start(sig));
      const tStartRecv = performance.now();
      if (!current()) { void faceLoginApi.cancel(attempt.attemptId); return; }
      activeAttempt.current = attempt.attemptId;

      const rawRemainingMs = typeof attempt.remainingMs === 'number'
        ? attempt.remainingMs
        : Math.max(0, attempt.expiresAt - Date.now());
      const initialRemaining = Math.max(0, rawRemainingMs - (tStartRecv - tStartReq));
      scheduleDeadlineTimer(tStartRecv + initialRemaining);

      setMessage('Nhìn thẳng và giữ khuôn mặt trong khung.');
      const interval = Math.max(MIN_INTERVAL_MS, attempt.intervalMs);
      let seq = 1;
      let verified = false;
      let lastStart = -Infinity;
      let nextDelayMs = interval;
      while (!verified) {
        const wait = lastStart + nextDelayMs - performance.now();
        if (wait > 0) await cameraDelay(wait, signal);
        if (!current()) {
          if (deadlineExpired) throw new Error(TIMEOUT_MESSAGE);
          return;
        }
        const remBeforeFrame = localDeadlineMono - performance.now();
        if (!video.current || remBeforeFrame <= 0) throw new Error(TIMEOUT_MESSAGE);
        lastStart = performance.now();
        nextDelayMs = interval;
        const frame = captureJpeg(video.current); // newest image, captured only when a send is possible
        try {
          const frameTimeout = Math.min(FACE_LOGIN_TIMEOUTS.FRAME_MS, Math.max(1, remBeforeFrame));
          const result = await withBoundedSignal(frameTimeout, signal, (sig) =>
            faceLoginApi.frame(attempt.attemptId, seq, frame, sig, remBeforeFrame),
          );
          if (!current()) {
            if (deadlineExpired) throw new Error(TIMEOUT_MESSAGE);
            return;
          }
          setMessage(result.guidance);
          verified = result.state === 'verified';
          seq = result.nextSeq;
        } catch (failure) {
          if (deadlineExpired || (signal.aborted && generation.current === myGeneration && mounted.current && !modalSignal.aborted)) {
            throw new Error(TIMEOUT_MESSAGE);
          }
          if (!current()) return;
          if (failure instanceof FaceLoginHttpError) {
            if (failure.statusCode === 429) {
              const code = failure.code;
              if (code === 'IP_RATE_LIMIT' || code === 'ATTEMPT_CAPACITY') {
                throw failure;
              }
              setMessage(failure.message || 'Hệ thống đang bận, đang thử lại…');
              lastStart = performance.now();
              nextDelayMs = code === 'ENGINE_BUSY'
                ? 200 + Math.floor(Math.random() * 201)
                : MIN_INTERVAL_MS;
              continue;
            }
            throw failure;
          }
          // Ambiguous network failure: ask the server which sequence it expects within status timeout & remaining budget.
          const remBeforeStatus = localDeadlineMono - performance.now();
          if (remBeforeStatus <= 0) throw new Error(TIMEOUT_MESSAGE);
          const tStatusReq = performance.now();
          const status = await withBoundedSignal(
            Math.min(FACE_LOGIN_TIMEOUTS.STATUS_MS, Math.max(1, remBeforeStatus)),
            signal,
            (sig) => faceLoginApi.status(attempt.attemptId, sig),
          );
          const tStatusRecv = performance.now();
          if (!current()) {
            if (deadlineExpired) throw new Error(TIMEOUT_MESSAGE);
            return;
          }
          if (typeof status.remainingMs === 'number') {
            const statusRemaining = Math.max(0, status.remainingMs - (tStatusRecv - tStatusReq));
            // Status can only shorten the local deadline, never extend it.
            scheduleDeadlineTimer(tStatusRecv + statusRemaining);
          }
          if (status.state === 'verified') verified = true;
          else if (status.state === 'ready') seq = status.nextSeq;
          else throw new Error('Lượt nhận diện đã kết thúc. Vui lòng thử lại.');
        }
      }
      clearDeadlineTimer();
      if (!current() || loggingOut.current) {
        const id = activeAttempt.current; activeAttempt.current = null;
        if (id) void faceLoginApi.cancel(id);
        return;
      }
      completing.current = true; // point of no ordinary close
      if (mounted.current) setIsCompleting(true);
      setMessage('Đang hoàn tất đăng nhập…');
      const result = await completeFaceLogin(attempt.attemptId);
      activeAttempt.current = null;
      if (!mounted.current || modalSignal.aborted || generation.current !== myGeneration || loggingOut.current) {
        return;
      }
      if (!result.success) throw new Error(result.message || 'Không thể xác thực. Vui lòng thử lại.');
      stopCamera(stream.current); stream.current = null;
      onSuccess();
    } catch (failure) {
      clearDeadlineTimer();
      const shouldReportError = (current() || completing.current || deadlineExpired) && mounted.current && !modalSignal.aborted && generation.current === myGeneration;
      if (shouldReportError) {
        if (activeAttempt.current && !completing.current) {
          const id = activeAttempt.current;
          activeAttempt.current = null;
          await faceLoginApi.cancel(id);
        }
        if (mounted.current) {
          const msg = (deadlineExpired || isAbortOrTimeoutError(failure))
            ? TIMEOUT_MESSAGE
            : failure instanceof Error ? failure.message : 'Không thể xác thực. Vui lòng thử lại.';
          setError(msg);
          setMessage('Nhìn thẳng vào camera để bắt đầu lại.');
        }
      }
    } finally {
      clearDeadlineTimer();
      completing.current = false; locked.current = false;
      if (mounted.current) { setIsCompleting(false); setBusy(false); }
    }
  }

  const close = () => { if (completing.current) return; cancelActive(); onClose(); };

  return <Modal isOpen onClose={close} title="Đăng nhập bằng khuôn mặt" subtitle="Nhận diện để mở tài khoản SmartFace của bạn" maxWidth="lg">
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
        <button type="button" className="sf-button" disabled={isCompleting} onClick={close}>Quay lại</button>
        <button type="button" className="sf-button primary" disabled={!ready || busy} onClick={() => void scan()}><ScanFace size={18}/>{busy ? 'Đang nhận diện…' : error ? 'Thử lại' : 'Bắt đầu nhận diện'}</button>
      </div>
    </div>
  </Modal>;
}
