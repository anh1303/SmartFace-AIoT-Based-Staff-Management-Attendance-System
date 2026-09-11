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
  CheckCheck
} from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { Employee } from '../../types';

export const ManagerBiometrics: React.FC = () => {
  const { employees, updateEmployee, showToast } = useApp();
  
  // Selected employee for enrollment
  const [selectedEmpId, setSelectedEmpId] = useState<string>(employees[0]?.employee_id || 'NV-001');
  const [activeTab, setActiveTab] = useState<'FACE' | 'FINGERPRINT'>('FACE');

  // Face Enrollment State
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [analyzingFace, setAnalyzingFace] = useState<boolean>(false);
  const [faceQualityScore, setFaceQualityScore] = useState<number | null>(null);
  const [faceConfirmModal, setFaceConfirmModal] = useState<boolean>(false);

  // Fingerprint Device Trigger State
  const [selectedDevice, setSelectedDevice] = useState<string>('Terminal FaceCam-01 (Cổng chính - Sảnh A)');
  const [selectedFinger, setSelectedFinger] = useState<string>('Ngón trỏ phải (Right Index)');
  const [fingerprintStep, setFingerprintStep] = useState<'IDLE' | 'SENDING' | 'WAITING_TOUCH' | 'CAPTURED' | 'VERIFIED'>('IDLE');
  const [fingerQualityScore, setFingerQualityScore] = useState<number | null>(null);
  const [fingerConfirmModal, setFingerConfirmModal] = useState<boolean>(false);

  // Device sync modal
  const [syncAllModal, setSyncAllModal] = useState<boolean>(false);
  const [syncingDevices, setSyncingDevices] = useState<boolean>(false);

  const currentEmp = employees.find(e => e.employee_id === selectedEmpId) || employees[0];

  // Handle Photo Upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setUploadedImage(reader.result as string);
        setAnalyzingFace(true);
        // Simulate AI landmark & liveness vector extraction
        setTimeout(() => {
          setAnalyzingFace(false);
          setFaceQualityScore(99.4);
        }, 1400);
      };
      reader.readAsDataURL(file);
    }
  };

  // Confirm Face Update (requires explicit confirm button)
  const handleConfirmFaceSave = () => {
    if (!currentEmp) return;
    updateEmployee(currentEmp.employee_id, {
      face_enrolled: true,
      avatar: uploadedImage || currentEmp.avatar
    });
    setFaceConfirmModal(false);
    showToast(`Đã cập nhật vector khuôn mặt 512-D cho nhân viên ${currentEmp.full_name} (${currentEmp.employee_id})!`, 'success');
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
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-mono font-medium border border-blue-500/20">
              AIoT EDGE ENROLLMENT
            </span>
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

      {/* 4 Bento Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition-colors">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Đã đăng ký Face ID</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-blue-400">
              {faceEnrolledCount}/{totalEmployees}
            </span>
            <span className="text-xs font-mono text-slate-500">
              ({Math.round((faceEnrolledCount / totalEmployees) * 100)}%)
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Trích xuất Landmark 512 điểm</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition-colors">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Đã đăng ký Vân tay</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-green-400">
              {fingerEnrolledCount}/{totalEmployees}
            </span>
            <span className="text-xs font-mono text-slate-500">
              ({Math.round((fingerEnrolledCount / totalEmployees) * 100)}%)
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Chuẩn cảm biến FAP30 500 DPI</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition-colors">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Trạng thái Edge Devices</span>
          <div className="mt-2 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xl font-bold font-mono text-white">12/12 Online</span>
          </div>
          <p className="text-[11px] text-green-500 mt-1 font-mono">Độ trễ trung bình: 24ms</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition-colors">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Tiêu chuẩn mã hóa</span>
          <div className="mt-2 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            <span className="text-xl font-bold font-mono text-white">AES-256</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Hardware Security Module</p>
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
                  setUploadedImage(null);
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
                    <span className={`font-mono text-[11px] px-2 py-0.5 rounded-md font-semibold ${
                      currentEmp.face_enrolled 
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
                    <span className={`font-mono text-[11px] px-2 py-0.5 rounded-md font-semibold ${
                      currentEmp.fingerprint_enrolled 
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
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                    activeTab === 'FACE'
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
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                    activeTab === 'FINGERPRINT'
                      ? 'bg-green-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Fingerprint className="w-4 h-4" />
                  <span>Ghi nhận Vân tay (Gửi tín hiệu IoT)</span>
                </button>
              </div>

              <span className="hidden sm:inline-block text-xs font-mono text-slate-500">
                Thao tác yêu cầu xác nhận lưu (Confirm)
              </span>
            </div>

            {/* TAB 1: Face ID Upload & Landmark extraction */}
            {activeTab === 'FACE' && (
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6 items-start">
                  {/* Upload Dropzone */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-2">
                      Ảnh chân dung chính diện (Face Image):
                    </label>
                    <div className="relative border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-slate-950">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <Upload className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-white">Kéo thả ảnh hoặc bấm để chọn tệp</p>
                      <p className="text-[11px] text-slate-500 mt-1">Định dạng JPG, PNG • Độ phân giải khuyến nghị &gt; 720p</p>
                    </div>

                    <div className="mt-4 p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                      <p className="font-semibold text-slate-300">Yêu cầu chất lượng ảnh:</p>
                      <p>• Nhìn thẳng camera, không đeo kính râm hoặc khẩu trang.</p>
                      <p>• Ánh sáng đồng đều, rõ nét các góc cạnh khuôn mặt.</p>
                    </div>
                  </div>

                  {/* AI Scan HUD Preview */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-2">
                      Mô phỏng Trích xuất Vector AI (512-D Landmark):
                    </label>
                    <div className="relative aspect-square max-w-[260px] mx-auto rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center shadow-lg">
                      {uploadedImage ? (
                        <>
                          <img
                            src={uploadedImage}
                            alt="Uploaded preview"
                            className="w-full h-full object-cover"
                          />
                          {analyzingFace && (
                            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-center p-4">
                              <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mb-2" />
                              <p className="text-xs text-white font-semibold">Đang phân tích 512 điểm Landmark...</p>
                            </div>
                          )}
                          {!analyzingFace && (
                            <div className="absolute inset-3 border-2 border-dashed border-blue-400/80 rounded-2xl pointer-events-none flex flex-col justify-between p-2">
                              <div className="flex justify-between text-[9px] font-mono text-blue-400">
                                <span>[LANDMARK: OK]</span>
                                <span className="text-green-400">LIVENESS 99.4%</span>
                              </div>
                              <div className="text-center font-mono text-[10px] text-green-400 bg-slate-950/80 border border-slate-800 py-0.5 rounded">
                                Vector 512-D Hợp lệ
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-center p-6 text-slate-500">
                          <Camera className="w-10 h-10 mx-auto mb-2 opacity-50" />
                          <p className="text-xs">Chưa có ảnh tải lên</p>
                        </div>
                      )}
                    </div>

                    {faceQualityScore && (
                      <div className="mt-4 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-xs flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-medium">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          Mẫu khuôn mặt đạt chuẩn chất lượng
                        </span>
                        <span className="font-mono font-bold">{faceQualityScore}%</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Explicit Confirm Button */}
                <div className="pt-4 border-t border-slate-800 flex justify-end">
                  <button
                    type="button"
                    disabled={!uploadedImage || analyzingFace}
                    onClick={() => setFaceConfirmModal(true)}
                    className={`px-6 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all ${
                      uploadedImage && !analyzingFace
                        ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md'
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
                        <option value="Terminal FaceCam-01 (Cổng chính - Sảnh A)">
                          Terminal FaceCam-01 (Cổng chính - Sảnh A)
                        </option>
                        <option value="Terminal FaceCam-02 (Cửa khu Kỹ thuật)">
                          Terminal FaceCam-02 (Cửa khu Kỹ thuật)
                        </option>
                        <option value="Máy quét USB FAP30 (Quầy Nhân sự HR)">
                          Máy quét USB FAP30 (Quầy Nhân sự HR)
                        </option>
                        <option value="Terminal Barie Khu Sản xuất">
                          Terminal Barie Khu Sản xuất
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
                        <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center border-2 transition-all ${
                          fingerprintStep === 'IDLE'
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
                    className={`px-6 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all ${
                      fingerprintStep === 'VERIFIED'
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
                <th className="py-3.5 px-4 font-medium">Phòng ban</th>
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
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono ${
                      emp.face_enrolled 
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      {emp.face_enrolled ? 'ĐÃ ĐĂNG KÝ' : 'CHƯA ĐĂNG KÝ'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono ${
                      emp.fingerprint_enrolled 
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
            <p className="font-semibold text-white">Bạn có chắc chắn muốn cập nhật mẫu khuôn mặt này?</p>
            <p className="text-slate-400 leading-relaxed">
              Dữ liệu vector 512-D trích xuất từ ảnh mới sẽ được mã hóa chuẩn AES-256 và tự động đẩy tới bộ nhớ đệm của 12 Edge Cameras tại các cổng ra vào.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setFaceConfirmModal(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleConfirmFaceSave}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md"
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
