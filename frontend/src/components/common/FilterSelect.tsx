import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Lock } from 'lucide-react';

export interface FilterSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: (string | FilterSelectOption)[];
  allLabel?: string;
  allValue?: string;
  widthClass?: string;
  maxTruncateLen?: number;
  className?: string;
  disabled?: boolean;
}

export const FilterSelect: React.FC<FilterSelectProps> = ({
  label,
  value,
  onChange,
  options,
  allLabel,
  allValue = 'ALL',
  widthClass = 'w-[145px]',
  maxTruncateLen = 17,
  className = '',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const truncate = (text: string) => {
    if (!text || text.length <= maxTruncateLen) return text;
    return text.slice(0, maxTruncateLen - 1) + '…';
  };

  const normalizedOptions: FilterSelectOption[] = options.map((opt) =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );

  const allItems: FilterSelectOption[] = [
    ...(allLabel ? [{ value: allValue, label: allLabel }] : []),
    ...normalizedOptions,
  ];

  const currentOption = allItems.find((o) => o.value === value);
  const currentTitle = currentOption?.label || value;

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`flex items-center gap-2 ${className}`} ref={dropdownRef}>
      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
        {label}
      </span>
      <div className={`relative ${widthClass}`}>
        {/* Nút bấm mở Dropdown */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (!disabled) setIsOpen(!isOpen);
          }}
          title={currentTitle}
          className={`w-full text-left truncate bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl pl-3 pr-8 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500 ${
            disabled ? 'opacity-70 cursor-not-allowed bg-slate-100 dark:bg-slate-800/40' : 'cursor-pointer'
          }`}
        >
          {truncate(currentTitle)}
        </button>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none transition-transform ${isOpen ? 'rotate-180' : ''
            }`}
        />

        {/* Danh sách xổ xuống: giới hạn chiều cao đúng 5 mục (150px) */}
        {isOpen && !disabled && (
          <ul className="absolute z-50 mt-1 w-full bg-white dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl shadow-lg max-h-[150px] overflow-y-auto py-1">
            {allItems.map((opt) => (
              <li
                key={opt.value}
                title={opt.disabled ? `${opt.label} (Không thể chọn)` : opt.label}
                onClick={() => {
                  if (opt.disabled) return;
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`px-3 py-1.5 text-xs flex items-center justify-between gap-1.5 truncate ${
                  opt.disabled
                    ? 'opacity-40 cursor-not-allowed bg-slate-50 dark:bg-[#121630] text-slate-400 dark:text-slate-600'
                    : value === opt.value
                    ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 font-medium cursor-pointer hover:bg-purple-50 dark:hover:bg-[#1a1f3d]'
                    : 'text-slate-800 dark:text-slate-200 cursor-pointer hover:bg-purple-50 dark:hover:bg-[#1a1f3d]'
                }`}
              >
                <span className="truncate">{truncate(opt.label)}</span>
                {opt.disabled && <Lock className="w-3 h-3 shrink-0 text-slate-400 dark:text-slate-500" />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};