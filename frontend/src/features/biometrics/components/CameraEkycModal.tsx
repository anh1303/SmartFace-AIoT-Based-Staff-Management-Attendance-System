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
  Info,
  Plus,
  Trash2
} from 'lucide-react';
import { logger } from '../../../utils/logger';

const cameraLogger = logger.child('CameraEkyc');


export interface CapturedFaceSample {
  id: string;
  angle: string;
  label: string;
  instruction: string;
  dataUrl: string;
}

interface CameraEkycModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (samples: CapturedFaceSample[]) => void;
  employeeName: string;
  employeeCode: string;
  existingPhotoCount?: number;
  maxPhotos?: number;
}

interface StepConfig {
  id: string;
  angle: string;
  title: string;
  shortLabel: string;
  instruction: string;
  detailHint: string;
  isCustom?: boolean;
}

const DEFAULT_STEPS: StepConfig[] = [
  {
    id: 'FRONTAL',
    angle: 'FRONTAL',
    title: 'Góc 1: Chính diện (Frontal)',
    shortLabel: 'Chính diện',
    instruction: 'Vui lòng nhìn thẳng vào camera, giữ khuôn mặt nằm trọn trong khung elip',
    detailHint: 'Mắt mở to, nhìn thẳng tâm camera, không nghiêng đầu.'
  },
  {
    id: 'LEFT',
    angle: 'LEFT',
    title: 'Góc 2: Quay trái (Turn Left)',
    shortLabel: 'Quay trái (~25°)',
    instruction: 'Nghiêng mặt nhẹ sang bên TRÁI khoảng 20° - 30°, giữ mắt hướng về camera',
    detailHint: 'Quay nhẹ từ từ sang trái cho đến khi viền elip bao trọn khuôn mặt.'
  },
  {
    id: 'RIGHT',
    angle: 'RIGHT',
    title: 'Góc 3: Quay phải (Turn Right)',
    shortLabel: 'Quay phải (~25°)',
    instruction: 'Nghiêng mặt nhẹ sang bên PHẢI khoảng 20° - 30°, giữ mắt hướng về camera',
    detailHint: 'Quay nhẹ từ từ sang phải để hoàn tất thu thập đủ 3 góc cơ bản.'
  }
];

export const CameraEkycModal: React.FC<CameraEkycModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  employeeName,
  employeeCode,
  existingPhotoCount = 0,
  maxPhotos = 10
}) => {
  const maxAllowedInModal = Math.max(3, maxPhotos - existingPhotoCount);

  const [steps, setSteps] = useState<StepConfig[]>(DEFAULT_STEPS);
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
            videoRef.current?.play().then(() => setStreamReady(true)).catch((e) => cameraLogger.warn('Video play deferred catch:', e));
          };
        }
      }
    } catch (err: any) {
      cameraLogger.error('Camera access error:', err);
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
      node.play().then(() => setStreamReady(true)).catch((e) => cameraLogger.warn('Video node play catch:', e));
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setSteps(DEFAULT_STEPS);
      setSamples({ FRONTAL: null, LEFT: null, RIGHT: null });
      setCurrentStepIndex(0);
      startCamera();
    } else {
      stopCamera();
      document.body.style.overflow = 'unset';
      setIsProcessing(false);
      setCurrentStepIndex(0);
      setSteps(DEFAULT_STEPS);
      setSamples({ FRONTAL: null, LEFT: null, RIGHT: null });
    }
    return () => {
      stopCamera();
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, startCamera, stopCamera]);

  // Add extra step/photo slot
  const handleAddStep = useCallback(() => {
    if (steps.length >= maxAllowedInModal) return;

    const nextNum = steps.length + 1;
    const newStepId = `EXTRA_${nextNum}_${Date.now()}`;
    const newStep: StepConfig = {
      id: newStepId,
      angle: `EXTRA_${nextNum}`,
      title: `Ảnh ${nextNum}`,
      shortLabel: `Ảnh ${nextNum}`,
      instruction: 'Chụp thêm góc mặt tự do, góc ngửa hoặc biểu cảm khác để tăng độ chính xác nhận diện',
      detailHint: 'Giữ khuôn mặt rõ nét trong khung elip, ánh sáng đồng đều.',
      isCustom: true
    };

    setSteps(prev => [...prev, newStep]);
    setSamples(prev => ({ ...prev, [newStepId]: null }));
    setCurrentStepIndex(steps.length);
  }, [steps.length, maxAllowedInModal]);

  // Remove custom extra step
  const handleRemoveStep = useCallback((stepId: string) => {
    const targetIdx = steps.findIndex(s => s.id === stepId);
    if (targetIdx === -1 || !steps[targetIdx].isCustom) return;

    setSteps(prev => prev.filter(s => s.id !== stepId));
    setSamples(prev => {
      const copy = { ...prev };
      delete copy[stepId];
      return copy;
    });

    setCurrentStepIndex(prev => {
      if (prev >= targetIdx) {
        return Math.max(0, prev - 1);
      }
      return prev;
    });
  }, [steps]);

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
    const activeStep = steps[currentStepIndex];
    if (!activeStep) return;

    setIsProcessing(true);

    setTimeout(() => {
      const newSample: CapturedFaceSample = {
        id: `${activeStep.angle}_${Date.now()}`,
        angle: activeStep.angle,
        label: activeStep.shortLabel,
        instruction: activeStep.instruction,
        dataUrl,
      };

      setSamples(prev => ({
        ...prev,
        [activeStep.id]: newSample
      }));

      setIsProcessing(false);

      // Advance to next step if exists
      if (currentStepIndex < steps.length - 1) {
        setCurrentStepIndex(prev => prev + 1);
      }
    }, 350);
  }, [currentStepIndex, steps, streamReady]);

  const handleRetakeStep = (index: number) => {
    setCurrentStepIndex(index);
    const stepId = steps[index]?.id;
    if (stepId) {
      setSamples(prev => ({
        ...prev,
        [stepId]: null
      }));
    }
  };

  const capturedCount = Object.values(samples).filter(Boolean).length;

  const handleFinish = () => {
    const sampleList = steps
      .map(step => samples[step.id])
      .filter((s): s is CapturedFaceSample => Boolean(s));

    if (sampleList.length === 0) return;
    onComplete(sampleList);
    onClose();
  };

  if (!isOpen) return null;

  const currentStep = steps[currentStepIndex] || steps[0];

  const modalNode = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div
        className="w-full max-w-3xl bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh] transition-colors"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-200/80 dark:border-[#21264b] bg-slate-50/80 dark:bg-[#0f1224]/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">
                Xác Thực Face ID Qua Camera
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Nhân sự: <strong className="text-slate-900 dark:text-white">{employeeName}</strong> ({employeeCode})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#181c38] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Indicator Bar (Scrollable when many photos) */}
        <div className="bg-slate-50/50 dark:bg-[#0f1224]/60 border-b border-slate-200/80 dark:border-[#21264b] px-4 sm:px-6 py-2.5 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max mx-auto justify-center">
            {steps.map((step, idx) => {
              const isDone = Boolean(samples[step.id]);
              const isCurrent = currentStepIndex === idx;

              return (
                <div key={step.id} className="relative flex items-center">
                  <button
                    type="button"
                    onClick={() => setCurrentStepIndex(idx)}
                    className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-purple-50 dark:bg-purple-600/20 border-purple-500 text-purple-700 dark:text-purple-400 shadow-xs'
                        : isDone
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                        : 'bg-white dark:bg-[#13162b] border-slate-200 dark:border-[#21264b] text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold shrink-0 ${
                        isDone
                          ? 'bg-emerald-500 text-white'
                          : isCurrent
                          ? 'bg-purple-600 text-white animate-pulse'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {isDone ? '✓' : idx + 1}
                    </span>
                    <span className="truncate max-w-[110px]">{step.shortLabel}</span>
                  </button>
                  {step.isCustom && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveStep(step.id);
                      }}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center text-[9px] shadow-sm cursor-pointer z-10"
                      title="Xóa góc này"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}

            {steps.length < maxAllowedInModal && (
              <button
                type="button"
                onClick={handleAddStep}
                className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl border border-dashed border-purple-400/60 dark:border-purple-500/40 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 text-xs font-semibold transition-all cursor-pointer"
                title="Chụp thêm ảnh nữa"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm ảnh ({steps.length + 1})</span>
              </button>
            )}
          </div>
        </div>

        {/* Main Content Body */}
        <div className="p-5 overflow-y-auto flex-1 flex flex-col items-center">

          {/* Camera Viewport with Elliptical Overlay */}
          <div className="relative w-full max-w-[480px] h-[360px] sm:h-[390px] shrink-0 rounded-xl overflow-hidden bg-slate-950 border-2 border-slate-700 shadow-2xl flex items-center justify-center">
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
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Thử lại kết nối camera</span>
                </button>
              </div>
            )}

            {/* Loading state before stream starts */}
            {!streamReady && !cameraError && (
              <div className="absolute inset-0 z-20 bg-slate-950 flex flex-col items-center justify-center text-slate-400">
                <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mb-3" />
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
                    stroke={samples[currentStep.id] ? '#10b981' : '#8b5cf6'}
                    strokeWidth="3.5"
                    strokeDasharray={samples[currentStep.id] ? 'none' : '10, 6'}
                    className="transition-all duration-300"
                    style={{
                      filter: samples[currentStep.id]
                        ? 'drop-shadow(0 0 14px rgba(16, 185, 129, 0.85))'
                        : 'drop-shadow(0 0 14px rgba(139, 92, 246, 0.85))'
                    }}
                  />

                  {/* Eye alignment guide line */}
                  <line
                    x1="170"
                    y1="160"
                    x2="310"
                    y2="160"
                    stroke="rgba(139, 92, 246, 0.35)"
                    strokeWidth="1.5"
                    strokeDasharray="4, 4"
                  />

                  {/* Vertical symmetry guide */}
                  <line
                    x1="240"
                    y1="75"
                    x2="240"
                    y2="305"
                    stroke="rgba(139, 92, 246, 0.25)"
                    strokeWidth="1"
                    strokeDasharray="3, 3"
                  />

                  {/* Center Crosshair */}
                  <circle cx="240" cy="160" r="3.5" fill="#8b5cf6" opacity="0.8" />
                </svg>

                {/* Corner Tech Brackets */}
                <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-purple-400" />
                <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-purple-400" />
                <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-purple-400" />
                <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-purple-400" />

                {/* Animated Laser Scanning Beam */}
                <div
                  className="absolute left-[26%] right-[26%] h-1 bg-gradient-to-r from-transparent via-purple-400 to-transparent opacity-80 shadow-[0_0_15px_#8b5cf6] pointer-events-none z-20"
                  style={{
                    animation: 'scanLaser 2.4s ease-in-out infinite alternate',
                    top: '25%'
                  }}
                />

                {/* Angle Head Direction Prompt Indicator */}
                <div className="absolute top-4 inset-x-0 flex justify-center z-20">
                  <div className="px-3 py-1 rounded-full bg-slate-950/85 border border-slate-700/80 text-[11px] font-mono text-purple-300 flex items-center gap-1.5 backdrop-blur-sm shadow-lg">
                    {currentStep.angle === 'FRONTAL' && <span>👁️ NHÌN THẲNG CHÍNH DIỆN</span>}
                    {currentStep.angle === 'LEFT' && <span>⬅️ QUAY MẶT SANG TRÁI (~25°)</span>}
                    {currentStep.angle === 'RIGHT' && <span>➡️ QUAY MẶT SANG PHẢI (~25°)</span>}
                    {currentStep.isCustom && <span>📸 ẢNH BỔ SUNG {currentStepIndex + 1} (GÓC TỰ DO)</span>}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Shutter & Controls Dock */}
          <div className="mt-4 flex items-center justify-center gap-3">
            {samples[currentStep.id] ? (
              <>
                <button
                  type="button"
                  disabled={!streamReady || isProcessing}
                  onClick={takeSnapshot}
                  className="px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-sm bg-slate-100 hover:bg-slate-200 dark:bg-[#181c38] dark:hover:bg-[#20254b] text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span>Chụp lại góc này</span>
                </button>

                {steps.length < maxAllowedInModal && (
                  <button
                    type="button"
                    disabled={!streamReady || isProcessing}
                    onClick={handleAddStep}
                    className="px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-500/25 hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Chụp thêm ảnh nữa ({steps.length + 1})</span>
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                disabled={!streamReady || isProcessing}
                onClick={takeSnapshot}
                className={`px-8 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md cursor-pointer ${
                  streamReady && !isProcessing
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-500/25 hover:scale-105 active:scale-95'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                }`}
              >
                <Camera className="w-4 h-4" />
                <span>Chụp ngay góc này</span>
              </button>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 dark:border-[#21264b] bg-slate-50/80 dark:bg-[#0f1224]/90">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-[#181c38] dark:hover:bg-[#20254b] dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer border border-slate-200 dark:border-[#272d5a]"
          >
            Hủy bỏ
          </button>

          <div className="flex items-center gap-3">

            <button
              type="button"
              disabled={capturedCount === 0}
              onClick={handleFinish}
              className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer ${
                capturedCount > 0
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white hover:scale-105'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>Xác nhận{capturedCount > 0 ? ` (${capturedCount} ảnh)` : ''}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalNode, document.body);
};


