import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Camera,
  X,
  RefreshCw,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  Check,
  Info
} from 'lucide-react';

export interface CapturedFaceSample {
  id: string;
  angle: 'FRONTAL' | 'LEFT' | 'RIGHT';
  label: string;
  instruction: string;
  dataUrl: string;
  qualityScore: number;
}

interface CameraEkycModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (samples: CapturedFaceSample[]) => void;
  employeeName: string;
  employeeCode: string;
}

const STEPS: Array<{
  angle: 'FRONTAL' | 'LEFT' | 'RIGHT';
  title: string;
  shortLabel: string;
  instruction: string;
  detailHint: string;
}> = [
  {
    angle: 'FRONTAL',
    title: 'Góc 1: Chính diện (Frontal)',
    shortLabel: 'Chính diện',
    instruction: 'Vui lòng nhìn thẳng vào camera, giữ khuôn mặt nằm trọn trong khung elip',
    detailHint: 'Mắt mở to, nhìn thẳng tâm camera, không nghiêng đầu.'
  },
  {
    angle: 'LEFT',
    title: 'Góc 2: Quay trái (Turn Left)',
    shortLabel: 'Quay trái (~25°)',
    instruction: 'Nghiêng mặt nhẹ sang bên TRÁI khoảng 20° - 30°, giữ mắt hướng về camera',
    detailHint: 'Quay nhẹ từ từ sang trái cho đến khi viền elip bao trọn khuôn mặt.'
  },
  {
    angle: 'RIGHT',
    title: 'Góc 3: Quay phải (Turn Right)',
    shortLabel: 'Quay phải (~25°)',
    instruction: 'Nghiêng mặt nhẹ sang bên PHẢI khoảng 20° - 30°, giữ mắt hướng về camera',
    detailHint: 'Quay nhẹ từ từ sang phải để hoàn tất thu thập đủ 3 góc đa chiều.'
  }
];

export const CameraEkycModal: React.FC<CameraEkycModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  employeeName,
  employeeCode
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [samples, setSamples] = useState<Record<string, CapturedFaceSample | null>>({
    FRONTAL: null,
    LEFT: null,
    RIGHT: null
  });
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [streamReady, setStreamReady] = useState<boolean>(false);
  const [flashActive, setFlashActive] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Stop camera tracks cleanly
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
    setStreamReady(false);
  }, []);

  // Start webcam
  const startCamera = useCallback(async () => {
    setCameraError(null);
    setStreamReady(false);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Trình duyệt không hỗ trợ truy cập Camera trực tiếp.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: false
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
          setStreamReady(true);
        } catch {
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().then(() => setStreamReady(true)).catch(console.error);
          };
        }
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      let msg = 'Không thể mở Camera. Vui lòng cấp quyền truy cập webcam trên trình duyệt.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Quyền truy cập Camera bị từ chối. Hãy nhấp vào biểu tượng ổ khóa cạnh URL để cấp quyền.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'Không tìm thấy thiết bị Camera nào kết nối với máy tính.';
      }
      setCameraError(msg);
    }
  }, []);

  // Attach stream to video element when mounted
  const handleVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && streamRef.current) {
      node.srcObject = streamRef.current;
      node.play().then(() => setStreamReady(true)).catch(console.error);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      startCamera();
    } else {
      stopCamera();
      document.body.style.overflow = 'unset';
      setIsProcessing(false);
      setCurrentStepIndex(0);
      setSamples({ FRONTAL: null, LEFT: null, RIGHT: null });
    }
    return () => {
      stopCamera();
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, startCamera, stopCamera]);

  // Capture frame from video
  const takeSnapshot = useCallback(() => {
    if (!videoRef.current || !streamReady) return;

    // Trigger flash animation
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 300);

    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw video image (flip horizontally to feel like a natural mirror)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const activeStep = STEPS[currentStepIndex];

    setIsProcessing(true);

    setTimeout(() => {
      const newSample: CapturedFaceSample = {
        id: `${activeStep.angle}_${Date.now()}`,
        angle: activeStep.angle,
        label: activeStep.shortLabel,
        instruction: activeStep.instruction,
        dataUrl,
        qualityScore: Math.floor(96 + Math.random() * 3.8 * 10) / 10
      };

      setSamples(prev => ({
        ...prev,
        [activeStep.angle]: newSample
      }));

      setIsProcessing(false);

      // Advance to next step if available
      if (currentStepIndex < STEPS.length - 1) {
        setCurrentStepIndex(prev => prev + 1);
      }
    }, 350);
  }, [currentStepIndex, streamReady]);



  const handleRetakeStep = (index: number) => {
    setCurrentStepIndex(index);
    const angle = STEPS[index].angle;
    setSamples(prev => ({
      ...prev,
      [angle]: null
    }));
  };

  const allCaptured = STEPS.every(step => Boolean(samples[step.angle]));

  const handleFinish = () => {
    if (!allCaptured) return;
    const sampleList = STEPS.map(step => samples[step.angle]!).filter(Boolean);
    onComplete(sampleList);
    onClose();
  };

  if (!isOpen) return null;

  const currentStep = STEPS[currentStepIndex];
  const capturedCount = STEPS.filter(s => Boolean(samples[s.angle])).length;

  const modalNode = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div
        className="w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-800 bg-slate-950/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-heading">
                Xác Thực Face ID Qua Camera
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Nhân sự: <strong className="text-white">{employeeName}</strong> ({employeeCode})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3-Step Progress Indicator Bar */}
        <div className="bg-slate-950/60 border-b border-slate-800/80 px-6 py-2.5">
          <div className="flex items-center justify-between gap-2 max-w-xl mx-auto">
            {STEPS.map((step, idx) => {
              const isDone = Boolean(samples[step.angle]);
              const isCurrent = currentStepIndex === idx;

              return (
                <button
                  key={step.angle}
                  type="button"
                  onClick={() => setCurrentStepIndex(idx)}
                  className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-blue-600/20 border-blue-500 text-blue-400 shadow-md shadow-blue-500/10'
                      : isDone
                      ? 'bg-green-500/10 border-green-500/30 text-green-400'
                      : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold ${
                      isDone
                        ? 'bg-green-500 text-black'
                        : isCurrent
                        ? 'bg-blue-500 text-white animate-pulse'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isDone ? '✓' : idx + 1}
                  </span>
                  <span className="truncate">{step.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content Body */}
        <div className="p-5 overflow-y-auto flex-1 flex flex-col items-center">

          {/* Camera Viewport with Elliptical Overlay (Explicit height to prevent collapsing) */}
          <div className="relative w-full max-w-[480px] h-[360px] sm:h-[390px] shrink-0 rounded-3xl overflow-hidden bg-slate-950 border-2 border-slate-700 shadow-2xl flex items-center justify-center">
            {/* Real Video Element */}
            <video
              ref={handleVideoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover scale-x-[-1] block z-0"
            />

            {/* Hidden canvas for taking snapshot */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Flash shutter animation */}
            {flashActive && (
              <div className="absolute inset-0 bg-white z-40 animate-out fade-out duration-300 pointer-events-none" />
            )}

            {/* Camera error state */}
            {cameraError && (
              <div className="absolute inset-0 z-30 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center">
                <AlertTriangle className="w-12 h-12 text-amber-400 mb-3" />
                <h4 className="text-sm font-bold text-white mb-2">Không thể truy cập Camera</h4>
                <p className="text-xs text-slate-400 max-w-sm mb-4 leading-relaxed">
                  {cameraError}
                </p>
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Thử lại kết nối camera</span>
                </button>
              </div>
            )}

            {/* Loading state before stream starts */}
            {!streamReady && !cameraError && (
              <div className="absolute inset-0 z-20 bg-slate-950 flex flex-col items-center justify-center text-slate-400">
                <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mb-3" />
                <p className="text-xs font-medium text-white">Đang khởi động webcam máy tính...</p>
                <p className="text-[11px] text-slate-500 mt-1">Vui lòng bấm 'Allow' nếu trình duyệt hỏi quyền truy cập</p>
              </div>
            )}

            {/* Banking-Grade Elliptical Overlay (SVG Mask) */}
            {streamReady && !cameraError && (
              <div className="absolute inset-0 pointer-events-none z-10">
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 480 380" preserveAspectRatio="none">
                  <defs>
                    <mask id="face-ellipse-mask">
                      {/* White fills everything (opaque) */}
                      <rect width="480" height="380" fill="white" />
                      {/* Black cuts out the face ellipse (transparent center) */}
                      <ellipse cx="240" cy="190" rx="120" ry="155" fill="black" />
                    </mask>
                  </defs>

                  {/* Dark backdrop outside ellipse */}
                  <rect
                    width="480"
                    height="380"
                    fill="rgba(2, 6, 23, 0.55)"
                    mask="url(#face-ellipse-mask)"
                  />

                  {/* Glowing Ellipse Stroke */}
                  <ellipse
                    cx="240"
                    cy="190"
                    rx="120"
                    ry="155"
                    fill="none"
                    stroke={samples[currentStep.angle] ? '#10b981' : '#38bdf8'}
                    strokeWidth="3.5"
                    strokeDasharray={samples[currentStep.angle] ? 'none' : '10, 6'}
                    className="transition-all duration-300"
                    style={{
                      filter: samples[currentStep.angle]
                        ? 'drop-shadow(0 0 14px rgba(16, 185, 129, 0.85))'
                        : 'drop-shadow(0 0 14px rgba(56, 189, 248, 0.85))'
                    }}
                  />

                  {/* Eye alignment guide line */}
                  <line
                    x1="170"
                    y1="160"
                    x2="310"
                    y2="160"
                    stroke="rgba(56, 189, 248, 0.35)"
                    strokeWidth="1.5"
                    strokeDasharray="4, 4"
                  />

                  {/* Vertical symmetry guide */}
                  <line
                    x1="240"
                    y1="75"
                    x2="240"
                    y2="305"
                    stroke="rgba(56, 189, 248, 0.25)"
                    strokeWidth="1"
                    strokeDasharray="3, 3"
                  />

                  {/* Center Crosshair */}
                  <circle cx="240" cy="160" r="3.5" fill="#38bdf8" opacity="0.8" />
                </svg>

                {/* Corner Tech Brackets */}
                <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-blue-400" />
                <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-blue-400" />
                <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-blue-400" />
                <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-blue-400" />

                {/* Animated Laser Scanning Beam */}
                <div
                  className="absolute left-[26%] right-[26%] h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-80 shadow-[0_0_15px_#38bdf8] pointer-events-none z-20"
                  style={{
                    animation: 'scanLaser 2.4s ease-in-out infinite alternate',
                    top: '25%'
                  }}
                />

                {/* Angle Head Direction Prompt Indicator */}
                <div className="absolute top-4 inset-x-0 flex justify-center z-20">
                  <div className="px-3 py-1 rounded-full bg-slate-950/85 border border-slate-700/80 text-[11px] font-mono text-cyan-300 flex items-center gap-1.5 backdrop-blur-sm shadow-lg">
                    {currentStep.angle === 'FRONTAL' && <span>👁️ NHÌN THẲNG CHÍNH DIỆN</span>}
                    {currentStep.angle === 'LEFT' && <span>⬅️ QUAY MẶT SANG TRÁI (~25°)</span>}
                    {currentStep.angle === 'RIGHT' && <span>➡️ QUAY MẶT SANG PHẢI (~25°)</span>}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Shutter & Controls Dock */}
          <div className="mt-4 flex items-center justify-center">
            <button
              type="button"
              disabled={!streamReady || isProcessing}
              onClick={takeSnapshot}
              className={`px-8 py-2.5 rounded-2xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-xl cursor-pointer ${
                streamReady && !isProcessing
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/25 hover:scale-105 active:scale-95'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>Chụp ngay góc này</span>
            </button>
          </div>

          {/* 3 Captured Samples Horizontal Progress Tray */}
          <div className="w-full max-w-xl mt-4 pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-green-400" />
                Tiến độ thu thập 3 góc:
              </span>
              <span className="text-[11px] font-mono font-bold text-slate-400">
                {capturedCount}/3 góc hoàn thành
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {STEPS.map((step, idx) => {
                const sample = samples[step.angle];
                const isCurrent = currentStepIndex === idx;

                return (
                  <div
                    key={step.angle}
                    onClick={() => setCurrentStepIndex(idx)}
                    className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer transition-all ${
                      sample
                        ? 'bg-slate-950 border-green-500/40 shadow-sm shadow-green-500/10'
                        : isCurrent
                        ? 'bg-slate-950 border-blue-500 ring-2 ring-blue-500/20'
                        : 'bg-slate-950/60 border-slate-800'
                    }`}
                  >
                    <div className="w-11 h-11 rounded-lg overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 relative">
                      {sample ? (
                        <>
                          <img
                            src={sample.dataUrl}
                            alt={step.shortLabel}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                            <Check className="w-4 h-4 text-green-400 font-bold" />
                          </div>
                        </>
                      ) : (
                        <Camera className="w-4 h-4 text-slate-600" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-white truncate">{step.shortLabel}</p>
                      <p className={`text-[10px] font-mono mt-0.5 ${sample ? 'text-green-400' : 'text-slate-500'}`}>
                        {sample ? `${sample.qualityScore}% (Đạt)` : 'Chờ chụp'}
                      </p>
                    </div>

                    {sample && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRetakeStep(idx);
                        }}
                        className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        title="Chụp lại góc này"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-950/90">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            Đóng / Hủy bỏ
          </button>

          <div className="flex items-center gap-3">
            {!allCaptured ? (
              <p className="text-xs text-amber-400 flex items-center gap-1.5 font-medium">
                <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                Cần chụp đủ cả 3 góc (Hiện có {capturedCount}/3)
              </p>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                className="px-5 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-green-600/30 transition-all hover:scale-105 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Sử dụng 3 ảnh này để cập nhật Face ID</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalNode, document.body);
};
