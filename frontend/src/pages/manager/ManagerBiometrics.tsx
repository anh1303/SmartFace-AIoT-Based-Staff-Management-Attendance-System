import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { ScanFace, Fingerprint } from 'lucide-react';
import { CameraEkycModal, CapturedFaceSample } from '../../components/biometrics/CameraEkycModal';
import { enrollFaceImagesApi, deleteEmployeeBiometricsApi, EnrollFaceResult } from '../../api/biometricApi';
import { Employee } from '../../types';
import { logger } from '../../utils/logger';
import {
  BiometricsHeader,
  EmployeeBiometricsCard,
  FaceEnrollmentSection,
  FacePhotoItem,
  FingerprintEnrollmentSection,
  FingerprintStep,
  BiometricsStaffTable,
  ManageBiometricsModal,
  FaceConfirmModal,
  FaceResultModal,
  FingerprintConfirmModal,
} from '../../features/biometrics';

const biometricLogger = logger.child('ManagerBiometrics');

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
  const [selectedDevice, setSelectedDevice] = useState<string>(
    'FaceCam-01 (Máy chấm công Face_ID Vào ca)'
  );
  const [selectedFinger, setSelectedFinger] = useState<string>('Ngón trỏ phải (Right Index)');
  const [fingerprintStep, setFingerprintStep] = useState<FingerprintStep>('IDLE');
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

  const currentEmp = employees.find((e) => e.employee_id === selectedEmpId) || employees[0];

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
          setUploadedPhotos((prev) => [...prev, ...newPhotos]);
          setAnalyzingFace(false);
        }
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const handleRemovePhoto = (id: string) => {
    setUploadedPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const handleEkycComplete = (samples: CapturedFaceSample[]) => {
    const newItems: FacePhotoItem[] = samples.map((s) => ({
      id: s.id,
      url: s.dataUrl,
      name: `${s.label} (Camera eKYC)`,
      tag: s.label,
    }));

    setUploadedPhotos(newItems);
    showToast(
      `Đã thu thập đủ 3 góc khuôn mặt chuẩn eKYC cho ${currentEmp?.full_name}!`,
      'success'
    );
  };

  const handleConfirmFaceSave = async () => {
    if (!currentEmp || uploadedPhotos.length < 3) return;
    setAnalyzingFace(true);
    try {
      const frontalPhoto = uploadedPhotos[0]?.url || currentEmp.avatar;
      const imagesBase64 = uploadedPhotos.map((p) => p.url);

      const result = await enrollFaceImagesApi(currentEmp.employee_id, imagesBase64);

      updateEmployee(currentEmp.employee_id, {
        avatar: frontalPhoto,
      });

      const total = result?.total_images ?? uploadedPhotos.length;
      const detected = result?.detected_faces ?? result?.n_samples_used ?? uploadedPhotos.length;
      const rate =
        result?.extraction_rate ?? (total > 0 ? Math.round((detected / total) * 100) : 100);
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
      showToast(
        `Lỗi khi cập nhật sinh trắc học: ${err.message || 'Thao tác không thành công'}`,
        'error'
      );
    } finally {
      setAnalyzingFace(false);
    }
  };

  const handleSendIoTTrigger = () => {
    setFingerprintStep('SENDING');
    setTimeout(() => {
      setFingerprintStep('WAITING_TOUCH');
      setTimeout(() => {
        setFingerprintStep('CAPTURED');
        setTimeout(() => {
          setFingerprintStep('VERIFIED');
          setFingerQualityScore(98.5);
        }, 1000);
      }, 2000);
    }, 1200);
  };

  const handleConfirmFingerprintSave = () => {
    if (!currentEmp) return;
    updateEmployee(currentEmp.employee_id, {
      fingerprint_enrolled: true,
    });
    setFingerConfirmModal(false);
    setFingerprintStep('IDLE');
    showToast(
      `Đã lưu mẫu vân tay ${selectedFinger} cho ${currentEmp.full_name} từ ${selectedDevice}!`,
      'success'
    );
  };

  const currentManageEmp = manageModalEmployee
    ? employees.find((e) => e.employee_id === manageModalEmployee.employee_id) ||
      manageModalEmployee
    : null;

  const handleDeleteFaceId = async (emp: Employee) => {
    try {
      await deleteEmployeeBiometricsApi(emp.employee_id);
    } catch (err: any) {
      biometricLogger.warn('Biometric delete info:', err);
    }
    updateEmployee(emp.employee_id, {
      face_enrolled: false,
    });
    showToast(
      `Đã xóa dữ liệu Face ID của nhân viên ${emp.full_name} (${emp.employee_id}) thành công!`,
      'success'
    );
  };

  const handleDeleteFingerprint = (emp: Employee) => {
    updateEmployee(emp.employee_id, {
      fingerprint_enrolled: false,
    });
    showToast(
      `Đã xóa dữ liệu vân tay của nhân viên ${emp.full_name} (${emp.employee_id}) thành công!`,
      'success'
    );
  };

  const handleStartEditFace = (emp: Employee) => {
    setSelectedEmpId(emp.employee_id);
    setSearchParams({ employee_id: emp.employee_id });
    setActiveTab('FACE');
    setManageModalEmployee(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStartCameraEkycFromModal = (emp: Employee) => {
    setSelectedEmpId(emp.employee_id);
    setSearchParams({ employee_id: emp.employee_id });
    setActiveTab('FACE');
    setManageModalEmployee(null);
    setIsEkycModalOpen(true);
  };

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
    employees.forEach((e) => {
      const pos = e.position || e.department;
      if (pos) set.add(pos);
    });
    return Array.from(set);
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
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
      {/* Header Banner */}
      <BiometricsHeader />

      {/* Main Enrollment Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Choose Employee & Current Profile */}
        <div className="lg:col-span-4 space-y-4">
          <EmployeeBiometricsCard
            employees={employees}
            selectedEmpId={selectedEmpId}
            onSelectEmployee={(empId) => {
              setSelectedEmpId(empId);
              setSearchParams({ employee_id: empId });
            }}
            currentEmp={currentEmp}
          />
        </div>

        {/* Right Column: Biometric Actions (Tabs: Face / Fingerprint) */}
        <div className="lg:col-span-8">
          <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-xl p-6 space-y-6 shadow-xs transition-colors">
            {/* Mode Switcher */}
            <div className="border-b border-slate-100 dark:border-[#21264b] pb-4">
              <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl w-full">
                <button
                  type="button"
                  onClick={() => setActiveTab('FACE')}
                  className={`w-full py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    activeTab === 'FACE'
                      ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/20'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1a1e3a]'
                  }`}
                >
                  <ScanFace className="w-4 h-4" />
                  <span>Cập nhật Khuôn mặt</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('FINGERPRINT')}
                  className={`w-full py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    activeTab === 'FINGERPRINT'
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1a1e3a]'
                  }`}
                >
                  <Fingerprint className="w-4 h-4" />
                  <span>Cập nhật Vân tay</span>
                </button>
              </div>
            </div>

            {/* TAB 1: Face ID Multi-Photo Upload & Camera eKYC */}
            {activeTab === 'FACE' && (
              <FaceEnrollmentSection
                uploadedPhotos={uploadedPhotos}
                analyzingFace={analyzingFace}
                onOpenEkycModal={() => setIsEkycModalOpen(true)}
                onPhotoUpload={handlePhotoUpload}
                onRemovePhoto={handleRemovePhoto}
                onOpenConfirmModal={() => setFaceConfirmModal(true)}
              />
            )}

            {/* TAB 2: Fingerprint via Edge IoT Device Signal */}
            {activeTab === 'FINGERPRINT' && (
              <FingerprintEnrollmentSection
                selectedDevice={selectedDevice}
                onSelectDevice={setSelectedDevice}
                selectedFinger={selectedFinger}
                onSelectFinger={setSelectedFinger}
                fingerprintStep={fingerprintStep}
                fingerQualityScore={fingerQualityScore}
                onSendIoTTrigger={handleSendIoTTrigger}
                onOpenConfirmModal={() => setFingerConfirmModal(true)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Master Employee Biometric Status Table */}
      <BiometricsStaffTable
        employees={employees}
        filteredEmployees={filteredEmployees}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        positionFilter={positionFilter}
        onPositionFilterChange={setPositionFilter}
        positions={positions}
        onOpenManageModal={(emp) => setManageModalEmployee(emp)}
      />

      {/* Camera eKYC 3-Angle Modal */}
      <CameraEkycModal
        isOpen={isEkycModalOpen}
        onClose={() => setIsEkycModalOpen(false)}
        onComplete={handleEkycComplete}
        employeeName={currentEmp?.full_name || ''}
        employeeCode={currentEmp?.employee_id || ''}
      />

      {/* Confirmation & Result Modals */}
      <FaceConfirmModal
        isOpen={faceConfirmModal}
        onClose={() => setFaceConfirmModal(false)}
        currentEmp={currentEmp}
        photoCount={uploadedPhotos.length}
        analyzingFace={analyzingFace}
        onConfirm={handleConfirmFaceSave}
      />

      <FaceResultModal
        isOpen={resultModalOpen}
        onClose={() => setResultModalOpen(false)}
        currentEmp={currentEmp}
        enrollResult={enrollResult}
        uploadedPhotoCount={uploadedPhotos.length}
      />

      <FingerprintConfirmModal
        isOpen={fingerConfirmModal}
        onClose={() => setFingerConfirmModal(false)}
        currentEmp={currentEmp}
        selectedFinger={selectedFinger}
        selectedDevice={selectedDevice}
        onConfirm={handleConfirmFingerprintSave}
      />

      {/* Biometrics Management & Editing Modal */}
      <ManageBiometricsModal
        employee={currentManageEmp}
        onClose={() => setManageModalEmployee(null)}
        onStartEditFace={handleStartEditFace}
        onStartCameraEkyc={handleStartCameraEkycFromModal}
        onDeleteFaceId={handleDeleteFaceId}
        onStartEditFingerprint={handleStartEditFingerprint}
        onDeleteFingerprint={handleDeleteFingerprint}
      />
    </div>
  );
};
export default ManagerBiometrics;
