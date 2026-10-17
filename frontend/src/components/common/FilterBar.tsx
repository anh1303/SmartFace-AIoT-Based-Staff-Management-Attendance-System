import React from 'react';

export interface FilterBarProps {
  children: React.ReactNode;
  className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({ children, className = '' }) => {
  return (
    <div
      className={`bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-xl p-4 flex flex-col lg:flex-row items-center justify-between gap-4 shadow-xs transition-colors ${className}`}
    >
      {children}
    </div>
  );
};
