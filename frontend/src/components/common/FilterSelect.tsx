import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const truncate = (text: string) => {
    if (!text || text.length <= maxTruncateLen) return text;
    return text.slice(0, maxTruncateLen - 1) + '…';
  };

  const normalizedOptions: FilterSelectOption[] = options.map((opt) =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );

  const allItems: FilterSelectOption[] = [
    ...(allLabel ? [{ value: allValue, label: allLabel }] : []),
    ...normalizedOptions.filter((o) => !allLabel || o.value !== allValue),
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

  // Cập nhật index khi mở dropdown
  useEffect(() => {
    if (isOpen) {
      const idx = allItems.findIndex((o) => o.value === value);
      setFocusedIndex(idx >= 0 ? idx : 0);
    } else {
      setFocusedIndex(-1);
    }
  }, [isOpen, value]);

  const selectOption = useCallback(
    (opt: FilterSelectOption) => {
      if (opt.disabled) return;
      onChange(opt.value);
      setIsOpen(false);
      buttonRef.current?.focus();
    },
    [onChange]
  );

  // Điều hướng bằng bàn phím (Keyboard navigation)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape' || e.key === 'Tab') {
      setIsOpen(false);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((prev) => {
        let next = prev + 1;
        while (next < allItems.length && allItems[next]?.disabled) {
          next++;
        }
        return next < allItems.length ? next : prev;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((prev) => {
        let next = prev - 1;
        while (next >= 0 && allItems[next]?.disabled) {
          next--;
        }
        return next >= 0 ? next : prev;
      });
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < allItems.length) {
        const item = allItems[focusedIndex];
        if (item) selectOption(item);
      }
    }
  };

  const listboxId = `filter-select-list-${label.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div className={`flex items-center gap-2 ${className}`} ref={dropdownRef}>
      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
        {label}
      </span>
      <div className={`relative ${widthClass}`}>
        {/* Nút bấm mở Dropdown */}
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled}
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls={isOpen ? listboxId : undefined}
          aria-label={label}
          onClick={() => {
            if (!disabled) setIsOpen(!isOpen);
          }}
          onKeyDown={handleKeyDown}
          title={currentTitle}
          className={`w-full text-left truncate bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl pl-3 pr-8 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 ${
            disabled ? 'opacity-70 cursor-not-allowed bg-slate-100 dark:bg-slate-800/40' : 'cursor-pointer'
          }`}
        >
          {truncate(currentTitle)}
        </button>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />

        {/* Danh sách xổ xuống: giới hạn chiều cao đúng 5 mục (150px) */}
        {isOpen && !disabled && (
          <ul
            id={listboxId}
            role="listbox"
            tabIndex={-1}
            aria-label={label}
            className="absolute z-50 mt-1 w-full bg-white dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl shadow-lg max-h-[150px] overflow-y-auto py-1 custom-scrollbar"
          >
            {allItems.map((opt, idx) => {
              const isSelected = value === opt.value;
              const isFocused = focusedIndex === idx;

              return (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={opt.disabled}
                  title={opt.disabled ? `${opt.label} (Không thể chọn)` : opt.label}
                  onClick={() => selectOption(opt)}
                  onMouseEnter={() => !opt.disabled && setFocusedIndex(idx)}
                  className={`px-3 py-1.5 text-xs flex items-center justify-between gap-1.5 truncate ${
                    opt.disabled
                      ? 'opacity-40 cursor-not-allowed bg-slate-50 dark:bg-[#121630] text-slate-400 dark:text-slate-600'
                      : isFocused || isSelected
                      ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 font-medium cursor-pointer'
                      : 'text-slate-800 dark:text-slate-200 cursor-pointer hover:bg-purple-50 dark:hover:bg-[#1a1f3d]'
                  }`}
                >
                  <span className="truncate">{truncate(opt.label)}</span>
                  {opt.disabled && <Lock className="w-3 h-3 shrink-0 text-slate-400 dark:text-slate-500" />}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};