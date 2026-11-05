export function stopCamera(stream: MediaStream | null) {
  stream?.getTracks().forEach(track => track.stop());
}

export function captureJpeg(video: HTMLVideoElement): string {
  if (!video.videoWidth || !video.videoHeight) throw new Error('Camera chưa sẵn sàng. Vui lòng chờ một chút.');
  const canvas = document.createElement('canvas');
  const ratio = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight));
  canvas.width = Math.max(1, Math.round(video.videoWidth * ratio));
  canvas.height = Math.max(1, Math.round(video.videoHeight * ratio));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Trình duyệt không xử lý được ảnh camera.');
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const jpeg = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
  const bytes = jpeg ? Math.floor(jpeg.length * 3 / 4) - (jpeg.endsWith('==') ? 2 : jpeg.endsWith('=') ? 1 : 0) : 0;
  if (!bytes || bytes > 200 * 1024) throw new Error('Ảnh camera quá lớn. Vui lòng thử lại.');
  return jpeg;
}

export function cameraDelay(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Cancelled', 'AbortError')); return; }
    const abort = () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, milliseconds);
    signal.addEventListener('abort', abort, { once: true });
  });
}
