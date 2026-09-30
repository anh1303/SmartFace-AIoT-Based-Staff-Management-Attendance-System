import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ScanFace,
  Fingerprint,
  Upload,
  CheckCircle2,
  Radio,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Cpu,
  Camera,
  Check,
  Sparkles,
  ArrowRight,
  Send,
  Sliders,
  HardDrive,
  CheckCheck,
  Trash2,
  Plus,
  Layers,
  Video,
  Info
} from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { CameraEkycModal, CapturedFaceSample } from '../../components/biometrics/CameraEkycModal';
import { Employee } from '../../types';

export interface FacePhotoItem {
  id: string;
  url: string;
  name: string;
  tag: string;
  qualityScore?: number;
}

export const ManagerBiometrics: React.FC = () => {
  const { employees, updateEmployee, showToast } = useApp();

  // Selected employee for enrollment
  const [selectedEmpId, setSelectedEmpId] = useState<string>(employees[0]?.employee_id || 'NV-001');
  const [activeTab, setActiveTab] = useState<'FACE' | 'FINGERPRINT'>('FACE');

  // Face Enrollment State (Requires at least 3 photos)
  const [uploadedPhotos, setUploadedPhotos] = useState<FacePhotoItem[]>([]);
  const [analyzingFace, setAnalyzingFace] = useState<boolean>(false);
  const [faceQualityScore, setFaceQualityScore] = useState<number | null>(null);
  const [faceConfirmModal, setFaceConfirmModal] = useState<boolean>(false);
  const [isEkycModalOpen, setIsEkycModalOpen] = useState<boolean>(false);

  // Fingerprint Device Trigger State
  const [selectedDevice, setSelectedDevice] = useState<string>('FaceCam-01 (Cổng chính - Tầng 1)');
  const [selectedFinger, setSelectedFinger] = useState<string>('Ngón trỏ phải (Right Index)');
  const [fingerprintStep, setFingerprintStep] = useState<'IDLE' | 'SENDING' | 'WAITING_TOUCH' | 'CAPTURED' | 'VERIFIED'>('IDLE');
  const [fingerQualityScore, setFingerQualityScore] = useState<number | null>(null);
  const [fingerConfirmModal, setFingerConfirmModal] = useState<boolean>(false);

  // Device sync modal
  const [syncAllModal, setSyncAllModal] = useState<boolean>(false);
  const [syncingDevices, setSyncingDevices] = useState<boolean>(false);

  const currentEmp = employees.find(e => e.employee_id === selectedEmpId) || employees[0];

  // Handle Photo Upload (Multiple files allowed)
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    const newPhotos: FacePhotoItem[] = [];
    let loadedCount = 0;

    fileList.forEach((file, idx) => {
      const reader = new FileReader();
      reader.onload = () => {
        const overallIndex = uploadedPhotos.length + newPhotos.length;
        let defaultTag = 'Chính diện';
        if (overallIndex === 1) defaultTag = 'Quay trái (~25°)';
        else if (overallIndex === 2) defaultTag = 'Quay phải (~25°)';
        else if (overallIndex > 2) defaultTag = `Góc phụ ${overallIndex + 1}`;

        newPhotos.push({
          id: `upload_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
          url: reader.result as string,
          name: file.name,
          tag: defaultTag,
          qualityScore: Math.floor(96 + Math.random() * 3.8 * 10) / 10
        });
        loadedCount++;

        if (loadedCount === fileList.length) {
          setUploadedPhotos(prev => {
            const merged = [...prev, ...newPhotos];
            return merged;
          });
          setAnalyzingFace(true);
          setTimeout(() => {
            setAnalyzingFace(false);
            setFaceQualityScore(99.4);
          }, 1200);
        }
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  // Remove photo from list
  const handleRemovePhoto = (id: string) => {
    setUploadedPhotos(prev => prev.filter(p => p.id !== id));
  };

  // Handle completion from Camera eKYC 3-angle modal
  const handleEkycComplete = (samples: CapturedFaceSample[]) => {
    const newItems: FacePhotoItem[] = samples.map(s => ({
      id: s.id,
      url: s.dataUrl,
      name: `${s.label} (Camera eKYC)`,
      tag: s.label,
      qualityScore: s.qualityScore
    }));

    setUploadedPhotos(newItems);
    setAnalyzingFace(true);
    setTimeout(() => {
      setAnalyzingFace(false);
      setFaceQualityScore(99.6);
    }, 1200);
    showToast(`Đã thu thập đủ 3 góc khuôn mặt chuẩn eKYC cho ${currentEmp?.full_name}!`, 'success');
  };

  // Confirm Face Update (requires explicit confirm button and >= 3 photos)
  const handleConfirmFaceSave = () => {
    if (!currentEmp || uploadedPhotos.length < 3) return;
    const frontalPhoto = uploadedPhotos[0]?.url || currentEmp.avatar;
    updateEmployee(currentEmp.employee_id, {
      face_enrolled: true,
      avatar: frontalPhoto
    });
    setFaceConfirmModal(false);
    showToast(`Đã cập nhật vector khuôn mặt 512-D (${uploadedPhotos.length} ảnh mẫu) cho nhân viên ${currentEmp.full_name} (${currentEmp.employee_id})!`, 'success');
  };

  // IoT Signal Trigger for Fingerprint Device
  const handleSendIoTTrigger = () => {
    setFingerprintStep('SENDING');
    // Step 1: Send MQTT command to Edge Terminal
    setTimeout(() => {
      setFingerprintStep('WAITING_TOUCH');
      // Step 2: Employee touches hardware sensor
      setTimeout(() => {
        setFingerprintStep('CAPTURED');
        // Step 3: Device verifies quality & fake finger check
        setTimeout(() => {
          setFingerprintStep('VERIFIED');
          setFingerQualityScore(98.5);
        }, 1000);
      }, 2000);
    }, 1200);
  };

  // Confirm Fingerprint Update (requires explicit confirm button)
  const handleConfirmFingerprintSave = () => {
    if (!currentEmp) return;
    updateEmployee(currentEmp.employee_id, {
      fingerprint_enrolled: true
    });
    setFingerConfirmModal(false);
    setFingerprintStep('IDLE');
    showToast(`Đã lưu mẫu vân tay ${selectedFinger} cho ${currentEmp.full_name} từ ${selectedDevice}!`, 'success');
  };

  // Sync all devices
  const handleConfirmSyncAll = () => {
    setSyncingDevices(true);
    setTimeout(() => {
      setSyncingDevices(false);
      setSyncAllModal(false);
      showToast('Đã phát tín hiệu đồng bộ cơ sở dữ liệu sinh trắc học tới 12/12 Edge Cams!', 'success');
    }, 1500);
  };

  // Metrics
  const totalEmployees = employees.length;
  const faceEnrolledCount = employees.filter(e => e.face_enrolled).length;
  const fingerEnrolledCount = employees.filter(e => e.fingerprint_enrolled).length;

  return (
    <div className="space-y-6">
      {/* Bento Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-white font-heading tracking-tight">
              Quản Lý & Cập Nhật Sinh Trắc Học
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Ghi nhận vector 512-D khuôn mặt từ hình ảnh hoặc phát tín hiệu IoT tới thiết bị FaceCam/Cảm biến vân tay FAP30.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setSyncAllModal(true)}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 border border-slate-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
            <span>Đồng bộ 12/12 Edge Devices</span>
          </button>
        </div>
      </div>

      {/* 3 Bento Telemetry Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-700 transition-colors">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Đã đăng ký Face ID</span>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-blue-400">
              {faceEnrolledCount}/{totalEmployees}
            </span>
            <span className="text-xs font-mono text-slate-500">
              ({Math.round((faceEnrolledCount / totalEmployees) * 100)}%)
            </span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-700 transition-colors">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Đã đăng ký Vân tay</span>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-green-400">
              {fingerEnrolledCount}/{totalEmployees}
            </span>
            <span className="text-xs font-mono text-slate-500">
              ({Math.round((fingerEnrolledCount / totalEmployees) * 100)}%)
            </span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-700 transition-colors">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Trạng thái Edge Devices</span>
          <div className="mt-3 flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
            <span className="text-2xl font-bold font-mono text-white">12/12 Online</span>
          </div>
        </div>
      </div>

      {/* Main Enrollment Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Choose Employee & Current Profile */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5">
            <h2 className="text-sm font-bold text-white font-heading uppercase tracking-wider mb-4">
              1. Chọn Nhân Sự Cần Cập Nhật
            </h2>

            <div className="mb-4">
              <label className="block text-xs text-slate-400 mb-1.5">Danh sách nhân viên:</label>
              <select
                value={selectedEmpId}
                onChange={e => {
                  setSelectedEmpId(e.target.value);
                  setUploadedPhotos([]);
                  setFaceQualityScore(null);
                  setFingerprintStep('IDLE');
                }}
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
              >
                {employees.map(emp => (
                  <option key={emp.employee_id} value={emp.employee_id}>
                    {emp.employee_id} - {emp.full_name} ({emp.department})
                  </option>
                ))}
              </select>
            </div>

            {/* Selected Employee Card */}
            {currentEmp && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="flex items-center gap-3">
                  <img
                    src={currentEmp.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120"}
                    alt={currentEmp.full_name}
                    className="w-14 h-14 rounded-2xl object-cover border border-slate-700"
                  />
                  <div>
                    <h3 className="text-sm font-bold text-white">{currentEmp.full_name}</h3>
                    <p className="text-xs text-blue-400 font-mono">{currentEmp.employee_id}</p>
                    <p className="text-[11px] text-slate-400">{currentEmp.department} • {currentEmp.position}</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <ScanFace className="w-3.5 h-3.5 text-blue-400" />
                      Face ID:
                    </span>
                    <span className={`font-mono text-[11px] px-2 py-0.5 rounded-md font-semibold ${currentEmp.face_enrolled
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                      {currentEmp.face_enrolled ? 'ĐÃ CẬP NHẬT' : 'CHƯA ĐĂNG KÝ'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Fingerprint className="w-3.5 h-3.5 text-green-400" />
                      Vân tay (FAP30):
                    </span>
                    <span className={`font-mono text-[11px] px-2 py-0.5 rounded-md font-semibold ${currentEmp.fingerprint_enrolled
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                      {currentEmp.fingerprint_enrolled ? 'ĐÃ CẬP NHẬT' : 'CHƯA ĐĂNG KÝ'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Biometric Actions (Tabs: Face / Fingerprint) */}
        <div className="lg:col-span-8">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
            {/* Mode Switcher */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex gap-2 p-1 bg-slate-950 border border-slate-800 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setActiveTab('FACE')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${activeTab === 'FACE'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                    }`}
                >
                  <ScanFace className="w-4 h-4" />
                  <span>Cập nhật Khuôn mặt (Upload ảnh)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('FINGERPRINT')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${activeTab === 'FINGERPRINT'
                    ? 'bg-green-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                    }`}
                >
                  <Fingerprint className="w-4 h-4" />
                  <span>Ghi nhận Vân tay (Gửi tín hiệu IoT)</span>
                </button>
              </div>
            </div>

            {/* TAB 1: Face ID Multi-Photo Upload & Camera eKYC (Min 3 Photos) */}
            {activeTab === 'FACE' && (
              <div className="space-y-5">
                {/* Header Action Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                      <ScanFace className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white font-heading">
                          Cập Nhật Dữ Liệu Khuôn Mặt
                        </h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${uploadedPhotos.length >= 3
                            ? 'bg-green-500/10 text-green-400 border-green-500/30'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          }`}>
                          {uploadedPhotos.length >= 3 ? `Đã đủ ${uploadedPhotos.length} ảnh` : `${uploadedPhotos.length}/3 ảnh (Tối thiểu 3)`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsEkycModalOpen(true)}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
                  >
                    <Camera className="w-4 h-4 text-cyan-200" />
                    <span>Chụp bằng Camera</span>
                  </button>
                </div>

                {/* Upload Area / Photos Gallery */}
                {uploadedPhotos.length === 0 ? (
                  <div className="relative border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-2xl p-8 text-center cursor-pointer transition-colors bg-slate-950 group">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotoUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                    />
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 mx-auto flex items-center justify-center text-blue-400 mb-3 group-hover:scale-110 transition-transform">
                      <Upload className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-white">
                      Kéo thả ảnh vào đây hoặc bấm để chọn tệp
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Tối thiểu 3 ảnh các góc (Chính diện, Quay trái, Quay phải)
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-blue-400" />
                        Danh sách ảnh mẫu ({uploadedPhotos.length} ảnh):
                      </span>
                      <label className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors">
                        <Plus className="w-3.5 h-3.5 text-blue-400" />
                        <span>Thêm ảnh</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handlePhotoUpload}
                          className="hidden"
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {uploadedPhotos.map((photo, idx) => (
                        <div
                          key={photo.id}
                          className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 group shadow-md"
                        >
                          <div className="aspect-[4/3] bg-slate-900 relative">
                            <img
                              src={photo.url}
                              alt={photo.name}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/75 text-[10px] font-mono font-bold text-white">
                              #{idx + 1}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemovePhoto(photo.id)}
                              className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-600/90 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow"
                              title="Xóa ảnh này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="p-2 text-center bg-slate-950 border-t border-slate-800/80">
                            <p className="text-xs font-medium text-slate-300 truncate">
                              {photo.tag || `Ảnh ${idx + 1}`}
                            </p>
                          </div>
                        </div>
                      ))}

                      {/* Add more photo card */}
                      <label className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-2xl flex flex-col items-center justify-center p-4 text-center cursor-pointer transition-colors bg-slate-950/40 hover:bg-slate-950 text-slate-500 hover:text-slate-400 min-h-[130px]">
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handlePhotoUpload}
                          className="hidden"
                        />
                        <Plus className="w-6 h-6 mb-1 text-slate-400" />
                        <span className="text-xs font-medium">Thêm ảnh</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Action Footer */}
                <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    {uploadedPhotos.length < 3 ? (
                      <span className="text-amber-400 font-medium">
                        Cần tối thiểu 3 ảnh để cập nhật ({uploadedPhotos.length}/3)
                      </span>
                    ) : (
                      <span className="text-green-400 font-medium">
                        Đã đủ {uploadedPhotos.length} ảnh hợp lệ
                      </span>
                    )}
                  </span>

                  <button
                    type="button"
                    disabled={uploadedPhotos.length < 3 || analyzingFace}
                    onClick={() => setFaceConfirmModal(true)}
                    className={`px-6 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer ${uploadedPhotos.length >= 3 && !analyzingFace
                        ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                  >
                    <Check className="w-4 h-4" />
                    <span>Xác nhận & Cập nhật Sinh trắc Khuôn mặt</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: Fingerprint via Edge IoT Device Signal */}
            {activeTab === 'FINGERPRINT' && (
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Select Device & Finger */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Chọn thiết bị Edge IoT ghi nhận:
                      </label>
                      <select
                        value={selectedDevice}
                        onChange={e => setSelectedDevice(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-green-500"
                      >
                        <option value="FaceCam-01 (Máy chấm công Face_ID Vào ca)">
                          FaceCam-01 (Máy chấm công Face_ID Vào ca)
                        </option>
                        <option value="FaceCam-02 (Máy chấm công Face_ID Tan ca)">
                          FaceCam-02 (Máy chấm công Face_ID Tan ca)
                        </option>
                        <option value="Fingerprint-01 (Máy chấm công vân tay Vào ca)">
                          Fingerprint-01 (Máy chấm công vân tay Vào ca)
                        </option>
                        <option value="Fingerprint-02 (Máy chấm công vân tay Tan ca)">
                          Fingerprint-02 (Máy chấm công vân tay Tan ca)
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Vị trí ngón tay lấy mẫu:
                      </label>
                      <select
                        value={selectedFinger}
                        onChange={e => setSelectedFinger(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-green-500"
                      >
                        <option value="Ngón trỏ phải (Right Index)">Ngón trỏ phải (Right Index) - Khuyên dùng</option>
                        <option value="Ngón cái phải (Right Thumb)">Ngón cái phải (Right Thumb)</option>
                        <option value="Ngón trỏ trái (Left Index)">Ngón trỏ trái (Left Index)</option>
                        <option value="Ngón cái trái (Left Thumb)">Ngón cái trái (Left Thumb)</option>
                      </select>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs text-slate-400">
                      <p className="font-semibold text-slate-300 flex items-center gap-1.5">
                        <Radio className="w-3.5 h-3.5 text-green-400" />
                        Giao thức IoT Sensor:
                      </p>
                      <p>• Lệnh điều khiển gửi qua MQTT topic: <code className="text-green-400 font-mono">edge/devices/fap30/enroll</code></p>
                      <p>• Độ phân giải cảm biến: 500 DPI optical FAP30 với công nghệ chống vân tay giả Silicon.</p>
                    </div>

                    {/* Trigger IoT Signal Button */}
                    <button
                      type="button"
                      disabled={fingerprintStep === 'SENDING' || fingerprintStep === 'WAITING_TOUCH' || fingerprintStep === 'CAPTURED'}
                      onClick={handleSendIoTTrigger}
                      className="w-full py-3 px-4 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-md transition-all"
                    >
                      <Send className="w-4 h-4" />
                      <span>Gửi tín hiệu tới thiết bị để lấy mẫu (IoT Trigger)</span>
                    </button>
                  </div>

                  {/* Device Feedback HUD */}
                  <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
                        <span className="font-mono text-slate-400">TRẠNG THÁI KẾT NỐI THIẾT BỊ</span>
                        <span className="font-mono text-green-400 font-bold">ONLINE</span>
                      </div>

                      <div className="mt-6 text-center space-y-3">
                        <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center border-2 transition-all ${fingerprintStep === 'IDLE'
                          ? 'border-slate-800 text-slate-600'
                          : fingerprintStep === 'SENDING'
                            ? 'border-blue-500 text-blue-400 animate-pulse'
                            : fingerprintStep === 'WAITING_TOUCH'
                              ? 'border-amber-400 text-amber-400 animate-bounce'
                              : 'border-green-500 text-green-400 bg-green-500/10'
                          }`}>
                          <Fingerprint className="w-10 h-10" />
                        </div>

                        <div>
                          <p className="text-sm font-bold text-white font-heading">
                            {fingerprintStep === 'IDLE' && 'Thiết bị đang ở chế độ chờ'}
                            {fingerprintStep === 'SENDING' && 'Đang gửi gói tin IoT kích hoạt cảm biến...'}
                            {fingerprintStep === 'WAITING_TOUCH' && 'Đèn cảm biến bật sáng - Chờ nhân viên đặt ngón tay...'}
                            {fingerprintStep === 'CAPTURED' && 'Đã đọc vân tay 500 DPI - Đang phân tích...'}
                            {fingerprintStep === 'VERIFIED' && 'Lấy mẫu thành công! NFIQ 2.0: 98.5%'}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            {fingerprintStep === 'VERIFIED'
                              ? `Mẫu đã sẵn sàng lưu cho ${selectedFinger}`
                              : `Mục tiêu: ${selectedDevice}`}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Quality score badge */}
                    {fingerQualityScore && fingerprintStep === 'VERIFIED' && (
                      <div className="mt-4 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-xs flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-semibold">
                          <CheckCheck className="w-4 h-4" />
                          Chuẩn FAP30 500DPI hợp lệ
                        </span>
                        <span className="font-mono font-bold">Điểm: {fingerQualityScore}/100</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Explicit Confirm Button for Fingerprint */}
                <div className="pt-4 border-t border-slate-800 flex justify-end">
                  <button
                    type="button"
                    disabled={fingerprintStep !== 'VERIFIED'}
                    onClick={() => setFingerConfirmModal(true)}
                    className={`px-6 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all ${fingerprintStep === 'VERIFIED'
                      ? 'bg-green-600 hover:bg-green-500 text-white shadow-md'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                  >
                    <Check className="w-4 h-4" />
                    <span>Xác nhận lưu mẫu vân tay vào hồ sơ</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Master Employee Biometric Status Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-white font-heading">
              Bảng Tổng Hợp Trạng Thái Sinh Trắc Học Nhân Viên
            </h2>
            <p className="text-xs text-slate-400">
              Kiểm tra mức độ hoàn thiện dữ liệu sinh trắc học trước khi phân bổ vào hệ thống Edge Cams.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Tổng cộng: <strong className="text-white">{employees.length}</strong> nhân sự
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 border-b border-slate-800 text-slate-500 uppercase tracking-wider font-mono text-[11px]">
              <tr>
                <th className="py-3.5 px-4 font-medium">Nhân sự</th>
                <th className="py-3.5 px-4 font-medium">Mã NV</th>
                <th className="py-3.5 px-4 font-medium">Chức vụ</th>
                <th className="py-3.5 px-4 font-medium">Khuôn mặt (Face ID)</th>
                <th className="py-3.5 px-4 font-medium">Vân tay (FAP30)</th>
                <th className="py-3.5 px-4 font-medium">Độ tin cậy mẫu</th>
                <th className="py-3.5 px-4 font-medium">Đồng bộ Edge Cams</th>
                <th className="py-3.5 px-4 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-slate-300">
              {employees.map(emp => (
                <tr key={emp.employee_id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={emp.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"}
                        alt={emp.full_name}
                        className="w-8 h-8 rounded-xl object-cover border border-slate-700"
                      />
                      <span className="font-semibold text-white">{emp.full_name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-blue-400">{emp.employee_id}</td>
                  <td className="py-3 px-4 text-slate-400">{emp.department}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono ${emp.face_enrolled
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                      {emp.face_enrolled ? 'ĐÃ ĐĂNG KÝ' : 'CHƯA ĐĂNG KÝ'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono ${emp.fingerprint_enrolled
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                      {emp.fingerprint_enrolled ? 'ĐÃ ĐĂNG KÝ' : 'CHƯA ĐĂNG KÝ'}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-green-400 font-bold">
                    {emp.face_enrolled ? '99.4% Match' : '—'}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-400">
                    {emp.face_enrolled || emp.fingerprint_enrolled ? '12/12 Cams' : '0/12 Cams'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEmpId(emp.employee_id);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs transition-colors"
                    >
                      Chọn để cập nhật
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Camera eKYC 3-Angle Modal */}
      <CameraEkycModal
        isOpen={isEkycModalOpen}
        onClose={() => setIsEkycModalOpen(false)}
        onComplete={handleEkycComplete}
        employeeName={currentEmp?.full_name || ''}
        employeeCode={currentEmp?.employee_id || ''}
      />

      {/* CONFIRMATION MODAL: Face ID Update */}
      <Modal
        isOpen={faceConfirmModal}
        onClose={() => setFaceConfirmModal(false)}
        title="Xác nhận cập nhật dữ liệu khuôn mặt"
        subtitle={`Nhân sự: ${currentEmp?.full_name} (${currentEmp?.employee_id})`}
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-2">
            <p className="font-semibold text-white">
              Xác nhận ghi nhận {uploadedPhotos.length} ảnh mẫu sinh trắc học?
            </p>
            <p className="text-slate-400 leading-relaxed">
              Dữ liệu vector 512-D trích xuất từ <strong>{uploadedPhotos.length} ảnh mẫu</strong> (bao gồm các góc chính diện, quay trái, quay phải) sẽ được tổng hợp thành Mean Centroid Vector theo chuẩn InsightFace ArcFace, mã hóa AES-256 và tự động đồng bộ tới 12 Edge Cameras tại các cửa.
            </p>
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-green-400 font-mono">
              <span>ĐIỀU KIỆN MẪU: ĐẠT (≥ 3 ẢNH)</span>
              <span>LIVENESS: 99.4% REAL</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setFaceConfirmModal(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleConfirmFaceSave}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md cursor-pointer"
            >
              Xác nhận lưu thay đổi
            </button>
          </div>
        </div>
      </Modal>

      {/* CONFIRMATION MODAL: Fingerprint Update */}
      <Modal
        isOpen={fingerConfirmModal}
        onClose={() => setFingerConfirmModal(false)}
        title="Xác nhận cập nhật mẫu vân tay"
        subtitle={`Nhân sự: ${currentEmp?.full_name} (${currentEmp?.employee_id})`}
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-2">
            <p className="font-semibold text-white">Xác nhận ghi đè mẫu sinh trắc vân tay</p>
            <p className="text-slate-400">
              Vị trí ngón: <strong className="text-white">{selectedFinger}</strong>
            </p>
            <p className="text-slate-400">
              Thiết bị ghi nhận: <strong className="text-white">{selectedDevice}</strong>
            </p>
            <p className="text-slate-400">
              Chỉ số chất lượng NFIQ: <strong className="text-green-400">98.5/100 (Rất tốt)</strong>
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setFingerConfirmModal(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleConfirmFingerprintSave}
              className="px-5 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-semibold shadow-md"
            >
              Xác nhận lưu mẫu vân tay
            </button>
          </div>
        </div>
      </Modal>

      {/* CONFIRMATION MODAL: Sync All Devices */}
      <Modal
        isOpen={syncAllModal}
        onClose={() => setSyncAllModal(false)}
        title="Xác nhận đồng bộ cơ sở dữ liệu sinh trắc học"
        subtitle="Gửi gói tin Broadcast đồng bộ tới toàn bộ Edge Cams"
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-300 leading-relaxed">
            Hành động này sẽ gửi lệnh đồng bộ toàn bộ cơ sở dữ liệu vector khuôn mặt và mẫu vân tay của <strong className="text-white">{employees.length} nhân sự</strong> tới 12 thiết bị Edge AI Cams và đầu đọc tại các cửa.
          </p>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={syncingDevices}
              onClick={() => setSyncAllModal(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              disabled={syncingDevices}
              onClick={handleConfirmSyncAll}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md flex items-center gap-2"
            >
              {syncingDevices ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang đồng bộ...</span>
                </>
              ) : (
                <span>Xác nhận phát lệnh đồng bộ</span>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};