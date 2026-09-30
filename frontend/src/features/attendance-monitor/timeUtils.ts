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

export const roundTo30Minutes = (totalSec: number): number => {
  if (totalSec <= 0) return 0;
  return Math.round(totalSec / 1800) * 1800;
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

export const getStatusBadge = (status: string) => {
  switch (status) {
    case 'ON_TIME':
      return { label: 'Đúng giờ', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
    case 'LATE':
      return { label: 'Đi trễ', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
    case 'EARLY_LEAVE':
      return { label: 'Về sớm', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
    case 'LATE_AND_EARLY':
      return { label: 'Trễ & Sớm', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
    case 'ABSENT':
      return { label: 'Vắng mặt', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
    case 'NO_SHIFT':
      return { label: 'Không có ca', color: 'bg-slate-800 text-slate-400 border-slate-700' };
    default:
      return { label: status, color: 'bg-slate-800 text-slate-400 border-slate-700' };
  }
};
