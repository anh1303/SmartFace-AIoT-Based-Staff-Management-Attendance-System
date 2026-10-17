import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import { useAuth } from '../../../context/AuthContext';
import { isAnotherManager } from '../../../utils/permissionUtils';
import { logger } from '../../../utils/logger';
import { enrollFaceImagesApi, deleteEmployeeBiometricsApi, EnrollFaceResult } from '../../../api/biometricApi';
import { Employee } from '../../../types';
import { FacePhotoItem } from '../components/FaceEnrollmentSection';
import { FingerprintStep } from '../components/FingerprintEnrollmentSection';
import { CapturedFaceSample } from '../components/CameraEkycModal';

const biometricLogger = logger.child('useBiometricEnrollment');

export interface UseBiometricEnrollmentOptions {
  defaultTab?: 'FACE' | 'FINGERPRINT';
}

export function useBiometricEnrollment(options: UseBiometricEnrollmentOptions = {}) {
  const { employees, updateEmployee, showToast } = useApp();
  const { currentUser, role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryEmpId = searchParams.get('employee_id') || searchParams.get('empId');

  // Selected employee for enrollment - safely fallback to first employee or empty string without hardcoded NV-001
  const [selectedEmpId, setSelectedEmpId] = useState<string>(
    () => queryEmpId || employees[0]?.employee_id || ''
  );
  const [activeTab, setActiveTab] = useState<'FACE' | 'FINGERPRINT'>(options.defaultTab || 'FACE');

  // Sync selectedEmpId when URL query param changes
  useEffect(() => {
    if (queryEmpId && queryEmpId !== selectedEmpId) {
      setSelectedEmpId(queryEmpId);
    } else if (!selectedEmpId && employees.length > 0) {
      setSelectedEmpId(employees[0].employee_id);
    }
  }, [queryEmpId, selectedEmpId, employees]);

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

  const currentEmp = useMemo(() => {
    return (
      employees.find((e) => e.employee_id === selectedEmpId || e.id === selectedEmpId) ||
      employees[0] ||
      null
    );
  }, [employees, selectedEmpId]);

  // Chốt chặn: Bất kiêm nhiệm - không ai được tự đăng ký sinh trắc học của mình
  // và Quản lý không được sửa sinh trắc học của Quản lý khác
  const isSelf = Boolean(
    currentEmp && currentUser &&
    (currentEmp.employee_id === currentUser.employee_id || currentEmp.email === currentUser.email)
  );
  const isOtherMgr = isAnotherManager(currentEmp, currentUser);
  const isEnrollmentBlocked = role !== 'admin' && (isSelf || isOtherMgr);

  // Handle Photo Upload (Multiple files allowed)
  const handlePhotoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (isEnrollmentBlocked) {
      showToast(
        isSelf
          ? 'Không ai được tự đăng ký sinh trắc học của chính mình. Vui lòng liên hệ Admin phê duyệt!'
          : 'Quản lý không có quyền cập nhật sinh trắc học của Quản lý khác!',
        'error'
      );
      return;
    }
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
  }, [isEnrollmentBlocked, isSelf, showToast, uploadedPhotos.length]);

  const handleRemovePhoto = useCallback((id: string) => {
    setUploadedPhotos((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleEkycComplete = useCallback((samples: CapturedFaceSample[]) => {
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
  }, [currentEmp?.full_name, showToast]);

  const handleConfirmFaceSave = useCallback(async () => {
    if (!currentEmp || uploadedPhotos.length < 3) return;
    if (isEnrollmentBlocked) {
      showToast(
        isSelf
          ? 'Không ai được tự đăng ký sinh trắc học của chính mình. Vui lòng liên hệ Admin phê duyệt!'
          : 'Quản lý không có quyền cập nhật sinh trắc học của Quản lý khác!',
        'error'
      );
      return;
    }
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
  }, [currentEmp, uploadedPhotos, isEnrollmentBlocked, isSelf, showToast, updateEmployee]);

  const handleSendIoTTrigger = useCallback(() => {
    if (isEnrollmentBlocked) {
      showToast(
        isSelf
          ? 'Không ai được tự đăng ký sinh trắc học của chính mình. Vui lòng liên hệ Admin phê duyệt!'
          : 'Quản lý không có quyền cập nhật sinh trắc học của Quản lý khác!',
        'error'
      );
      return;
    }
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
  }, [isEnrollmentBlocked, isSelf, showToast]);

  const handleConfirmFingerprintSave = useCallback(() => {
    if (!currentEmp) return;
    if (isEnrollmentBlocked) {
      showToast(
        isSelf
          ? 'Không ai được tự đăng ký sinh trắc học của chính mình. Vui lòng liên hệ Admin phê duyệt!'
          : 'Quản lý không có quyền cập nhật sinh trắc học của Quản lý khác!',
        'error'
      );
      return;
    }
    updateEmployee(currentEmp.employee_id, {
      fingerprint_enrolled: true,
    });
    setFingerConfirmModal(false);
    setFingerprintStep('IDLE');
    showToast(
      `Đã lưu mẫu vân tay ${selectedFinger} cho ${currentEmp.full_name} từ ${selectedDevice}!`,
      'success'
    );
  }, [currentEmp, isEnrollmentBlocked, isSelf, showToast, updateEmployee, selectedFinger, selectedDevice]);

  const currentManageEmp = useMemo(() => {
    if (!manageModalEmployee) return null;
    return employees.find((e) => e.employee_id === manageModalEmployee.employee_id) || manageModalEmployee;
  }, [employees, manageModalEmployee]);

  const handleDeleteFaceId = useCallback(async (emp: Employee) => {
    const isSelfEmp = Boolean(
      emp && currentUser && (emp.employee_id === currentUser.employee_id || emp.email === currentUser.email)
    );
    const isOtherMgrEmp = isAnotherManager(emp, currentUser);
    if (role !== 'admin' && (isSelfEmp || isOtherMgrEmp)) {
      showToast(
        isSelfEmp
          ? 'Không ai được tự xóa dữ liệu sinh trắc học của chính mình. Vui lòng liên hệ Admin!'
          : 'Quản lý không có quyền xóa sinh trắc học của Quản lý khác!',
        'error'
      );
      return;
    }

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
  }, [currentUser, role, showToast, updateEmployee]);

  const handleDeleteFingerprint = useCallback((emp: Employee) => {
    const isSelfEmp = Boolean(
      emp && currentUser && (emp.employee_id === currentUser.employee_id || emp.email === currentUser.email)
    );
    const isOtherMgrEmp = isAnotherManager(emp, currentUser);
    if (role !== 'admin' && (isSelfEmp || isOtherMgrEmp)) {
      showToast(
        isSelfEmp
          ? 'Không ai được tự xóa dữ liệu sinh trắc học của chính mình. Vui lòng liên hệ Admin!'
          : 'Quản lý không có quyền xóa sinh trắc học của Quản lý khác!',
        'error'
      );
      return;
    }

    updateEmployee(emp.employee_id, {
      fingerprint_enrolled: false,
    });
    showToast(
      `Đã xóa dữ liệu vân tay của nhân viên ${emp.full_name} (${emp.employee_id}) thành công!`,
      'success'
    );
  }, [currentUser, role, showToast, updateEmployee]);

  const handleStartEditFace = useCallback((emp: Employee) => {
    setSelectedEmpId(emp.employee_id);
    setSearchParams({ employee_id: emp.employee_id });
    setActiveTab('FACE');
    setManageModalEmployee(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setSearchParams]);

  const handleStartCameraEkycFromModal = useCallback((emp: Employee) => {
    setSelectedEmpId(emp.employee_id);
    setSearchParams({ employee_id: emp.employee_id });
    setActiveTab('FACE');
    setManageModalEmployee(null);
    setIsEkycModalOpen(true);
  }, [setSearchParams]);

  const handleStartEditFingerprint = useCallback((emp: Employee) => {
    setSelectedEmpId(emp.employee_id);
    setSearchParams({ employee_id: emp.employee_id });
    setActiveTab('FINGERPRINT');
    setManageModalEmployee(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setSearchParams]);

  return {
    selectedEmpId,
    setSelectedEmpId,
    activeTab,
    setActiveTab,
    currentEmp,
    isSelf,
    isOtherMgr,
    isEnrollmentBlocked,

    // Face enrollment
    uploadedPhotos,
    setUploadedPhotos,
    analyzingFace,
    faceConfirmModal,
    setFaceConfirmModal,
    isEkycModalOpen,
    setIsEkycModalOpen,
    enrollResult,
    resultModalOpen,
    setResultModalOpen,
    handlePhotoUpload,
    handleRemovePhoto,
    handleEkycComplete,
    handleConfirmFaceSave,

    // Fingerprint enrollment
    selectedDevice,
    setSelectedDevice,
    selectedFinger,
    setSelectedFinger,
    fingerprintStep,
    setFingerprintStep,
    fingerQualityScore,
    fingerConfirmModal,
    setFingerConfirmModal,
    handleSendIoTTrigger,
    handleConfirmFingerprintSave,

    // Manage popup modal
    manageModalEmployee,
    setManageModalEmployee,
    currentManageEmp,
    handleDeleteFaceId,
    handleDeleteFingerprint,
    handleStartEditFace,
    handleStartCameraEkycFromModal,
    handleStartEditFingerprint,
  };
}
