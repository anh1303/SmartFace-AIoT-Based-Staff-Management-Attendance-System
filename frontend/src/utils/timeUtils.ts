export const parseTimeToSeconds = (timeStr?: string): number | null => {
  if (!timeStr || timeStr === '--:--:--' || timeStr === '--') return null;
  if (timeStr.includes('T')) {
    const d = new Date(timeStr);
    return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
  }
  const parts = timeStr.split(':').map(Number);
  if (parts.length >= 2) {
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  }
  return null;
};

export const formatSecondsToHHMMSS = (totalSec: number): string => {
  if (totalSec <= 0) return '00:00:00';
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

/**
 * Quy tắc làm tròn thời gian (áp dụng cho Tăng ca và Đi trễ / Về sớm):
 * - Từ 0 đến 29 phút: quy về phần giờ + 0 giờ (0 phút)
 * - Từ 30 đến 59 phút: quy về phần giờ + 0.5 giờ (30 phút = 1800s)
 */
export const roundToHalfHour = (totalSec: number): number => {
  if (totalSec <= 0) return 0;
  const totalMinutes = Math.floor(totalSec / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours + (minutes >= 30 ? 0.5 : 0);
};

export const roundTo30Minutes = (totalSec: number): number => {
  if (totalSec <= 0) return 0;
  const totalMinutes = Math.floor(totalSec / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours * 3600 + (minutes >= 30 ? 1800 : 0);
};


export const calculateRawLateEarlySec = (
  shift: { start_time: string; end_time: string },
  inTimeStr?: string,
  outTimeStr?: string
): number => {
  const startSec = parseTimeToSeconds(shift.start_time);
  const endSec = parseTimeToSeconds(shift.end_time);
  const inSec = parseTimeToSeconds(inTimeStr);
  const outSec = parseTimeToSeconds(outTimeStr);

  let lateSec = 0;
  if (inSec !== null && startSec !== null && inSec > startSec) {
    lateSec = inSec - startSec;
  }

  let earlySec = 0;
  if (outSec !== null && endSec !== null && outSec < endSec) {
    earlySec = endSec - outSec;
  }

  const rawTotalSec = lateSec + earlySec;
  return rawTotalSec > 0 ? rawTotalSec : 0;
};

export const calculateRawInitialOTSec = (
  shift: { start_time: string; end_time: string },
  inTimeStr?: string,
  outTimeStr?: string
): number => {
  const startSec = parseTimeToSeconds(shift.start_time);
  const endSec = parseTimeToSeconds(shift.end_time);
  const inSec = parseTimeToSeconds(inTimeStr);
  const outSec = parseTimeToSeconds(outTimeStr);

  if (startSec === null || endSec === null || inSec === null || outSec === null) {
    return 0;
  }

  const actualWorkSec = outSec - inSec;
  const expectedWorkSec = endSec - startSec;
  const rawOT = actualWorkSec - expectedWorkSec;
  return rawOT > 0 ? rawOT : 0;
};

/**
 * Tính số giờ làm việc chuẩn trong ngày = thời gian kết thúc ca - thời gian bắt đầu ca
 * (Ví dụ ca hành chính: 17:30 - 08:30 = 9.0 giờ)
 */
export const calculateShiftWorkingHours = (
  shift: { start_time?: string; end_time?: string }
): number => {
  const startSec = parseTimeToSeconds(shift.start_time || '08:30');
  const endSec = parseTimeToSeconds(shift.end_time || '17:30');
  if (startSec === null || endSec === null) return 9;
  let diffSec = endSec - startSec;
  if (diffSec < 0) diffSec += 24 * 3600;
  return Math.round((diffSec / 3600) * 100) / 100;
};

export const getStatusBadge = (status: string) => {
  switch (status) {
    case 'ON_TIME':
      return { label: 'Đúng giờ', color: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' };
    case 'LATE':
      return { label: 'Đi trễ', color: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20' };
    case 'EARLY_LEAVE':
      return { label: 'Về sớm', color: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20' };
    case 'LATE_AND_EARLY':
      return { label: 'Trễ & Sớm', color: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20' };
    case 'ABSENT':
      return { label: 'Vắng mặt', color: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20' };
    case 'NO_SHIFT':
      return { label: 'Không có ca', color: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700' };
    default:
      return { label: status, color: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700' };
  }
};
