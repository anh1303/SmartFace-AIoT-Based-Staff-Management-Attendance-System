import React, { useState } from 'react';
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
  Users,
} from 'lucide-react';
import {
  useDeviceSettings,
  BluetoothDevice,
} from '../../attendances/hooks/useDeviceSettings';

interface DeviceKioskSettingsPanelProps {
  deviceId: string;
  deviceName?: string;
}

const renderWifiSignalIcon = (signal: number, className = 'w-4 h-4 shrink-0') => {
  if (signal >= 75) return <Wifi className={`${className} text-emerald-500`} />;
  if (signal >= 50) return <WifiHigh className={`${className} text-emerald-500 dark:text-emerald-400`} />;
  if (signal >= 25) return <WifiLow className={`${className} text-amber-500`} />;
  return <WifiZero className={`${className} text-rose-500`} />;
};

export const DeviceKioskSettingsPanel: React.FC<DeviceKioskSettingsPanelProps> = ({
  deviceId,
  deviceName,
}) => {
  const {
    settings,
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

  const [isTestingSound, setIsTestingSound] = useState(false);
  const [isReconnectingBt, setIsReconnectingBt] = useState(false);
  const [isDisconnectingBt, setIsDisconnectingBt] = useState(false);
  const [isBtPickerOpen, setIsBtPickerOpen] = useState(false);
  const [isScanningBt, setIsScanningBt] = useState(false);
  const [scannedBtDevices, setScannedBtDevices] = useState<BluetoothDevice[]>([]);
  const [connectingBtAddr, setConnectingBtAddr] = useState<string | null>(null);
  const [btFilterMode, setBtFilterMode] = useState<'all' | 'audio' | 'paired'>('all');
  const [btSearchText, setBtSearchText] = useState('');

  const handleTestAudio = async () => {
    setIsTestingSound(true);
    await testAudio();
    setTimeout(() => setIsTestingSound(false), 700);
  };

  const handleReconnectBluetooth = async () => {
    setIsReconnectingBt(true);
    await reconnectBluetooth();
    setTimeout(() => setIsReconnectingBt(false), 600);
  };

  const handleScanBluetooth = async () => {
    setIsScanningBt(true);
    const list = await scanBluetooth();
    setScannedBtDevices(list);
    setIsScanningBt(false);
  };

  const handleToggleBtPicker = () => {
    const next = !isBtPickerOpen;
    setIsBtPickerOpen(next);
    if (next) {
      handleScanBluetooth();
    }
  };

  const handleSelectBtDevice = async (dev: BluetoothDevice) => {
    setConnectingBtAddr(dev.address);
    const ok = await connectBluetooth(dev);
    setConnectingBtAddr(null);
    if (ok) {
      setScannedBtDevices((prev) =>
        prev.map((d) => ({
          ...d,
          connected: d.address === dev.address,
        }))
      );
    }
  };

  const handleDisconnectBluetooth = async (addr?: string) => {
    setIsDisconnectingBt(true);
    const ok = await disconnectBluetooth(addr);
    setIsDisconnectingBt(false);
    if (ok) {
      setScannedBtDevices((prev) =>
        prev.map((d) => ({
          ...d,
          connected: false,
        }))
      );
    }
  };

  const isLikelyAudioDevice = (dev: BluetoothDevice) => {
    const n = dev.name.toLowerCase();
    const audioKeywords = [
      'speaker', 'audio', 'sound', 'jbl', 'sony', 'marshall', 'bose',
      'airpods', 'buds', 'edifier', 'harman', 'anker', 'soundcore',
      'xiaomi', 'mi ', 'lg ', 'samsung', 'headphone', 'headset', 'earphone',
      'loa', 'tai nghe', 'microlab', 'fenda', 'logitech', 'razer', 'beat',
      'hoco', 'remax', 'baseus', 'pioneer', 'philips', 'sennheiser', 'havit', 'tw',
    ];
    return dev.paired || dev.connected || audioKeywords.some((kw) => n.includes(kw));
  };

  const filteredBtDevices = scannedBtDevices.filter((dev) => {
    if (btSearchText.trim()) {
      const q = btSearchText.trim().toLowerCase();
      const matchName = dev.name.toLowerCase().includes(q);
      const matchMac = dev.address.toLowerCase().includes(q);
      if (!matchName && !matchMac) return false;
    }
    if (btFilterMode === 'paired') {
      return dev.paired || dev.connected;
    }
    if (btFilterMode === 'audio') {
      return isLikelyAudioDevice(dev);
    }
    return true;
  });

  const renderVolumeIcon = (className = 'w-4 h-4') => {
    if (settings.isMuted || settings.volume === 0) {
      return <VolumeX className={`${className} text-rose-500`} />;
    }
    if (settings.volume < 50) {
      return <Volume1 className={`${className} text-purple-600 dark:text-purple-400`} />;
    }
    return <Volume2 className={`${className} text-purple-600 dark:text-purple-400`} />;
  };

  return (
    <section className="sf-panel p-5 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-base text-slate-900 dark:text-white">
              Cấu hình Phần cứng & Ngoại vi Kiosk ({deviceName || deviceId})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Quản lý kết nối mạng, loa/tai nghe Bluetooth, Camera, màn hình LCD và giới hạn khuôn mặt nhận diện riêng cho thiết bị này
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {settings.online ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Đang trực tuyến {settings.fps > 0 ? `• ${settings.fps.toFixed(1)} FPS` : ''}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              Thiết bị ngoại tuyến (Offline)
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* CỘT TRÁI: KẾT NỐI MẠNG & LOA BLUETOOTH */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            1. Kết nối Mạng & Loa / Tai nghe Bluetooth
          </h3>

          {/* Thẻ Wi-Fi */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#181c3b] border border-slate-200/80 dark:border-[#252b54] flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`p-2.5 rounded-lg shrink-0 ${
                  settings.online && settings.wifi.connected
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                    : 'bg-slate-200/70 dark:bg-slate-800 text-slate-400'
                }`}
              >
                {settings.online && settings.wifi.connected ? (
                  renderWifiSignalIcon(settings.wifi.signalStrength, 'w-5 h-5')
                ) : (
                  <WifiOff className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                  {!settings.online
                    ? 'Thiết bị đang Offline'
                    : settings.wifi.connected && settings.wifi.ssid
                    ? settings.wifi.ssid
                    : 'Chưa kết nối Wi-Fi'}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {!settings.online
                    ? 'Hãy chạy python edge_client.py trên Raspberry Pi'
                    : settings.wifi.connected && settings.wifi.ssid
                    ? `Đã kết nối • Cường độ tín hiệu ${settings.wifi.signalStrength}%`
                    : 'Chưa có tín hiệu mạng'}
                </div>
              </div>
            </div>
            {settings.online && settings.wifi.connected && settings.wifi.ip ? (
              <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300/50 dark:border-slate-700 shrink-0">
                {settings.wifi.ip}
              </span>
            ) : null}
          </div>

          {/* Thẻ Quản lý Loa / Tai nghe Bluetooth */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#181c3b] border border-slate-200/80 dark:border-[#252b54] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`p-2.5 rounded-lg ${
                    settings.bluetooth.connected && settings.bluetooth.deviceName
                      ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400'
                      : 'bg-slate-200/70 dark:bg-slate-800 text-slate-400'
                  }`}
                >
                  <Headphones className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                    {settings.bluetooth.connected && settings.bluetooth.deviceName
                      ? settings.bluetooth.deviceName
                      : 'Chưa kết nối loa / tai nghe Bluetooth'}
                  </div>
                  <div className="text-xs">
                    {settings.bluetooth.connected && settings.bluetooth.deviceName ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        🟢 Đã kết nối • Sẵn sàng phát thông báo
                      </span>
                    ) : (
                      <span className="text-slate-400 font-medium">⚪ Chưa kết nối</span>
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
                    className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isReconnectingBt ? 'animate-spin' : ''}`} />
                    <span>{isReconnectingBt ? 'Đang thử...' : 'Nối lại'}</span>
                  </button>
                )}

                {settings.bluetooth.connected && (
                  <button
                    type="button"
                    onClick={() => handleDisconnectBluetooth()}
                    disabled={isDisconnectingBt || isUpdating}
                    className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40 transition-colors cursor-pointer"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    <span>{isDisconnectingBt ? 'Đang ngắt...' : 'Ngắt kết nối'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleToggleBtPicker}
                  className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer border ${
                    isBtPickerOpen
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/40'
                  }`}
                >
                  <Bluetooth className="w-3.5 h-3.5" />
                  <span>
                    {isBtPickerOpen
                      ? 'Đóng danh sách'
                      : settings.bluetooth.connected && settings.bluetooth.deviceName
                      ? 'Đổi loa'
                      : 'Tìm thiết bị'}
                  </span>
                </button>
              </div>
            </div>

            {/* Ngăn kéo quét & lọc thiết bị Bluetooth */}
            {isBtPickerOpen && (
              <div className="pt-3 border-t border-slate-200/80 dark:border-[#252b54] space-y-2.5">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold uppercase tracking-wider text-[11px]">
                    Thiết bị Bluetooth phát hiện ({scannedBtDevices.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleScanBluetooth}
                    disabled={isScanningBt}
                    className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${isScanningBt ? 'animate-spin' : ''}`} />
                    <span>{isScanningBt ? 'Đang quét...' : 'Quét lại'}</span>
                  </button>
                </div>

                {/* Bộ lọc tìm kiếm */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={btSearchText}
                      onChange={(e) => setBtSearchText(e.target.value)}
                      placeholder="Lọc theo tên thiết bị hoặc địa chỉ MAC..."
                      className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg bg-white dark:bg-[#12162e] border border-slate-200 dark:border-[#252b54] text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-purple-500"
                    />
                    {btSearchText && (
                      <button
                        type="button"
                        onClick={() => setBtSearchText('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {(
                      [
                        { id: 'all', label: `Tất cả (${scannedBtDevices.length})` },
                        {
                          id: 'audio',
                          label: `Loa & Tai nghe (${scannedBtDevices.filter(isLikelyAudioDevice).length})`,
                        },
                        {
                          id: 'paired',
                          label: `Đã ghép đôi (${scannedBtDevices.filter((d) => d.paired || d.connected).length})`,
                        },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setBtFilterMode(tab.id)}
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                          btFilterMode === tab.id
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300/70'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {isScanningBt && scannedBtDevices.length === 0 ? (
                  <div className="py-4 text-center text-xs text-slate-400">
                    Đang dò thiết bị Bluetooth quanh Raspberry Pi (khoảng 5 giây)...
                  </div>
                ) : filteredBtDevices.length === 0 ? (
                  <div className="py-3 text-center text-xs text-slate-400">
                    {scannedBtDevices.length === 0
                      ? 'Không tìm thấy thiết bị Bluetooth nào. Hãy bật chế độ Pairing trên loa/tai nghe.'
                      : 'Không có thiết bị nào khớp với bộ lọc hiện tại.'}
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                    {filteredBtDevices.map((dev) => {
                      const isCurrent =
                        dev.connected ||
                        (settings.bluetooth.connected && settings.bluetooth.deviceName === dev.name);
                      const isConnecting = connectingBtAddr === dev.address;

                      return (
                        <div
                          key={dev.address}
                          className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-all border ${
                            isCurrent
                              ? 'bg-purple-50/90 dark:bg-purple-950/50 border-purple-300 dark:border-purple-800/70 text-purple-900 dark:text-purple-100'
                              : 'bg-white dark:bg-[#12162e] hover:bg-slate-100 dark:hover:bg-[#1f2547] border-slate-200/60 dark:border-[#222850] text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Headphones
                              className={`w-4 h-4 shrink-0 ${
                                isCurrent ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'
                              }`}
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold truncate">{dev.name}</span>
                                {dev.paired && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium shrink-0">
                                    Đã lưu
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">{dev.address}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isConnecting ? (
                              <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 animate-pulse px-2">
                                Đang kết nối...
                              </span>
                            ) : isCurrent ? (
                              <>
                                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Đang dùng
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleDisconnectBluetooth(dev.address)}
                                  disabled={isDisconnectingBt}
                                  className="text-[11px] font-semibold px-2 py-1 rounded bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 transition-colors cursor-pointer"
                                >
                                  Bỏ kết nối
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSelectBtDevice(dev)}
                                disabled={connectingBtAddr !== null}
                                className="text-[11px] font-semibold px-2.5 py-1 rounded bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 transition-colors cursor-pointer"
                              >
                                Kết nối
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Điều chỉnh âm lượng & Phát thử */}
            <div className="pt-3 border-t border-slate-200/80 dark:border-[#252b54] space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-600 dark:text-slate-300">Âm lượng thông báo Kiosk</span>
                <span className="font-mono text-purple-700 dark:text-purple-400 font-bold">
                  {settings.isMuted ? 'MUTE (0%)' : `${settings.volume}%`}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleMute}
                  title={settings.isMuted ? 'Bật âm thanh' : 'Tắt tiếng (Mute)'}
                  className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-[#252c5c] text-slate-600 dark:text-slate-300 cursor-pointer transition-colors shrink-0"
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
                    disabled={!settings.online}
                    style={{
                      background: `linear-gradient(to right, #a855f7 ${
                        settings.isMuted ? 0 : settings.volume
                      }%, rgba(148, 163, 184, 0.28) ${settings.isMuted ? 0 : settings.volume}%)`,
                    }}
                    className={`w-full sf-slider appearance-none cursor-pointer transition-all ${
                      !settings.online ? 'opacity-40 cursor-not-allowed' : ''
                    }`}
                  />
                </div>

                <Volume2 className="w-4 h-4 text-slate-400 shrink-0" />
              </div>

              {!settings.bluetooth.connected && (
                <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Chưa kết nối loa Bluetooth. Âm thanh sẽ phát qua ngõ ra mặc định của Pi.</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleTestAudio}
                disabled={isTestingSound || !settings.online}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-[#20254c] hover:bg-slate-100 dark:hover:bg-[#282f61] text-purple-700 dark:text-purple-300 border border-slate-200 dark:border-[#30386e] transition-all cursor-pointer shadow-2xs disabled:opacity-50"
              >
                <Play className={`w-4 h-4 ${isTestingSound ? 'animate-bounce text-emerald-500' : ''}`} />
                <span>
                  {isTestingSound
                    ? 'Đang phát chuông trên thiết bị...'
                    : 'Phát thử âm thanh check-in trên thiết bị'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: CAMERA KIOSK, MÀN HÌNH LCD & SỐ KHUÔN MẶT NHẬN DIỆN TỐI ĐA */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            2. Camera, Màn hình LCD & AI Nhận diện
          </h3>

          <div className="grid grid-cols-2 gap-3">
            {/* Nút bật/tắt Camera Kiosk */}
            <button
              type="button"
              onClick={toggleStream}
              disabled={!settings.online || isUpdating}
              className={`p-3.5 rounded-xl border flex flex-col gap-2 text-left transition-all duration-150 ${
                !settings.online
                  ? 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 opacity-50 cursor-not-allowed'
                  : settings.streamEnabled
                  ? 'bg-purple-50/80 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800/60 text-purple-950 dark:text-purple-100 cursor-pointer'
                  : 'bg-slate-50 dark:bg-[#181c3b] border-slate-200 dark:border-[#252b54] text-slate-500 dark:text-slate-400 opacity-80 cursor-pointer'
              }`}
            >
              <div className="flex items-center justify-between">
                {settings.online && settings.streamEnabled ? (
                  <Video className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                ) : (
                  <VideoOff className="w-5 h-5 text-slate-400" />
                )}
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    !settings.online
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                      : settings.streamEnabled
                      ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {!settings.online ? 'OFFLINE' : settings.streamEnabled ? 'ĐANG BẬT' : 'ĐÃ TẮT'}
                </span>
              </div>
              <div>
                <div className="text-sm font-semibold">Camera Kiosk</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Bật/tắt phần cứng camera & luồng video
                </div>
              </div>
            </button>

            {/* Nút bật/tắt FPS màn hình LCD */}
            <button
              type="button"
              onClick={toggleFps}
              disabled={!settings.online || isUpdating}
              className={`p-3.5 rounded-xl border flex flex-col gap-2 text-left transition-all duration-150 ${
                !settings.online
                  ? 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 opacity-50 cursor-not-allowed'
                  : settings.showFps
                  ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800/60 text-emerald-950 dark:text-emerald-100 cursor-pointer'
                  : 'bg-slate-50 dark:bg-[#181c3b] border-slate-200 dark:border-[#252b54] text-slate-500 dark:text-slate-400 opacity-80 cursor-pointer'
              }`}
            >
              <div className="flex items-center justify-between">
                <Gauge
                  className={`w-5 h-5 ${
                    settings.online && settings.showFps
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-400'
                  }`}
                />
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    !settings.online
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                      : settings.showFps
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {!settings.online
                    ? 'OFFLINE'
                    : settings.showFps
                    ? settings.fps > 0
                      ? `${settings.fps.toFixed(1)} FPS`
                      : 'HIỂN THỊ'
                    : 'ĐANG ẨN'}
                </span>
              </div>
              <div>
                <div className="text-sm font-semibold">FPS Màn LCD</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Hiển thị tốc độ khung hình xử lý
                </div>
              </div>
            </button>
          </div>

          {/* Cài đặt Số khuôn mặt được nhận diện tối đa (MAX_FACES_PER_FRAME) */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#181c3b] border border-slate-200/80 dark:border-[#252b54] space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Số khuôn mặt nhận diện tối đa trên khung hình
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Biến môi trường <code className="font-mono text-indigo-600 dark:text-indigo-400">MAX_FACES_PER_FRAME</code> — ưu tiên khuôn mặt lớn nhất (gần camera nhất)
                  </div>
                </div>
              </div>
              <span className="text-xs font-bold font-mono px-2.5 py-1 rounded-lg bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 shrink-0">
                {settings.maxFaces || 3} khuôn mặt
              </span>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((num) => {
                const isActive = (settings.maxFaces || 3) === num;
                return (
                  <button
                    key={num}
                    type="button"
                    disabled={!settings.online || isUpdating}
                    onClick={() => setMaxFaces(num)}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                      !settings.online
                        ? 'bg-slate-100 dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800 opacity-50 cursor-not-allowed'
                        : isActive
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white dark:bg-[#12162e] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#252b54] hover:border-indigo-400'
                    }`}
                  >
                    {num} người
                  </button>
                );
              })}
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Khi thay đổi, giá trị sẽ được áp dụng ngay lập tức cho pipeline AI trên Raspberry Pi và tự động lưu vào file <code className="font-mono">hardware/.env</code>.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
