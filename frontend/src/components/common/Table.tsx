import React from 'react';
import { Edit } from 'lucide-react';

/**
 * Container bao bọc bảng theo chuẩn Bento Design System:
 * Nền card tối ưu dark/light mode, viền border-slate-300/dark:border-[#28305c], bo góc rounded-xl,
 * thanh cuộn ngang tự động (overflow-x-auto) và table table-fixed đồng bộ.
 */
export interface TableContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  minWidth?: string;
  tableClassName?: string;
  maxHeight?: string;
}

export const TableContainer: React.FC<TableContainerProps> = ({
  children,
  className = '',
  minWidth = '1000px',
  tableClassName = '',
  maxHeight = '620px',
  ...props
}) => {
  return (
    <div
      className={`bg-white dark:bg-[#13162b] border border-slate-300 dark:border-[#28305c] rounded-xl overflow-hidden shadow-xs transition-colors ${className}`}
      {...props}
    >
      <div
        tabIndex={0}
        role="region"
        aria-label="Bảng dữ liệu, cuộn ngang để xem đầy đủ cột"
        className="overflow-x-auto overflow-y-auto"
        style={{ maxHeight: maxHeight === 'none' ? undefined : maxHeight }}
      >
        <table
          style={{ minWidth }}
          className={`w-full text-left text-xs border-collapse table-fixed ${tableClassName}`}
        >
          {children}
        </table>
      </div>
    </div>
  );
};

/**
 * Header thead chuẩn: nền slate-200/dark-[#0c0f1f], chữ uppercase font-mono đậm, viền đáy dày 2px
 */
export interface TableHeadProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  children: React.ReactNode;
}

export const TableHead: React.FC<TableHeadProps> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <thead
      className={`sticky top-0 z-10 border-b border-slate-200 dark:border-[#28305c] bg-slate-50 dark:bg-[#0c0f1f] text-[11px] font-bold text-slate-800 dark:text-slate-200 tracking-normal font-sans ${className}`}
      {...props}
    >
      {children}
    </thead>
  );
};

export const TableHeadRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <tr className={className} {...props}>
      {children}
    </tr>
  );
};

/**
 * Ô tiêu đề cột th chuẩn: có vạch kẻ dọc phân chia cột border-r, padding py-4 px-4, căn giữa/trái/phải
 */
export interface TableHeadCellProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  children?: React.ReactNode;
  isLast?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string | number;
}

export const TableHeadCell: React.FC<TableHeadCellProps> = ({
  children,
  className = '',
  isLast = false,
  align,
  width,
  style,
  ...props
}) => {
  const finalAlign = align || (className.includes('text-left') ? 'left' : className.includes('text-right') ? 'right' : 'center');
  const alignClass =
    finalAlign === 'left' ? 'text-left' : finalAlign === 'right' ? 'text-right' : 'text-center';
  const borderClass = isLast
    ? ''
    : 'border-r border-slate-300 dark:border-[#222956]';

  return (
    <th
      style={{ width, ...style }}
      className={`sticky top-0 z-10 bg-slate-50 dark:bg-[#0c0f1f] border-b border-slate-200 dark:border-[#28305c] py-4 px-4 font-bold ${alignClass} ${borderClass} ${className}`}
      {...props}
    >
      {children}
    </th>
  );
};

/**
 * Thân bảng tbody chuẩn
 */
export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <tbody
      className={`text-slate-700 dark:text-slate-300 ${className}`}
      {...props}
    >
      {children}
    </tbody>
  );
};

/**
 * Dòng bảng tr chuẩn: hiệu ứng hover tím mờ, đường kẻ viền đáy
 */
export const TableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <tr
      className={`hover:bg-blue-50/40 dark:hover:bg-[#181c38]/50 transition-colors border-b border-slate-200 dark:border-[#202752] ${className}`}
      {...props}
    >
      {children}
    </tr>
  );
};

/**
 * Ô dữ liệu td chuẩn: có vạch kẻ dọc border-r, padding py-4 px-4
 */
export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  children?: React.ReactNode;
  isLast?: boolean;
  align?: 'left' | 'center' | 'right';
}

export const TableCell: React.FC<TableCellProps> = ({
  children,
  className = '',
  isLast = false,
  align,
  ...props
}) => {
  const finalAlign = align || (className.includes('text-left') ? 'left' : className.includes('text-right') ? 'right' : 'center');
  const alignClass =
    finalAlign === 'left' ? 'text-left' : finalAlign === 'right' ? 'text-right' : 'text-center';
  const borderClass = isLast
    ? ''
    : 'border-r border-slate-200 dark:border-[#202752]';

  return (
    <td
      className={`py-4 px-4 ${alignClass} ${borderClass} ${className}`}
      {...props}
    >
      {children}
    </td>
  );
};

/**
 * Dòng thông báo khi không có dữ liệu phù hợp
 */
export interface TableEmptyProps {
  colSpan: number;
  message?: React.ReactNode;
  className?: string;
}

export const TableEmpty: React.FC<TableEmptyProps> = ({
  colSpan,
  message = 'Không tìm thấy dữ liệu nào phù hợp.',
  className = '',
}) => {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className={`py-12 text-center text-slate-400 dark:text-slate-500 font-medium ${className}`}
      >
        {message}
      </td>
    </tr>
  );
};

/**
 * Badge mã nhân viên / mã đối tượng chuẩn (font-mono tím)
 */
export interface CodeBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  code?: string;
  children?: React.ReactNode;
  variant?: 'purple' | 'slate' | 'emerald' | 'amber';
  onClick?: () => void;
  title?: string;
}

export const CodeBadge: React.FC<CodeBadgeProps> = ({
  code,
  children,
  variant = 'purple',
  onClick,
  className = '',
  title,
  ...props
}) => {
  const variantStyles = {
    purple:
      'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200/80 dark:border-blue-500/20',
    slate:
      'bg-slate-100 dark:bg-[#181c38] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700/60',
    emerald:
      'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
    amber:
      'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
  }[variant];

  const clickableStyles = onClick
    ? 'hover:underline cursor-pointer'
    : '';

  return (
    <span
      onClick={onClick}
      title={title}
      className={`font-mono font-bold px-2 py-0.5 rounded-lg border text-xs inline-flex items-center gap-1 max-w-full truncate ${variantStyles} ${clickableStyles} ${className}`}
      {...props}
    >
      {children ?? code}
    </span>
  );
};

/**
 * Badge trạng thái bo tròn (Pill Badge) chuẩn như trang Quản lý nhân viên
 */
export interface StatusBadgeProps {
  status: 'ACTIVE' | 'INACTIVE' | boolean | string;
  activeText?: string;
  inactiveText?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  title?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  activeText = 'ĐANG HOẠT ĐỘNG',
  inactiveText = 'TẠM NGƯNG',
  onClick,
  disabled = false,
  className = '',
  title,
}) => {
  const isActive = status === 'ACTIVE' || status === true || status === 'active';
  const label = isActive ? activeText : inactiveText;

  const colorStyles = disabled
    ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-[#181c38] text-slate-400 border border-slate-200 dark:border-slate-700'
    : isActive
    ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100'
    : 'bg-slate-100 dark:bg-[#181c38] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-[#272d5a] hover:bg-slate-200';

  const cursorStyles = onClick && !disabled ? 'cursor-pointer' : '';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick}
      title={title}
      className={`px-3 py-1 rounded-full text-[10px] font-bold font-mono transition-all border ${colorStyles} ${cursorStyles} ${className}`}
    >
      {label}
    </button>
  );
};

/**
 * Nút Thao Tác (Action Button - Nút Sửa/Chỉnh sửa) chuẩn
 */
export interface ActionEditButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string;
  icon?: React.ReactNode | React.ComponentType<{ className?: string }>;
}

export const ActionEditButton: React.FC<ActionEditButtonProps> = ({
  label = 'Sửa',
  icon,
  className = '',
  disabled = false,
  ...props
}) => {
  const renderIcon = () => {
    if (!icon) return <Edit className="w-3.5 h-3.5 text-slate-400" />;
    if (React.isValidElement(icon)) {
      return icon;
    }
    if (typeof icon === 'function' || (typeof icon === 'object' && icon !== null && (icon as any).$$typeof === Symbol.for('react.forward_ref'))) {
      const IconComp = icon as React.ComponentType<{ className?: string }>;
      return <IconComp className="w-3.5 h-3.5 text-slate-400" />;
    }
    return icon as React.ReactNode;
  };

  return (
    <button
      type="button"
      disabled={disabled}
      className={`px-3.5 py-1.5 rounded-xl border font-medium text-xs inline-flex items-center gap-1.5 transition-all shadow-xs ${
        disabled
          ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-[#181c38] text-slate-400 border-slate-200 dark:border-slate-800'
          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-[#181c38] dark:hover:bg-[#20254b] dark:text-slate-200 border-slate-200 dark:border-[#272d5a] cursor-pointer'
      } ${className}`}
      {...props}
    >
      {renderIcon()}
      <span>{label}</span>
    </button>
  );
};
