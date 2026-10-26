import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useDepartmentPositions } from '@/features/employees';
import { ScanFace, Fingerprint, AlertTriangle } from 'lucide-react';
import {
  BiometricsHeader,
  EmployeeBiometricsCard,
  FaceEnrollmentSection,
  FingerprintEnrollmentSection,
  BiometricsEmployeeTable,
  ManageBiometricsModal,
  FaceConfirmModal,
  FaceResultModal,
  FingerprintConfirmModal,
  CameraEkycModal,
  useBiometricEnrollment,
} from '@/features/biometrics';

export const ManagerBiometrics: React.FC = () => {
  const { employees } = useApp();
  const { currentUser, role } = useAuth();
  const [, setSearchParams] = useSearchParams();

  const isManager = role === 'manager';
  const managerDept = currentUser?.department;

  // 1. Biometric enrollment state & handlers encapsulated in custom hook
  const {
    scopedEmployees,
    selectedEmpId,
    setSelectedEmpId,
    activeTab,
    setActiveTab,
    currentEmp,
    isSelf,
    isEnrollmentBlocked,

    uploadedPhotos,
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

    selectedDevice,
    setSelectedDevice,
    selectedFinger,
    setSelectedFinger,
    fingerprintStep,
    fingerQualityScore,
    fingerConfirmModal,
    setFingerConfirmModal,
    handleSendIoTTrigger,
    handleConfirmFingerprintSave,

    setManageModalEmployee,
    currentManageEmp,
    handleDeleteFaceId,
    handleDeleteFingerprint,
    handleStartEditFace,
    handleStartCameraEkycFromModal,
    handleStartEditFingerprint,
  } = useBiometricEnrollment();

  const isDiffDept = Boolean(
    isManager && managerDept && currentEmp && currentEmp.department?.toLowerCase() !== managerDept.toLowerCase()
  );

  // 2. Department & Position filtering via reusable hook
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState(() => {
    if (role === 'manager' && currentUser?.department) {
      return currentUser.department;
    }
    return 'ALL';
  });
  const [positionFilter, setPositionFilter] = useState<string>('ALL');

  useEffect(() => {
    if (isManager && managerDept) {
      setDepartmentFilter(managerDept);
    }
  }, [isManager, managerDept]);

  const { departmentOptions, positionOptions } = useDepartmentPositions({
    employees,
    isManager,
    managerDept,
    departmentFilter,
  });

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (isManager && managerDept && emp.department?.toLowerCase() !== managerDept.toLowerCase()) {
        return false;
      }
      const q = searchTerm.toLowerCase().trim();
      const matchSearch =
        !q ||
        emp.full_name.toLowerCase().includes(q) ||
        emp.employee_id.toLowerCase().includes(q) ||
        (emp.position && emp.position.toLowerCase().includes(q)) ||
        (emp.department && emp.department.toLowerCase().includes(q)) ||
        (emp.email && emp.email.toLowerCase().includes(q)) ||
        (emp.phone && emp.phone.includes(q));

      const matchDept =
        departmentFilter === 'ALL' ||
        emp.department?.toLowerCase() === departmentFilter.toLowerCase();

      const matchPosition =
        positionFilter === 'ALL' ||
        emp.position?.toLowerCase() === positionFilter.toLowerCase();

      return matchSearch && matchDept && matchPosition;
    });
  }, [employees, isManager, managerDept, searchTerm, departmentFilter, positionFilter]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <BiometricsHeader />

      {/* Main Enrollment Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Choose Employee & Current Profile (Vùng khoanh đỏ: Chỉ hiện nhân viên trong phòng, trừ bản thân) */}
        <div className="lg:col-span-4 space-y-4">
          <EmployeeBiometricsCard
            employees={scopedEmployees}
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

            {/* Chốt chặn Requirement 2 */}
            {isEnrollmentBlocked && currentEmp && (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 flex items-start gap-3 text-amber-800 dark:text-amber-200 text-xs">
                <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">Chốt chặn an toàn (Nguyên tắc Bất kiêm nhiệm - Phê duyệt độc lập):</p>
                  <p>
                    {isSelf
                      ? 'Bạn không thể tự tải ảnh, chụp eKYC hoặc đăng ký dữ liệu nhận diện của chính mình để tránh gian lận thời gian làm việc. Thay đổi này chỉ có Admin mới có quyền thực hiện.'
                      : isDiffDept
                      ? 'Quản lý chỉ có quyền xem và cập nhật dữ liệu nhận diện của nhân viên trong phòng ban của mình.'
                      : 'Quản lý không được phép sửa đổi hoặc đăng ký dữ liệu nhận diện của Quản lý khác.'}
                  </p>
                </div>
              </div>
            )}

            {!currentEmp ? (
              <div className="py-12 text-center text-slate-500 dark:text-slate-400 text-xs">
                Phòng ban hiện chưa có nhân sự nào khác để cập nhật dữ liệu sinh trắc học.
              </div>
            ) : (
              <>
                {/* TAB 1: Face ID Multi-Photo Upload & Camera eKYC */}
                {activeTab === 'FACE' && (
                  <FaceEnrollmentSection
                    uploadedPhotos={uploadedPhotos}
                    analyzingFace={analyzingFace}
                    disabled={isEnrollmentBlocked}
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
                    disabled={isEnrollmentBlocked}
                    onSendIoTTrigger={handleSendIoTTrigger}
                    onOpenConfirmModal={() => setFingerConfirmModal(true)}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Master Employee Biometric Status Table */}
      <BiometricsEmployeeTable
        employees={employees}
        filteredEmployees={filteredEmployees}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        departmentFilter={departmentFilter}
        onDepartmentFilterChange={(val) => {
          setDepartmentFilter(val);
          setPositionFilter('ALL');
        }}
        departmentOptions={departmentOptions}
        positionFilter={positionFilter}
        onPositionFilterChange={setPositionFilter}
        positionOptions={positionOptions}
        onOpenManageModal={(emp) => setManageModalEmployee(emp)}
      />

      {/* Camera eKYC Multi-Photo Modal (Min 3, Max 10) */}
      <CameraEkycModal
        isOpen={isEkycModalOpen}
        onClose={() => setIsEkycModalOpen(false)}
        onComplete={handleEkycComplete}
        employeeName={currentEmp?.full_name || ''}
        employeeCode={currentEmp?.employee_id || ''}
        existingPhotoCount={uploadedPhotos.length}
        maxPhotos={10}
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
