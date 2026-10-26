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

export const MAX_FACE_PHOTOS = 10;

export interface UseBiometricEnrollmentOptions {
  defaultTab?: 'FACE' | 'FINGERPRINT';
}

export function useBiometricEnrollment(options: UseBiometricEnrollmentOptions = {}) {
  const { employees, updateEmployee, showToast } = useApp();
  const { currentUser, role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryEmpId = searchParams.get('employee_id') || searchParams.get('empId');

  const isManager = role === 'manager';
  const managerDept = currentUser?.department;

  // Quản lý có thể tìm kiếm nhân viên trong phòng và bản thân mình, nhưng không thể sửa sinh trắc học của bản thân
  const scopedEmployees = useMemo(() => {
    if (isManager && managerDept) {
      return employees.filter((e) => {
        const isMyDept = e.department?.toLowerCase() === managerDept.toLowerCase();
        const isSelf =
          (currentUser?.employee_id && (e.employee_id === currentUser.employee_id || e.id === currentUser.employee_id)) ||
          (currentUser?.email && e.email?.toLowerCase() === currentUser.email?.toLowerCase());
        const isOtherMgr = isAnotherManager(e, currentUser);
        // Quản lý xem và tìm kiếm được nhân viên trong phòng VÀ bản thân mình, loại trừ các quản lý khác
        return (isMyDept || isSelf) && !isOtherMgr;
      });
    }
    return employees;
  }, [employees, isManager, managerDept, currentUser]);

  // Selected employee for enrollment - safely fallback to first scoped employee (ưu tiên nhân viên có thể sửa)
  const [selectedEmpId, setSelectedEmpId] = useState<string>(() => {
    if (queryEmpId && scopedEmployees.some((e) => e.employee_id === queryEmpId || e.id === queryEmpId)) {
      return queryEmpId;
    }
    const editable = scopedEmployees.find((e) => {
      const isSelfEmp =
        (currentUser?.employee_id && (e.employee_id === currentUser.employee_id || e.id === currentUser.employee_id)) ||
        (currentUser?.email && e.email?.toLowerCase() === currentUser.email?.toLowerCase());
      return !isSelfEmp;
    });
    return editable?.employee_id || scopedEmployees[0]?.employee_id || '';
  });
  const [activeTab, setActiveTab] = useState<'FACE' | 'FINGERPRINT'>(options.defaultTab || 'FACE');

  // Sync selectedEmpId when URL query param changes or scopedEmployees updates
  useEffect(() => {
    if (scopedEmployees.length === 0) {
      if (selectedEmpId !== '') {
        setSelectedEmpId('');
      }
      return;
    }

    if (queryEmpId && scopedEmployees.some((e) => e.employee_id === queryEmpId || e.id === queryEmpId)) {
      if (selectedEmpId !== queryEmpId) {
        setSelectedEmpId(queryEmpId);
      }
    } else if (!scopedEmployees.some((e) => e.employee_id === selectedEmpId || e.id === selectedEmpId)) {
      setSelectedEmpId(scopedEmployees[0].employee_id);
    }
  }, [queryEmpId, selectedEmpId, scopedEmployees]);

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
    if (scopedEmployees.length === 0) return undefined;
    return (
      scopedEmployees.find((e) => e.employee_id === selectedEmpId || e.id === selectedEmpId) ||
      scopedEmployees[0]
    );
  }, [scopedEmployees, selectedEmpId]);

  // Chốt chặn an toàn: Bất kiêm nhiệm - không ai được tự đăng ký sinh trắc học của mình,
  // và Quản lý chỉ có quyền xem/sửa sinh trắc học của nhân viên thuộc phòng mình phụ trách (không sửa quản lý khác)
  const isSelf = Boolean(
    currentEmp && currentUser &&
    (currentEmp.employee_id === currentUser.employee_id || currentEmp.email === currentUser.email)
  );
  const isOtherMgr = isAnotherManager(currentEmp, currentUser);
  const isDiffDept = Boolean(
    isManager && managerDept && currentEmp && currentEmp.department?.toLowerCase() !== managerDept.toLowerCase()
  );
  const isEnrollmentBlocked = role !== 'admin' && (isSelf || isOtherMgr || isDiffDept || !currentEmp);

  const getBlockedMessage = useCallback((action: string = 'cập nhật') => {
    if (!currentEmp) return 'Vui lòng chọn nhân viên cần thực hiện!';
    if (isSelf) return `Không ai được tự ${action} dữ liệu sinh trắc học của chính mình. Vui lòng liên hệ Admin phê duyệt!`;
    if (isDiffDept) return `Quản lý chỉ có quyền ${action} sinh trắc học của nhân viên trong phòng ban của mình!`;
    if (isOtherMgr) return `Quản lý không có quyền ${action} sinh trắc học của Quản lý khác!`;
    return 'Bạn không có quyền thực hiện thao tác này!';
  }, [currentEmp, isSelf, isDiffDept, isOtherMgr]);

  // Handle Photo Upload (Multiple files allowed)
  const handlePhotoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (isEnrollmentBlocked) {
      showToast(getBlockedMessage('đăng ký'), 'error');
      return;
    }
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (uploadedPhotos.length >= MAX_FACE_PHOTOS) {
      showToast(
        `Đã đạt giới hạn tối đa ${MAX_FACE_PHOTOS} ảnh mẫu sinh trắc học!`,
        'warning'
      );
      e.target.value = '';
      return;
    }

    const remainingSlots = MAX_FACE_PHOTOS - uploadedPhotos.length;
    const fileList = Array.from(files).slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      showToast(
        `Chỉ có thể tải lên thêm ${remainingSlots} ảnh do giới hạn tối đa ${MAX_FACE_PHOTOS} ảnh.`,
        'warning'
      );
    }

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
          showToast(`Đã thêm ${fileList.length} ảnh vào danh sách mẫu!`, 'success');
        }
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  }, [isEnrollmentBlocked, getBlockedMessage, showToast, uploadedPhotos.length]);

  const handleRemovePhoto = useCallback((id: string) => {
    setUploadedPhotos((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleEkycComplete = useCallback((samples: CapturedFaceSample[]) => {
    if (!samples || samples.length === 0) return;

    setUploadedPhotos((prev) => {
      const remainingSlots = MAX_FACE_PHOTOS - prev.length;
      if (remainingSlots <= 0) {
        showToast(
          `Đã đạt giới hạn tối đa ${MAX_FACE_PHOTOS} ảnh mẫu sinh trắc học!`,
          'warning'
        );
        return prev;
      }

      const samplesToAdd = samples.slice(0, remainingSlots);
      if (samples.length > remainingSlots) {
        showToast(
          `Chỉ thêm tối đa ${remainingSlots} ảnh do đã đạt giới hạn ${MAX_FACE_PHOTOS} ảnh.`,
          'warning'
        );
      }

      const newItems: FacePhotoItem[] = samplesToAdd.map((s, idx) => {
        const overallIndex = prev.length + idx;
        // Đặt nhãn: bỏ dấu # hoàn toàn, từ ảnh 4 trở đi ghi rõ số thứ tự gọn gàng
        let tag = s.label.replace(/#/g, '').trim();
        if (overallIndex >= 3) {
          if (tag.startsWith('Ảnh')) {
            tag = `Ảnh ${overallIndex + 1}`;
          } else {
            tag = `${tag} (${overallIndex + 1})`;
          }
        }

        return {
          id: `ekyc_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
          url: s.dataUrl,
          name: `${tag} (Camera eKYC)`,
          tag,
        };
      });

      const updated = [...prev, ...newItems];

      if (prev.length === 0) {
        showToast(
          `Đã chụp ${newItems.length} ảnh khuôn mặt (Tối thiểu 3 ảnh) cho ${currentEmp?.full_name || 'nhân viên'}!`,
          'success'
        );
      } else {
        showToast(
          `Đã thêm ${newItems.length} ảnh chụp từ Camera vào danh sách mẫu (Hiện có ${updated.length}/${MAX_FACE_PHOTOS} ảnh)!`,
          'success'
        );
      }

      return updated;
    });
  }, [currentEmp?.full_name, showToast]);

  const handleConfirmFaceSave = useCallback(async () => {
    if (!currentEmp || uploadedPhotos.length < 3) return;
    if (isEnrollmentBlocked) {
      showToast(getBlockedMessage('cập nhật'), 'error');
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
  }, [currentEmp, uploadedPhotos, isEnrollmentBlocked, getBlockedMessage, showToast, updateEmployee]);

  const handleSendIoTTrigger = useCallback(() => {
    if (isEnrollmentBlocked) {
      showToast(getBlockedMessage('lấy mẫu vân tay'), 'error');
      return;
    }
    // TODO: Tích hợp thiết bị phần cứng thật thông qua MQTT broker / WebSocket bridge hoặc endpoint /api/devices/:id/trigger-fingerprint.
    // Hiện tại Backend Express chỉ lưu cờ `fingerprint_enrolled` (Boolean) trên CSDL nhân viên, chưa có module giao tiếp
    // trực tiếp phần cứng sinh trắc học vân tay thời gian thực, do đó các bước lấy mẫu (WAITING_TOUCH -> CAPTURED -> VERIFIED)
    // được mô phỏng Client-side phục vụ kiểm thử trải nghiệm người dùng (UX Simulation).
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
  }, [isEnrollmentBlocked, getBlockedMessage, showToast]);

  const handleConfirmFingerprintSave = useCallback(() => {
    if (!currentEmp) return;
    if (isEnrollmentBlocked) {
      showToast(getBlockedMessage('lưu vân tay'), 'error');
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
  }, [currentEmp, isEnrollmentBlocked, getBlockedMessage, showToast, updateEmployee, selectedFinger, selectedDevice]);

  const currentManageEmp = useMemo(() => {
    if (!manageModalEmployee) return null;
    return employees.find((e) => e.employee_id === manageModalEmployee.employee_id) || manageModalEmployee;
  }, [employees, manageModalEmployee]);

  const handleDeleteFaceId = useCallback(async (emp: Employee) => {
    const isSelfEmp = Boolean(
      emp && currentUser && (emp.employee_id === currentUser.employee_id || emp.email === currentUser.email)
    );
    const isOtherMgrEmp = isAnotherManager(emp, currentUser);
    const isDiffDeptEmp = Boolean(
      isManager && managerDept && emp && emp.department?.toLowerCase() !== managerDept.toLowerCase()
    );
    if (role !== 'admin' && (isSelfEmp || isOtherMgrEmp || isDiffDeptEmp)) {
      showToast(
        isSelfEmp
          ? 'Không ai được tự xóa dữ liệu sinh trắc học của chính mình. Vui lòng liên hệ Admin!'
          : isDiffDeptEmp
          ? 'Quản lý chỉ có quyền xóa sinh trắc học của nhân viên trong phòng ban của mình!'
          : 'Quản lý không có quyền xóa sinh trắc học của Quản lý khác!',
        'error'
      );
      return;
    }

    try {
      await deleteEmployeeBiometricsApi(emp.employee_id);
      updateEmployee(emp.employee_id, {
        face_enrolled: false,
      });
      showToast(
        `Đã xóa dữ liệu Face ID của nhân viên ${emp.full_name} (${emp.employee_id}) thành công!`,
        'success'
      );
    } catch (err: any) {
      biometricLogger.error('Lỗi khi xóa Face ID:', err);
      showToast(
        `Xóa dữ liệu Face ID thất bại: ${err?.message || 'Không thể kết nối đến máy chủ'}`,
        'error'
      );
    }
  }, [currentUser, isManager, managerDept, role, showToast, updateEmployee]);

  const handleDeleteFingerprint = useCallback((emp: Employee) => {
    const isSelfEmp = Boolean(
      emp && currentUser && (emp.employee_id === currentUser.employee_id || emp.email === currentUser.email)
    );
    const isOtherMgrEmp = isAnotherManager(emp, currentUser);
    const isDiffDeptEmp = Boolean(
      isManager && managerDept && emp && emp.department?.toLowerCase() !== managerDept.toLowerCase()
    );
    if (role !== 'admin' && (isSelfEmp || isOtherMgrEmp || isDiffDeptEmp)) {
      showToast(
        isSelfEmp
          ? 'Không ai được tự xóa dữ liệu sinh trắc học của chính mình. Vui lòng liên hệ Admin!'
          : isDiffDeptEmp
          ? 'Quản lý chỉ có quyền xóa sinh trắc học của nhân viên trong phòng ban của mình!'
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
  }, [currentUser, isManager, managerDept, role, showToast, updateEmployee]);

  const handleStartEditFace = useCallback((emp: Employee) => {
    const isSelfEmp = Boolean(
      emp && currentUser && (emp.employee_id === currentUser.employee_id || emp.email === currentUser.email)
    );
    const isOtherMgrEmp = isAnotherManager(emp, currentUser);
    const isDiffDeptEmp = Boolean(
      isManager && managerDept && emp && emp.department?.toLowerCase() !== managerDept.toLowerCase()
    );
    if (role !== 'admin' && (isSelfEmp || isOtherMgrEmp || isDiffDeptEmp)) {
      showToast(
        isSelfEmp
          ? 'Không ai được tự sửa dữ liệu sinh trắc học của chính mình. Vui lòng liên hệ Admin!'
          : isDiffDeptEmp
          ? 'Quản lý chỉ có quyền sửa sinh trắc học của nhân viên trong phòng ban của mình!'
          : 'Quản lý không có quyền sửa sinh trắc học của Quản lý khác!',
        'error'
      );
      return;
    }
    setSelectedEmpId(emp.employee_id);
    setSearchParams({ employee_id: emp.employee_id });
    setActiveTab('FACE');
    setManageModalEmployee(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentUser, isManager, managerDept, role, setSearchParams, showToast]);

  const handleStartCameraEkycFromModal = useCallback((emp: Employee) => {
    const isSelfEmp = Boolean(
      emp && currentUser && (emp.employee_id === currentUser.employee_id || emp.email === currentUser.email)
    );
    const isOtherMgrEmp = isAnotherManager(emp, currentUser);
    const isDiffDeptEmp = Boolean(
      isManager && managerDept && emp && emp.department?.toLowerCase() !== managerDept.toLowerCase()
    );
    if (role !== 'admin' && (isSelfEmp || isOtherMgrEmp || isDiffDeptEmp)) {
      showToast(
        isSelfEmp
          ? 'Không ai được tự sửa dữ liệu sinh trắc học của chính mình. Vui lòng liên hệ Admin!'
          : isDiffDeptEmp
          ? 'Quản lý chỉ có quyền sửa sinh trắc học của nhân viên trong phòng ban của mình!'
          : 'Quản lý không có quyền sửa sinh trắc học của Quản lý khác!',
        'error'
      );
      return;
    }
    setSelectedEmpId(emp.employee_id);
    setSearchParams({ employee_id: emp.employee_id });
    setActiveTab('FACE');
    setManageModalEmployee(null);
    setIsEkycModalOpen(true);
  }, [currentUser, isManager, managerDept, role, setSearchParams, showToast]);

  const handleStartEditFingerprint = useCallback((emp: Employee) => {
    const isSelfEmp = Boolean(
      emp && currentUser && (emp.employee_id === currentUser.employee_id || emp.email === currentUser.email)
    );
    const isOtherMgrEmp = isAnotherManager(emp, currentUser);
    const isDiffDeptEmp = Boolean(
      isManager && managerDept && emp && emp.department?.toLowerCase() !== managerDept.toLowerCase()
    );
    if (role !== 'admin' && (isSelfEmp || isOtherMgrEmp || isDiffDeptEmp)) {
      showToast(
        isSelfEmp
          ? 'Không ai được tự sửa dữ liệu sinh trắc học của chính mình. Vui lòng liên hệ Admin!'
          : isDiffDeptEmp
          ? 'Quản lý chỉ có quyền sửa sinh trắc học của nhân viên trong phòng ban của mình!'
          : 'Quản lý không có quyền sửa sinh trắc học của Quản lý khác!',
        'error'
      );
      return;
    }
    setSelectedEmpId(emp.employee_id);
    setSearchParams({ employee_id: emp.employee_id });
    setActiveTab('FINGERPRINT');
    setManageModalEmployee(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentUser, isManager, managerDept, role, setSearchParams, showToast]);

  return {
    scopedEmployees,
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
