import { useFingerprintEnrollment } from './useFingerprintEnrollment';
import { apiFetch } from '../../../api/client';
import { useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import { useAuth, getActiveSessionId } from '../../../context/AuthContext';
import { isAnotherManager } from '../../../utils/permissionUtils';
import { logger } from '../../../utils/logger';
import { enrollFaceJobApi, deleteEmployeeBiometricsApi, EnrollFaceResult } from '../api/biometricApi';
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
  const queryClient = useQueryClient();
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
    ''
  );
  const [selectedFinger, setSelectedFinger] = useState<string>('Ngón trỏ phải (Right Index)');
  const [fingerConfirmModal, setFingerConfirmModal] = useState<boolean>(false);

  // Biometrics Management Popup Modal state for a specific employee
  const [manageModalEmployee, setManageModalEmployee] = useState<Employee | null>(null);

  // Reset photos & biometric state whenever selected employee changes
  useEffect(() => {
    setUploadedPhotos([]);
    setAnalyzingFace(false);
  }, [selectedEmpId]);

  const currentEmp = useMemo(() => {
    if (scopedEmployees.length === 0) return undefined;
    return (
      scopedEmployees.find((e) => e.employee_id === selectedEmpId || e.id === selectedEmpId) ||
      scopedEmployees[0]
    );
  }, [scopedEmployees, selectedEmpId]);

  const selectedEmployeeRef = useRef(currentEmp?.employee_id);
  selectedEmployeeRef.current = currentEmp?.employee_id;

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

  const fingerprint = useFingerprintEnrollment(currentEmp?.id || currentEmp?.employee_id, isEnrollmentBlocked, showToast);
  const fingerprintStep = fingerprint.step;
  const fingerQualityScore = fingerprint.session?.match_score ?? null;

  const getBlockedMessage = useCallback((action: string = 'cập nhật') => {
    if (!currentEmp) return 'Vui lòng chọn nhân viên cần thực hiện!';
    if (isSelf) return `Không ai được tự ${action} dữ liệu sinh trắc học của chính mình. Vui lòng liên hệ Admin phê duyệt!`;
    if (isDiffDept) return `Quản lý chỉ có quyền ${action} sinh trắc học của nhân viên trong phòng ban của mình!`;
    if (isOtherMgr) return `Quản lý không có quyền ${action} sinh trắc học của Quản lý khác!`;
    return 'Bạn không có quyền thực hiện thao tác này!';
  }, [currentEmp, isSelf, isDiffDept, isOtherMgr]);

  // Handle Photo Upload (Multiple files allowed)
  const handlePhotoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentEmp) { showToast('Vui lòng chọn nhân viên trước khi thêm ảnh mẫu.', 'error', 'Không thể thêm ảnh mẫu'); return; }
    const employee = currentEmp;
    const requestSession = getActiveSessionId();
    if (isEnrollmentBlocked) {
      showToast(getBlockedMessage('đăng ký'), 'error', "Không thể thêm ảnh mẫu");
      return;
    }
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (uploadedPhotos.length >= MAX_FACE_PHOTOS) {
      showToast(
        `Nhân viên ${employee.full_name} (${employee.employee_id}) đã có tối đa ${MAX_FACE_PHOTOS} ảnh mẫu. Xóa ảnh không dùng trước khi thêm ảnh mới.`,
        'error',
        "Không thể thêm ảnh mẫu");
      e.target.value = '';
      return;
    }

    const remainingSlots = MAX_FACE_PHOTOS - uploadedPhotos.length;
    const fileList = Array.from(files).slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      showToast(
        `Chỉ thêm được ${remainingSlots}/${files.length} ảnh cho ${employee.full_name} (${employee.employee_id}) do giới hạn ${MAX_FACE_PHOTOS} ảnh mẫu.`,
        'error',
        "Không thể thêm ảnh mẫu");
    }

    const newPhotos: FacePhotoItem[] = [];
    let loadedCount = 0;

    fileList.forEach((file, idx) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (selectedEmployeeRef.current !== employee.employee_id || getActiveSessionId() !== requestSession) return;
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
          showToast(`Đã thêm ${fileList.length} ảnh mẫu cho ${employee.full_name} (${employee.employee_id}). Ảnh chưa được lưu thành Face ID; hãy xác nhận lưu sau khi kiểm tra ảnh.`, 'success', 'Thêm ảnh mẫu thành công');
        }
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  }, [currentEmp, isEnrollmentBlocked, getBlockedMessage, showToast, uploadedPhotos.length]);

  const handleRemovePhoto = useCallback((id: string) => {
    setUploadedPhotos((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleEkycComplete = useCallback((samples: CapturedFaceSample[]) => {
    if (!samples?.length) return;
    if (!currentEmp || isEnrollmentBlocked) {
      showToast(getBlockedMessage('thêm ảnh'), 'error', 'Không thể thêm ảnh mẫu');
      return;
    }
    const employeeLabel = `${currentEmp.full_name} (${currentEmp.employee_id})`;
    const remainingSlots = MAX_FACE_PHOTOS - uploadedPhotos.length;
    if (remainingSlots <= 0) {
      showToast(`${employeeLabel} đã có tối đa ${MAX_FACE_PHOTOS} ảnh mẫu. Xóa ảnh không dùng trước khi thêm ảnh mới.`, 'error', 'Không thể thêm ảnh mẫu');
      return;
    }
    const samplesToAdd = samples.slice(0, remainingSlots);
    if (samples.length > remainingSlots) {
      showToast(`Chỉ thêm được ${remainingSlots}/${samples.length} ảnh camera cho ${employeeLabel} do giới hạn ${MAX_FACE_PHOTOS} ảnh mẫu.`, 'info', 'Đã giới hạn số ảnh mẫu');
    }
    const newItems: FacePhotoItem[] = samplesToAdd.map((sample, index) => {
      const overallIndex = uploadedPhotos.length + index;
      let tag = sample.label.replace(/#/g, '').trim();
      if (overallIndex >= 3) tag = tag.startsWith('Ảnh') ? `Ảnh ${overallIndex + 1}` : `${tag} (${overallIndex + 1})`;
      return { id: `ekyc_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 7)}`,
        url: sample.dataUrl, name: `${tag} (Camera eKYC)`, tag };
    });
    // State updaters must stay pure: StrictMode can invoke them more than once.
    setUploadedPhotos(prev => [...prev, ...newItems].slice(0, MAX_FACE_PHOTOS));
    showToast(`Đã thêm ${newItems.length} ảnh chụp camera cho ${employeeLabel}. Hiện có ${uploadedPhotos.length + newItems.length}/${MAX_FACE_PHOTOS} ảnh mẫu; hãy xác nhận lưu để cập nhật Face ID.`, 'success', 'Thêm ảnh mẫu thành công');
  }, [currentEmp, uploadedPhotos, isEnrollmentBlocked, getBlockedMessage, showToast]);

  const handleConfirmFaceSave = useCallback(async () => {
    if (!currentEmp || uploadedPhotos.length < 3) return;
    if (isEnrollmentBlocked) {
      showToast(getBlockedMessage('cập nhật'), 'error', "Không thể lưu Face ID");
      return;
    }
    setAnalyzingFace(true);
    try {
      await enrollFaceJobApi(currentEmp.employee_id, uploadedPhotos.map(photo => photo.url));
      await queryClient.invalidateQueries({ queryKey: ['employees'] });
      await queryClient.invalidateQueries({ queryKey: ['biometrics'] });
      showToast(`Đã lưu mẫu khuôn mặt cho ${currentEmp.full_name} (${currentEmp.employee_id}) từ ${uploadedPhotos.length} ảnh mẫu.`, 'success', 'Lưu Face ID thành công');
      setFaceConfirmModal(false);
      setUploadedPhotos([]);
    } catch (err: any) {
      biometricLogger.error('Error updating face biometrics:', err);
      showToast(
        `${currentEmp.full_name} (${currentEmp.employee_id}): ${err.message || 'Chưa lưu được mẫu khuôn mặt.'} Giữ lại ảnh mẫu và kiểm tra kết quả trước khi gửi lại.`,
        'error',
        "Không thể lưu Face ID");
    } finally {
      setAnalyzingFace(false);
    }
  }, [currentEmp, uploadedPhotos, isEnrollmentBlocked, getBlockedMessage, showToast, updateEmployee, queryClient]);

  const handleSendIoTTrigger = () => fingerprint.start(selectedDevice, selectedFinger);
  const handleConfirmFingerprintSave = async () => {
    if (await fingerprint.confirm()) setFingerConfirmModal(false);
  };

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
        'error',
        "Không thể xóa Face ID");
      return;
    }

    try {
      await deleteEmployeeBiometricsApi(emp.employee_id);
      await queryClient.invalidateQueries({ queryKey: ['employees'] });
      await queryClient.invalidateQueries({ queryKey: ['biometrics'] });
      showToast(
        `Đã xóa dữ liệu Face ID của nhân viên ${emp.full_name} (${emp.employee_id}) thành công!`,
        'success',
        "Xóa Face ID thành công");
    } catch (err: any) {
      biometricLogger.error('Lỗi khi xóa Face ID:', err);
      showToast(
        `Chưa xóa được Face ID của ${emp.full_name} (${emp.employee_id}): ${err?.message || 'Không thể kết nối đến máy chủ'}. Kiểm tra trạng thái Face ID trước khi thử lại.`,
        'error',
        "Không thể xóa Face ID");
    }
  }, [currentUser, isManager, managerDept, role, showToast, updateEmployee]);

  const handleDeleteFingerprint = useCallback(async (emp: Employee) => {
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
        'error',
        "Không thể thu hồi vân tay");
      return;
    }

    try {
      await apiFetch(`/api/biometrics/${emp.id || emp.employee_id}/fingerprint`, { method: 'DELETE' });
      await queryClient.invalidateQueries({ queryKey: ['employees'] });
      await queryClient.invalidateQueries({ queryKey: ['biometrics'] });
      await queryClient.invalidateQueries({ queryKey: ['fingerprint-current'] });
      showToast(`Đã thu hồi vân tay của ${emp.full_name} (${emp.employee_id}). Pi sẽ xóa mẫu trên cảm biến khi kết nối.`, 'success', 'Thu hồi vân tay thành công');
    } catch (err: any) {
      showToast(`Chưa thu hồi được vân tay của ${emp.full_name} (${emp.employee_id}): ${err?.message || 'Lỗi kết nối máy chủ'}. Kiểm tra trạng thái vân tay trước khi thử lại.`, 'error', "Không thể thu hồi vân tay");
    }

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
        'error',
        "Không thể đăng ký Face ID");
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
        'error',
        "Không thể cập nhật nhân viên");
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
        'error',
        "Không thể đăng ký vân tay");
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
    fingerprintDevices: fingerprint.devices,
    fingerprintError: fingerprint.error || fingerprint.devicesError,
    handleCancelFingerprint: fingerprint.cancel,
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
