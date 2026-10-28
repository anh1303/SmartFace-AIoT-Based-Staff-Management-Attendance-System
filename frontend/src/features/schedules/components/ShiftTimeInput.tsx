import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface ShiftTimeInputProps {
  value: string;
  onChange: (val: string) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  hasError?: boolean;
}

export const ShiftTimeInput: React.FC<ShiftTimeInputProps> = ({
  value,
  onChange,
  id,
  placeholder = '00:00',
  disabled = false,
  className = '',
  hasError = false,
}) => {
  const [displayVal, setDisplayVal] = useState(value || '00:00');

  useEffect(() => {
    setDisplayVal(value || '00:00');
  }, [value]);

  const normalizeTime = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) return '00:00';

    const digitsOnly = trimmed.replace(/\D/g, '');

    if (trimmed.includes(':')) {
      const parts = trimmed.split(':');
      let h = parseInt(parts[0], 10);
      let m = parseInt(parts[1], 10);
      if (isNaN(h)) h = 0;
      if (isNaN(m)) m = 0;
      h = Math.min(23, Math.max(0, h));
      m = Math.min(59, Math.max(0, m));
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    if (digitsOnly.length === 1 || digitsOnly.length === 2) {
      let h = parseInt(digitsOnly, 10);
      if (isNaN(h)) h = 0;
      h = Math.min(23, Math.max(0, h));
      return `${String(h).padStart(2, '0')}:00`;
    }

    if (digitsOnly.length >= 3) {
      let h = parseInt(digitsOnly.slice(0, 2), 10);
      let m = parseInt(digitsOnly.slice(2, 4), 10);
      if (isNaN(h)) h = 0;
      if (isNaN(m)) m = 0;
      h = Math.min(23, Math.max(0, h));
      m = Math.min(59, Math.max(0, m));
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    return '00:00';
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value;
    input = input.replace(/[^0-9:]/g, '');
    if (input.length > 5) input = input.slice(0, 5);

    if (input.length === 2 && !input.includes(':') && input.length > displayVal.length) {
      input = input + ':';
    }

    setDisplayVal(input);

    if (/^([01]\d|2[0-3]):([0-5]\d)$/.test(input)) {
      onChange(input);
    }
  };

  const handleBlur = () => {
    const formatted = normalizeTime(displayVal);
    setDisplayVal(formatted);
    onChange(formatted);
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      <input
        id={id}
        type="text"
        value={displayVal}
        onChange={handleInputChange}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={5}
        className={`w-full pl-3 pr-8 py-2 border rounded-lg text-xs font-mono font-medium tracking-wider transition-colors focus:outline-none ${
          disabled
            ? 'bg-slate-100/70 dark:bg-[#13162b] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-[#21264b] cursor-not-allowed select-none'
            : hasError
            ? 'bg-white dark:bg-[#0f1224] text-slate-900 dark:text-white border-rose-400 dark:border-rose-500 focus:border-rose-500'
            : 'bg-white dark:bg-[#0f1224] text-slate-900 dark:text-white border-slate-300 dark:border-[#272d5a] focus:border-blue-500'
        }`}
      />
      <div
        className={`absolute right-2.5 pointer-events-none transition-colors ${
          disabled
            ? 'text-slate-300 dark:text-slate-600'
            : hasError
            ? 'text-rose-400 dark:text-rose-500'
            : 'text-slate-400 dark:text-slate-500'
        }`}
      >
        <Clock className="w-3.5 h-3.5" />
      </div>
    </div>
  );
};
