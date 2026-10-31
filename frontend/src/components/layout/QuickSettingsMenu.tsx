import React, { useState, useRef, useEffect } from 'react';
import {
  Wifi,
  WifiHigh,
  WifiLow,
  WifiZero,
  WifiOff,
  Volume2,
  Volume1,
  VolumeX,
  Headphones,
  Bluetooth,
  Video,
  VideoOff,
  Gauge,
  SlidersHorizontal,
  RefreshCw,
  Play,
  CheckCircle2,
  AlertCircle,
  Unlink,
  Search,
  X,
  Filter,
  Users
} from 'lucide-react';
import { useDeviceSettings, BluetoothDevice } from '../../features/attendances/hooks/useDeviceSettings';

// Icon sóng Wi-Fi động theo cường độ tín hiệu (%)
const renderWifiSignalIcon = (signal: number, className = 'w-4 h-4 shrink-0') => {
  if (signal >= 75) {
    return <Wifi className={`${className} text-emerald-500`} />;
  }
  if (signal >= 50) {
    return <WifiHigh className={`${className} text-emerald-500 dark:text-emerald-400`} />;
  }
  if (signal >= 25) {
    return <WifiLow className={`${className} text-amber-500`} />;
  }
  return <WifiZero className={`${className} text-rose-500`} />;
};

interface QuickSettingsMenuProps {
  deviceId?: string;
}

export const QuickSettingsMenu: React.FC<QuickSettingsMenuProps> = ({
  deviceId = 'PI4_FRONT_GATE',
}) => {
  const {
    canManage,
    settings,
    isLoading,
    isUpdating,
    setVolume,
    toggleMute,
    toggleFps,
    toggleStream,
    setMaxFaces,
    testAudio,
    reconnectBluetooth,
    connectBluetooth,
    disconnectBluetooth,
    scanBluetooth,
  } = useDeviceSettings(deviceId);

  const [isOpen, setIsOpen] = useState(false);
  const [isTestingSound, setIsTestingSound] = useState(false);
  const [isReconnectingBt, setIsReconnectingBt] = useState(false);
  const [isDisconnectingBt, setIsDisconnectingBt] = useState(false);
  const [reconnectToast, setReconnectToast] = useState<string | null>(null);

  // Trạng thái chọn đổi thiết bị Loa Bluetooth & Bộ lọc
  const [isBtPickerOpen, setIsBtPickerOpen] = useState(false);
  const [scannedBtDevices, setScannedBtDevices] = useState<BluetoothDevice[]>([]);
  const [isScanningBt, setIsScanningBt] = useState(false);
  const [connectingBtAddr, setConnectingBtAddr] = useState<string | null>(null);
  const [btSearchText, setBtSearchText] = useState('');
  const [btFilterCategory, setBtFilterCategory] = useState<'all' | 'audio' | 'paired'>('all');

  // Nhận diện thiết bị âm thanh
  const isAudioDevice = (name: string) => {
    const n = (name || '').toLowerCase();
    const audioKeywords = [
      'audio', 'speaker', 'headset', 'headphone', 'airpod', 'earbud',
      'tws', 'sound', 'hoco', 'jbl', 'sony', 'marshall', 'havit', 'x7',
      'loa', 'mic', 'b3.0', 'pro', 'buds', 'wireless'
    ];
    if (audioKeywords.some((kw) => n.includes(kw))) return true;
    if (/^u-acg[0-9a-f]{4}$/i.test(n) || n.startsWith('[tv]') || n.startsWith('ble_')) {
      return false;
    }
    return false;
  };

  // Ngắt kết nối thiết bị Bluetooth
  const handleDisconnectBluetooth = async (deviceAddr?: string) => {
    setIsDisconnectingBt(true);
    setReconnectToast(null);
    const success = await disconnectBluetooth(deviceAddr);
    setIsDisconnectingBt(false);
    if (success) {
      setReconnectToast('Đã ngắt kết nối loa Bluetooth.');
    } else {
      setReconnectToast('Không thể ngắt kết nối thiết bị.');
    }
    setTimeout(() => {
      setReconnectToast(null);
    }, 3000);
  };

  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // 1. Click-outside listener & ESC key để đóng popup mượt mà
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isOpen &&
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Không hiển thị nút nếu người dùng không phải Quản lý hoặc Quản trị viên
  if (!canManage) {
    return null;
  }

  // Xử lý nút Test âm thanh
  const handleTestAudio = async () => {
    setIsTestingSound(true);
    await testAudio();
    setTimeout(() => {
      setIsTestingSound(false);
    }, 800);
  };

  // Xử lý kết nối lại Bluetooth
  const handleReconnectBluetooth = async () => {
    setIsReconnectingBt(true);
    setReconnectToast(null);
    const success = await reconnectBluetooth();
    setIsReconnectingBt(false);
    if (success) {
      setReconnectToast('Đã kết nối lại loa Bluetooth thành công!');
    } else {
      setReconnectToast('Không thể tìm thấy loa. Vui lòng bật nguồn loa.');
    }
    setTimeout(() => {
      setReconnectToast(null);
    }, 3000);
  };

  // Mở/đóng panel chọn loa Bluetooth
  const handleToggleBtPicker = async () => {
    const next = !isBtPickerOpen;
    setIsBtPickerOpen(next);
    if (next && (!Array.isArray(scannedBtDevices) || scannedBtDevices.length === 0)) {
      await handleScanBluetooth();
    }
  };

  // Quét danh sách loa Bluetooth
  const handleScanBluetooth = async () => {
    setIsScanningBt(true);
    try {
      const devices = await scanBluetooth();
      setScannedBtDevices(Array.isArray(devices) ? devices : []);
    } catch {
      setScannedBtDevices([]);
    } finally {
      setIsScanningBt(false);
    }
  };

  // Đổi kết nối sang loa Bluetooth khác
  const handleSelectBtDevice = async (device: BluetoothDevice) => {
    setConnectingBtAddr(device.address);
    setReconnectToast(null);
    const success = await connectBluetooth(device);
    setConnectingBtAddr(null);
    if (success) {
      setReconnectToast(`Đã chuyển loa thành công sang: ${device.name}`);
      setIsBtPickerOpen(false);
    } else {
      setReconnectToast(`Không thể kết nối tới ${device.name}.`);
    }
    setTimeout(() => {
      setReconnectToast(null);
    }, 3500);
  };

  // Icon âm lượng động
  const renderVolumeIcon = (className = 'w-4 h-4') => {
    if (settings.isMuted || settings.volume === 0) {
      return <VolumeX className={`${className} text-rose-500`} />;
    }
    if (settings.volume < 45) {
      return <Volume1 className={`${className} text-purple-600 dark:text-purple-400`} />;
    }
    return <Volume2 className={`${className} text-purple-600 dark:text-purple-400`} />;
  };

  return (
    <div className="relative">
      {/* Nút bấm Topbar dạng Pill phong cách Ubuntu GNOME */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="Trung tâm điều khiển Kiosk (Quick Settings)"
        className={`relative flex items-center gap-2.5 px-3 py-1.5 rounded-xl border transition-all duration-200 cursor-pointer shadow-xs select-none ${
          isOpen
            ? 'bg-purple-100 dark:bg-purple-950/60 border-purple-400 dark:border-purple-600 text-purple-900 dark:text-purple-200 ring-2 ring-purple-500/20'
            : 'bg-slate-100 hover:bg-slate-200/90 border-slate-200 text-slate-700 dark:bg-[#181c38] dark:hover:bg-[#20254b] dark:border-[#272d5a] dark:text-purple-300'
        }`}
      >
        {/* Biểu tượng Wi-Fi động theo mức sóng & trạng thái Online của Pi */}
        {settings.online && settings.wifi.connected ? (
          renderWifiSignalIcon(settings.wifi.signalStrength, 'w-3.5 h-3.5')
        ) : (
          <WifiOff className="w-3.5 h-3.5 text-rose-500" />
        )}

        {/* Biểu tượng Âm lượng hoặc nhãn Offline */}
        {settings.online ? (
          <span className="flex items-center gap-1 text-xs font-semibold">
            {renderVolumeIcon('w-3.5 h-3.5')}
            <span className="font-mono text-[11px] hidden sm:inline">
              {settings.isMuted ? 'Mute' : `${settings.volume}%`}
            </span>
          </span>
        ) : (
          <span className="font-mono text-[11px] font-bold text-rose-500 hidden sm:inline">
            Offline
          </span>
        )}

        {/* Biểu tượng Cài đặt bánh răng */}
        <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
      </button>

      {/* Popover Menu neo ngay dưới nút Topbar */}
      {isOpen && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full mt-2 w-84 sm:w-96 z-50 bg-white/95 dark:bg-[#12162e]/95 backdrop-blur-md border border-slate-200/90 dark:border-[#282f63] rounded-2xl shadow-2xl p-4.5 space-y-4 animate-in fade-in zoom-in-95 duration-150 origin-top-right text-slate-800 dark:text-slate-100"
        >
          {/* Header Popover */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#1e244d]">
            <div>
              <div className="flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  Trung Tâm Điều Khiển Kiosk
                </h4>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                {settings.online
                  ? `${deviceId}${settings.wifi.ip ? ` • ${settings.wifi.ip}` : ''}`
                  : 'Chưa phát hiện thiết bị Pi hoạt động'}
              </p>
            </div>
            {settings.online ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Online
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                Offline
              </span>
            )}
          </div>

          {/* KHỐI 1: KẾT NỐI KHÔNG DÂY (Wi-Fi & Bluetooth Audio) */}
          <div className="space-y-2">
            {/* Thẻ Wi-Fi (Trạng thái mạng Kiosk) */}
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#181c3b] border border-slate-200/80 dark:border-[#252b54] flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`p-2 rounded-lg ${
                    settings.online && settings.wifi.connected && settings.wifi.ssid
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                  }`}
                >
                  {renderWifiSignalIcon(
                    settings.online && settings.wifi.connected && settings.wifi.ssid ? settings.wifi.signalStrength : 0,
                    'w-4 h-4'
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                    {!settings.online
                      ? 'Chưa kết nối Wi-Fi (Pi đang tắt)'
                      : settings.wifi.connected && settings.wifi.ssid
                      ? settings.wifi.ssid
                      : 'Chưa kết nối Wi-Fi'}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    {!settings.online
                      ? 'Hãy chạy python edge_client.py trên Raspberry Pi'
                      : settings.wifi.connected && settings.wifi.ssid
                      ? `Đã kết nối • Tín hiệu ${settings.wifi.signalStrength}%`
                      : 'Chưa có tín hiệu mạng'}
                  </div>
                </div>
              </div>
              {settings.online && settings.wifi.connected && settings.wifi.ip ? (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-200/60 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border border-slate-300/40 dark:border-slate-700/50 shrink-0">
                  {settings.wifi.ip}
                </span>
              ) : null}
            </div>

            {/* Thẻ Bluetooth Loa Thông Báo */}
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#181c3b] border border-slate-200/80 dark:border-[#252b54] space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`p-2 rounded-lg ${
                      settings.bluetooth.connected && settings.bluetooth.deviceName
                        ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                    }`}
                  >
                    <Headphones className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                      {settings.bluetooth.connected && settings.bluetooth.deviceName
                        ? settings.bluetooth.deviceName
                        : 'Chưa kết nối loa Bluetooth'}
                    </div>
                    <div className="text-[10px]">
                      {settings.bluetooth.connected && settings.bluetooth.deviceName ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          🟢 Đã kết nối • Sẵn sàng
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium">
                          ⚪ Chưa kết nối
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {settings.bluetooth.connected && settings.bluetooth.status === 'disconnected' && (
                    <button
                      type="button"
                      onClick={handleReconnectBluetooth}
                      disabled={isReconnectingBt}
                      title="Thử kết nối lại loa cũ"
                      className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 transition-colors cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${isReconnectingBt ? 'animate-spin' : ''}`} />
                      <span>{isReconnectingBt ? 'Đang thử...' : 'Nối lại'}</span>
                    </button>
                  )}

                  {settings.bluetooth.connected && (
                    <button
                      type="button"
                      onClick={() => handleDisconnectBluetooth()}
                      disabled={isDisconnectingBt || isUpdating}
                      title="Ngắt kết nối loa Bluetooth hiện tại"
                      className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40 transition-colors cursor-pointer"
                    >
                      <Unlink className="w-3 h-3" />
                      <span>{isDisconnectingBt ? 'Đang ngắt...' : 'Ngắt kết nối'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleToggleBtPicker}
                    className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors cursor-pointer border ${
                      isBtPickerOpen
                        ? 'bg-purple-600 text-white border-purple-600 dark:bg-purple-500'
                        : 'bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/40'
                    }`}
                  >
                    <Bluetooth className="w-3 h-3" />
                    <span>{isBtPickerOpen ? 'Đóng' : settings.bluetooth.connected && settings.bluetooth.deviceName ? 'Đổi loa' : 'Tìm loa'}</span>
                  </button>
                </div>
              </div>

              {/* Ngăn kéo chọn loa Bluetooth khả dụng */}
              {isBtPickerOpen && (
                <div className="pt-2 border-t border-slate-200/70 dark:border-[#222850] space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="font-semibold uppercase tracking-wider text-[10px]">
                      Danh sách thiết bị Bluetooth ({scannedBtDevices.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleScanBluetooth}
                      disabled={isScanningBt}
                      className="flex items-center gap-1 text-[10px] text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                    >
                      <RefreshCw className={`w-2.5 h-2.5 ${isScanningBt ? 'animate-spin' : ''}`} />
                      <span>{isScanningBt ? 'Đang quét...' : 'Quét lại'}</span>
                    </button>
                  </div>

                  {/* Bộ lọc và Tìm kiếm thiết bị Bluetooth */}
                  <div className="space-y-1.5">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={btSearchText}
                        onChange={(e) => setBtSearchText(e.target.value)}
                        placeholder="Lọc theo tên hoặc MAC..."
                        className="w-full pl-8 pr-7 py-1 text-[11px] rounded-lg bg-white dark:bg-[#12162e] border border-slate-200 dark:border-[#252b54] text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-purple-500"
                      />
                      {btSearchText && (
                        <button
                          type="button"
                          onClick={() => setBtSearchText('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Filter Category Pills */}
                    <div className="flex items-center gap-1 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setBtFilterCategory('all')}
                        className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                          btFilterCategory === 'all'
                            ? 'bg-purple-600 text-white shadow-2xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        Tất cả ({scannedBtDevices.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setBtFilterCategory('audio')}
                        className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                          btFilterCategory === 'audio'
                            ? 'bg-purple-600 text-white shadow-2xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        Loa & Tai nghe ({scannedBtDevices.filter((d) => isAudioDevice(d.name)).length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setBtFilterCategory('paired')}
                        className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                          btFilterCategory === 'paired'
                            ? 'bg-purple-600 text-white shadow-2xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        Đã ghép đôi ({scannedBtDevices.filter((d) => Boolean(d.paired)).length})
                      </button>
                    </div>
                  </div>

                  {/* Danh sách thiết bị */}
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {isScanningBt && (!Array.isArray(scannedBtDevices) || scannedBtDevices.length === 0) ? (
                      <div className="text-center py-3 text-xs text-slate-400 flex items-center justify-center gap-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-500" />
                        <span>Đang tìm loa Bluetooth xung quanh...</span>
                      </div>
                    ) : !Array.isArray(scannedBtDevices) || scannedBtDevices.length === 0 ? (
                      <div className="text-center py-2.5 text-xs text-slate-400">
                        Chưa tìm thấy loa nào. Bật nguồn loa và bấm Quét lại.
                      </div>
                    ) : (
                      scannedBtDevices
                        .filter((dev) => {
                          if (btSearchText.trim()) {
                            const q = btSearchText.toLowerCase().trim();
                            const matchName = dev.name.toLowerCase().includes(q);
                            const matchAddr = dev.address.toLowerCase().includes(q);
                            if (!matchName && !matchAddr) return false;
                          }
                          if (btFilterCategory === 'audio') {
                            return isAudioDevice(dev.name);
                          }
                          if (btFilterCategory === 'paired') {
                            return Boolean(dev.paired);
                          }
                          return true;
                        })
                        .map((dev) => {
                          const isCurrent =
                            Boolean(settings.bluetooth.connected &&
                            settings.bluetooth.deviceName &&
                            (settings.bluetooth.deviceName.toLowerCase().includes(dev.name.toLowerCase()) ||
                              dev.name.toLowerCase().includes(settings.bluetooth.deviceName.toLowerCase())));
                          const isConnecting = connectingBtAddr === dev.address;
                          const isAudio = isAudioDevice(dev.name);

                          return (
                            <div
                              key={dev.address}
                              className={`flex items-center justify-between p-2 rounded-lg border text-xs transition-colors ${
                                isCurrent
                                  ? 'bg-purple-50/80 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800/60'
                                  : 'bg-white dark:bg-[#12162e] border-slate-200 dark:border-[#222850] hover:bg-slate-100/70 dark:hover:bg-[#1a1f42]'
                              }`}
                            >
                              <div className="min-w-0 pr-2">
                                <div className="font-semibold text-slate-800 dark:text-slate-200 truncate flex items-center gap-1.5">
                                  {isAudio ? (
                                    <Headphones className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                                  ) : (
                                    <Bluetooth className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  )}
                                  <span className="truncate">{dev.name}</span>
                                  <span
                                    className={`text-[9px] px-1.5 py-0.2 rounded font-normal shrink-0 ${
                                      isAudio
                                        ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                    }`}
                                  >
                                    {isAudio ? 'Loa/Tai nghe' : 'Thiết bị BLE'}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono pl-5 truncate">
                                  {dev.address} {dev.paired ? '• Đã lưu' : ''}
                                </div>
                              </div>

                              {isCurrent ? (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/40 shrink-0">
                                    Đang dùng
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleDisconnectBluetooth(dev.address)}
                                    disabled={isDisconnectingBt || isUpdating}
                                    title="Ngắt kết nối thiết bị này"
                                    className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                                  >
                                    {isDisconnectingBt ? '...' : 'Ngắt'}
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleSelectBtDevice(dev)}
                                  disabled={isConnecting || isUpdating}
                                  className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-purple-600 hover:bg-purple-700 text-white transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                                >
                                  {isConnecting ? 'Đang nối...' : 'Kết nối'}
                                </button>
                              )}
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Toast phản hồi kết nối lại Bluetooth */}
            {reconnectToast && (
              <div className="text-[11px] p-2 rounded-lg bg-slate-100 dark:bg-[#1c224a] text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/40 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{reconnectToast}</span>
              </div>
            )}
          </div>

          {/* KHỐI 2: ĐIỀU KHIỂN ÂM LƯỢNG LOA BLUETOOTH */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#181c3b] border border-slate-200/80 dark:border-[#252b54] space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-600 dark:text-slate-300">Âm Lượng Loa Bluetooth</span>
              <span className="font-mono text-purple-700 dark:text-purple-400 font-bold">
                {settings.isMuted ? 'MUTE (0%)' : `${settings.volume}%`}
              </span>
            </div>

            {/* Slider track kiểu Ubuntu GNOME với thanh ngang và núm tròn nổi bật */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleMute}
                title={settings.isMuted ? 'Bật âm thanh' : 'Tắt tiếng (Mute)'}
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-[#252c5c] text-slate-600 dark:text-slate-300 cursor-pointer transition-colors shrink-0"
              >
                {renderVolumeIcon('w-4 h-4')}
              </button>

              <div className="relative flex-1 flex items-center">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.isMuted ? 0 : settings.volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  disabled={!settings.bluetooth.connected}
                  style={{
                    background: `linear-gradient(to right, #a855f7 ${settings.isMuted ? 0 : settings.volume}%, rgba(148, 163, 184, 0.28) ${settings.isMuted ? 0 : settings.volume}%)`,
                  }}
                  className={`w-full sf-slider appearance-none cursor-pointer transition-all ${
                    !settings.bluetooth.connected ? 'opacity-40 cursor-not-allowed' : ''
                  }`}
                />
              </div>

              <Volume2 className="w-4 h-4 text-slate-400 shrink-0" />
            </div>

            {/* Thông báo nếu loa Bluetooth ngắt kết nối */}
            {!settings.bluetooth.connected && (
              <div className="flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>Loa ngắt kết nối. Âm thanh check-in tạm phát qua Jack 3.5mm.</span>
              </div>
            )}

            {/* Nút Test âm thanh */}
            <button
              type="button"
              onClick={handleTestAudio}
              disabled={isTestingSound}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-[#20254c] hover:bg-slate-100 dark:hover:bg-[#282f61] text-purple-700 dark:text-purple-300 border border-slate-200 dark:border-[#30386e] transition-all cursor-pointer shadow-2xs"
            >
              <Play className={`w-3.5 h-3.5 ${isTestingSound ? 'animate-bounce text-emerald-500' : ''}`} />
              <span>{isTestingSound ? 'Đang phát chuông...' : 'Phát thử âm thanh check-in'}</span>
            </button>
          </div>

          {/* KHỐI 3: THIẾT LẬP THIẾT BỊ & HIỂN THỊ (Camera Stream & FPS LCD) */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block px-0.5">
              Thiết bị & Màn hình Kiosk
            </span>

            <div className="grid grid-cols-2 gap-2">
              {/* Toggle Camera Stream */}
              <button
                type="button"
                onClick={toggleStream}
                disabled={!settings.online || isUpdating}
                className={`p-2.5 rounded-xl border flex flex-col gap-1.5 text-left transition-all duration-150 ${
                  !settings.online
                    ? 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 opacity-50 cursor-not-allowed'
                    : settings.streamEnabled
                    ? 'bg-purple-50/80 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800/60 text-purple-950 dark:text-purple-100 cursor-pointer'
                    : 'bg-slate-50 dark:bg-[#181c3b] border-slate-200 dark:border-[#252b54] text-slate-500 dark:text-slate-400 opacity-80 cursor-pointer'
                }`}
              >
                <div className="flex items-center justify-between">
                  {settings.online && settings.streamEnabled ? (
                    <Video className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  ) : (
                    <VideoOff className="w-4 h-4 text-slate-400" />
                  )}
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                      !settings.online
                        ? 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                        : settings.streamEnabled
                        ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {!settings.online ? 'OFFLINE' : settings.streamEnabled ? 'ĐANG BẬT' : 'ĐÃ TẮT'}
                  </span>
                </div>
                <span className="text-xs font-semibold">Camera Kiosk</span>
              </button>

              {/* Toggle Hiển thị FPS trên màn LCD */}
              <button
                type="button"
                onClick={toggleFps}
                disabled={!settings.online || isUpdating}
                className={`p-2.5 rounded-xl border flex flex-col gap-1.5 text-left transition-all duration-150 ${
                  !settings.online
                    ? 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 opacity-50 cursor-not-allowed'
                    : settings.showFps
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800/60 text-emerald-950 dark:text-emerald-100 cursor-pointer'
                    : 'bg-slate-50 dark:bg-[#181c3b] border-slate-200 dark:border-[#252b54] text-slate-500 dark:text-slate-400 opacity-80 cursor-pointer'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Gauge
                    className={`w-4 h-4 ${
                      settings.online && settings.showFps
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-400'
                    }`}
                  />
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                      !settings.online
                        ? 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                        : settings.showFps
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {!settings.online
                      ? 'OFFLINE'
                      : settings.showFps
                      ? settings.fps > 0
                        ? `${settings.fps.toFixed(1)} FPS`
                        : 'HIỂN THỊ'
                      : 'ẨN'}
                  </span>
                </div>
                <span className="text-xs font-semibold">FPS Màn LCD</span>
              </button>
            </div>

            {/* Cài đặt Số khuôn mặt nhận diện tối đa (MAX_FACES_PER_FRAME) */}
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#181c3b] border border-slate-200/80 dark:border-[#252b54] space-y-2 mt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                    <Users className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                      Số khuôn mặt nhận diện
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                      MAX_FACES_PER_FRAME
                    </div>
                  </div>
                </div>
                <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  {settings.maxFaces || 3} người
                </span>
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 4, 5].map((num) => {
                  const isActive = (settings.maxFaces || 3) === num;
                  return (
                    <button
                      key={num}
                      type="button"
                      disabled={!settings.online || isUpdating}
                      onClick={() => setMaxFaces(num)}
                      className={`py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                        !settings.online
                          ? 'bg-slate-100 dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800 opacity-50 cursor-not-allowed'
                          : isActive
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white dark:bg-[#12162e] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#252b54] hover:border-indigo-400'
                      }`}
                    >
                      {num} mặt
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
