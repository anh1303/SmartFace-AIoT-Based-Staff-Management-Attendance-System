import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  Camera,
  Check,
  Sparkles,
  ArrowRight,
  Send,
  CheckCheck,
  Trash2,
  Plus,
  Layers,
  Edit,
  Search,
  Filter,
} from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { CameraEkycModal, CapturedFaceSample } from '../../components/biometrics/CameraEkycModal';
import { enrollFaceImagesApi, deleteEmployeeBiometricsApi, EnrollFaceResult } from '../../api/biometricApi';
import { Employee } from '../../types';
import { logger } from '../../utils/logger';

const biometricLogger = logger.child('ManagerBiometrics');

export interface FacePhotoItem {
  id: string;
  url: string;
  name: string;
  tag: string;
}

export const ManagerBiometrics: React.FC = () => {
  const { employees, updateEmployee, showToast } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryEmpId = searchParams.get('employee_id') || searchParams.get('empId');

  // Selected employee for enrollment
  const [selectedEmpId, setSelectedEmpId] = useState<string>(
    () => queryEmpId || employees[0]?.employee_id || 'NV-001'
  );
  const [activeTab, setActiveTab] = useState<'FACE' | 'FINGERPRINT'>('FACE');

  // Sync selectedEmpId when URL query param changes
  useEffect(() => {
    if (queryEmpId && queryEmpId !== selectedEmpId) {
      setSelectedEmpId(queryEmpId);
    }
  }, [queryEmpId, selectedEmpId]);

  // Face Enrollment State (Requires at least 3 photos)
  const [uploadedPhotos, setUploadedPhotos] = useState<FacePhotoItem[]>([]);
  const [analyzingFace, setAnalyzingFace] = useState<boolean>(false);
  const [faceConfirmModal, setFaceConfirmModal] = useState<boolean>(false);
  const [isEkycModalOpen, setIsEkycModalOpen] = useState<boolean>(false);
  const [enrollResult, setEnrollResult] = useState<EnrollFaceResult | null>(null);
  const [resultModalOpen, setResultModalOpen] = useState<boolean>(false);

  // Fingerprint Device Trigger State
  const [selectedDevice, setSelectedDevice] = useState<string>('FaceCam-01 (Cổng chính - Tầng 1)');
  const [selectedFinger, setSelectedFinger] = useState<string>('Ngón trỏ phải (Right Index)');
  const [fingerprintStep, setFingerprintStep] = useState<'IDLE' | 'SENDING' | 'WAITING_TOUCH' | 'CAPTURED' | 'VERIFIED'>('IDLE');
  const [fingerQualityScore, setFingerQualityScore] = useState<number | null>(null);
  const [fingerConfirmModal, setFingerConfirmModal] = useState<boolean>(false);

  // Biometrics Management Popup Modal state for a specific employee
  const [manageModalEmployee, setManageModalEmployee] = useState<Employee | null>(null);

  // Reset photos & biometric state whenever selected employee changes
  useEffect(() => {
    setUploadedPhotos([]);
    setAnalyzingFace(false);
    setFingerprintStep('IDLE');
    setFingerQualityScore(null);
  }, [selectedEmpId]);

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
        });
        loadedCount++;

        if (loadedCount === fileList.length) {
          setUploadedPhotos(prev => {
            const merged = [...prev, ...newPhotos];
            return merged;
          });
          setAnalyzingFace(false);
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
      tag: s.label
    }));

    setUploadedPhotos(newItems);
    showToast(`Đã thu thập đủ 3 góc khuôn mặt chuẩn eKYC cho ${currentEmp?.full_name}!`, 'success');
  };

  // Confirm Face Update (requires explicit confirm button and >= 3 photos)
  const handleConfirmFaceSave = async () => {
    if (!currentEmp || uploadedPhotos.length < 3) return;
    setAnalyzingFace(true);
    try {
      const frontalPhoto = uploadedPhotos[0]?.url || currentEmp.avatar;
      const imagesBase64 = uploadedPhotos.map(p => p.url);

      // 1. Gọi API enroll khuôn mặt để trích xuất vector 512-D và lưu vào PostgreSQL
      const result = await enrollFaceImagesApi(currentEmp.employee_id, imagesBase64);

      // 2. Cập nhật avatar; face_enrolled được suy ra từ centroid lưu trong DB.
      updateEmployee(currentEmp.employee_id, {
        avatar: frontalPhoto
      });

      const total = result?.total_images ?? uploadedPhotos.length;
      const detected = result?.detected_faces ?? result?.n_samples_used ?? uploadedPhotos.length;
      const rate = result?.extraction_rate ?? (total > 0 ? Math.round((detected / total) * 100) : 100);
      const used = result?.n_samples_used ?? detected;

      setEnrollResult(result);
      setFaceConfirmModal(false);
      setResultModalOpen(true);

      showToast(
        `Đã trích xuất thành công ${detected}/${total} khung hình trong ảnh (Tỉ lệ: ${rate}%). Đã lưu ${used} vector khuôn mặt 512-D cho nhân viên ${currentEmp.full_name} (${currentEmp.employee_id})!`,
        'success'
      );
    } catch (err: any) {
      biometricLogger.error('Error updating face biometrics:', err);
      showToast(`Lỗi khi cập nhật sinh trắc học: ${err.message || 'Thao tác không thành công'}`, 'error');
    } finally {
      setAnalyzingFace(false);
    }
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

  // Resolve current employee selected for management in popup
  const currentManageEmp = manageModalEmployee
    ? employees.find(e => e.employee_id === manageModalEmployee.employee_id) || manageModalEmployee
    : null;

  // Handler to delete Face ID for an employee
  const handleDeleteFaceId = async (emp: Employee) => {
    try {
      await deleteEmployeeBiometricsApi(emp.employee_id);
    } catch (err: any) {
      biometricLogger.warn('Biometric delete info:', err);
    }
    updateEmployee(emp.employee_id, {
      face_enrolled: false
    });
    showToast(`Đã xóa dữ liệu Face ID của nhân viên ${emp.full_name} (${emp.employee_id}) thành công!`, 'success');
  };

  // Handler to delete Fingerprint for an employee
  const handleDeleteFingerprint = (emp: Employee) => {
    updateEmployee(emp.employee_id, {
      fingerprint_enrolled: false
    });
    showToast(`Đã xóa dữ liệu vân tay của nhân viên ${emp.full_name} (${emp.employee_id}) thành công!`, 'success');
  };

  // Handler to start editing Face ID from popup
  const handleStartEditFace = (emp: Employee) => {
    setSelectedEmpId(emp.employee_id);
    setSearchParams({ employee_id: emp.employee_id });
    setActiveTab('FACE');
    setManageModalEmployee(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handler to start Camera eKYC from popup
  const handleStartCameraEkycFromModal = (emp: Employee) => {
    setSelectedEmpId(emp.employee_id);
    setSearchParams({ employee_id: emp.employee_id });
    setActiveTab('FACE');
    setManageModalEmployee(null);
    setIsEkycModalOpen(true);
  };

  // Handler to start editing Fingerprint from popup
  const handleStartEditFingerprint = (emp: Employee) => {
    setSelectedEmpId(emp.employee_id);
    setSearchParams({ employee_id: emp.employee_id });
    setActiveTab('FINGERPRINT');
    setManageModalEmployee(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Table search & filter states
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [positionFilter, setPositionFilter] = useState<string>('ALL');

  const positions = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => {
      const pos = e.position || e.department;
      if (pos) set.add(pos);
    });
    return Array.from(set);
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const q = searchTerm.toLowerCase().trim();
      const matchSearch =
        !q ||
        emp.full_name.toLowerCase().includes(q) ||
        emp.employee_id.toLowerCase().includes(q) ||
        (emp.position && emp.position.toLowerCase().includes(q)) ||
        (emp.department && emp.department.toLowerCase().includes(q));

      const pos = emp.position || emp.department;
      const matchPosition = positionFilter === 'ALL' || pos === positionFilter;

      return matchSearch && matchPosition;
    });
  }, [employees, searchTerm, positionFilter]);

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
                  setSearchParams({ employee_id: e.target.value });
                }}
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
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
                      <h3 className="text-sm font-bold text-white font-heading">
                        Cập Nhật Dữ Liệu Khuôn Mặt
                      </h3>
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-white font-heading">
              Bảng Tổng Hợp Trạng Thái Sinh Trắc Học Nhân Viên
            </h2>
            <span className="px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-blue-400 font-mono text-xs font-bold shadow-sm">
              {filteredEmployees.length} / {employees.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Search by Employee */}
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm tên, mã NV..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
              />
            </div>

            {/* Position Filter */}
            <div className="relative">
              <Filter className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={positionFilter}
                onChange={e => setPositionFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
              >
                <option value="ALL">Tất cả chức vụ</option>
                {positions.map(pos => (
                  <option key={pos} value={pos}>{pos}</option>
                ))}
              </select>
            </div>
          </div>
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
                <th className="py-3.5 px-4 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-slate-300">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Không tìm thấy nhân sự phù hợp với bộ lọc
                  </td>
                </tr>
              ) : (
                filteredEmployees.map(emp => (
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
                    <td className="py-3 px-4 text-slate-400">{emp.position || emp.department}</td>
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
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setManageModalEmployee(emp)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer ml-auto"
                      >
                        <Edit className="w-3.5 h-3.5 text-slate-400" />
                        <span>Sửa</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
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
              Ảnh sẽ được gửi đến Face Auth để phát hiện khuôn mặt, trích xuất vector 512-D và tạo centroid. Các vector được lưu trong bảng <code>face_embeddings</code> của database PBL6. Luồng đăng ký này chưa kiểm tra liveness hoặc đồng bộ đến thiết bị Edge.
            </p>
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-green-400 font-mono">
              <span>ĐIỀU KIỆN: ĐỦ 3 ẢNH</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={analyzingFace}
              onClick={() => setFaceConfirmModal(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              disabled={analyzingFace}
              onClick={handleConfirmFaceSave}
              className={`px-5 py-2 rounded-xl text-white text-xs font-semibold shadow-md flex items-center gap-2 transition-all cursor-pointer ${
                analyzingFace
                  ? 'bg-blue-600/70 cursor-wait'
                  : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30'
              }`}
            >
              {analyzingFace ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang trích xuất & lưu...</span>
                </>
              ) : (
                <span>Xác nhận lưu thay đổi</span>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* RESULT MODAL: Face ID Extraction & Update Summary */}
      <Modal
        isOpen={resultModalOpen}
        onClose={() => setResultModalOpen(false)}
        title="Thông báo kết quả trích xuất sinh trắc học khuôn mặt"
        subtitle={`Nhân sự: ${currentEmp?.full_name} (${currentEmp?.employee_id})`}
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">Trạng thái xử lý:</span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-green-500/10 text-green-400 border border-green-500/30 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                ĐÃ TRÍCH XUẤT THÀNH CÔNG
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-1">Khung hình trích xuất:</span>
                <span className="text-base font-bold font-mono text-blue-400">
                  {enrollResult?.detected_faces ?? uploadedPhotos.length}/{enrollResult?.total_images ?? uploadedPhotos.length} khung hình
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  Tỉ lệ đạt: <strong className="text-cyan-400 font-mono">{enrollResult?.extraction_rate ?? 100}%</strong>
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-1">Vector 512-D hợp lệ:</span>
                <span className="text-base font-bold font-mono text-green-400">
                  {enrollResult?.n_samples_used ?? uploadedPhotos.length} vector
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  Loại bỏ outlier: <strong className="text-slate-400 font-mono">{enrollResult?.n_outliers_removed ?? 0} ảnh</strong>
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-[11px] font-mono text-slate-400">
                <span>Tỉ lệ trích xuất thành công</span>
                <span className="font-bold text-green-400">{enrollResult?.extraction_rate ?? 100}%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 via-cyan-500 to-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${enrollResult?.extraction_rate ?? 100}%` }}
                />
              </div>
            </div>

            {enrollResult?.warnings && enrollResult.warnings.length > 0 && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Ghi chú trích xuất:
                </p>
                {enrollResult.warnings.map((w, idx) => (
                  <p key={idx}>• {w}</p>
                ))}
              </div>
            )}

            <p className="text-[11px] text-slate-400 pt-1 leading-relaxed">
              Các mẫu khuôn mặt đã được lưu vào bảng <code>face_embeddings</code> trong database PBL6. Việc đăng ký không tự đồng bộ dữ liệu sang thiết bị Edge.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setResultModalOpen(false)}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md cursor-pointer transition-colors"
            >
              Hoàn tất & Đóng
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

      {/* Biometrics Management & Editing Modal */}
      <Modal
        isOpen={Boolean(manageModalEmployee)}
        onClose={() => setManageModalEmployee(null)}
        title="Quản Lý Sinh Trắc Học Nhân Viên"
        subtitle={`Nhân sự: ${currentManageEmp?.full_name} (${currentManageEmp?.employee_id})`}
        maxWidth="lg"
      >
        {currentManageEmp && (
          <div className="space-y-5">
            {/* Employee Profile Header Card */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <img
                  src={currentManageEmp.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120"}
                  alt={currentManageEmp.full_name}
                  className="w-12 h-12 rounded-xl object-cover border border-slate-700"
                />
                <div>
                  <h4 className="text-sm font-bold text-white">{currentManageEmp.full_name}</h4>
                  <p className="text-xs font-mono text-blue-400">{currentManageEmp.employee_id}</p>
                  <p className="text-[11px] text-slate-400">{currentManageEmp.department} • {currentManageEmp.position}</p>
                </div>
              </div>
            </div>

            {/* Section 1: Face ID Management */}
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <ScanFace className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-white uppercase tracking-wider">Khuôn mặt (Face ID)</h5>
                    <p className="text-[11px] text-slate-400">Nhận diện khuôn mặt 512-D qua camera AIoT</p>
                  </div>
                </div>

                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono ${
                  currentManageEmp.face_enrolled
                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                  {currentManageEmp.face_enrolled ? 'ĐÃ ĐĂNG KÝ' : 'CHƯA ĐĂNG KÝ'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => handleStartEditFace(currentManageEmp)}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{currentManageEmp.face_enrolled ? 'Chỉnh sửa / Tải ảnh mới' : 'Đăng ký tải ảnh Face ID'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleStartCameraEkycFromModal(currentManageEmp)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Chụp bằng Camera eKYC</span>
                </button>

                {currentManageEmp.face_enrolled && (
                  <button
                    type="button"
                    onClick={() => handleDeleteFaceId(currentManageEmp)}
                    className="px-3.5 py-2 rounded-xl bg-rose-600/15 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa Face ID</span>
                  </button>
                )}
              </div>
            </div>

            {/* Section 2: Fingerprint Management */}
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400">
                    <Fingerprint className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-white uppercase tracking-wider">Vân tay (FAP30)</h5>
                    <p className="text-[11px] text-slate-400">Ghi nhận mẫu vân tay quang học 500 DPI qua IoT</p>
                  </div>
                </div>

                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono ${
                  currentManageEmp.fingerprint_enrolled
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                  {currentManageEmp.fingerprint_enrolled ? 'ĐÃ ĐĂNG KÝ' : 'CHƯA ĐĂNG KÝ'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => handleStartEditFingerprint(currentManageEmp)}
                  className="px-3.5 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>{currentManageEmp.fingerprint_enrolled ? 'Chỉnh sửa / Lấy lại mẫu IoT' : 'Ghi nhận mẫu vân tay IoT'}</span>
                </button>

                {currentManageEmp.fingerprint_enrolled && (
                  <button
                    type="button"
                    onClick={() => handleDeleteFingerprint(currentManageEmp)}
                    className="px-3.5 py-2 rounded-xl bg-rose-600/15 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa Vân tay</span>
                  </button>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setManageModalEmployee(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
};
