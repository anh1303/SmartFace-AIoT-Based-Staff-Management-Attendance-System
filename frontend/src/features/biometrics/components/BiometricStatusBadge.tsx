import React from 'react';

export interface BiometricStatusBadgeProps {
  /**
   * Trạng thái đã đăng ký hay chưa
   */
  enrolled: boolean;
  /**
   * Hiển thị chữ in hoa (VD: 'ĐÃ ĐĂNG KÝ' / 'CHƯA ĐĂNG KÝ')
   * @default false
   */
  uppercase?: boolean;
  /**
   * Tùy chỉnh nội dung khi đã đăng ký
   */
  enrolledText?: string;
  /**
   * Tùy chỉnh nội dung khi chưa đăng ký
   */
  notEnrolledText?: string;
  /**
   * Kiểu bo góc viền ('full' hoặc 'md')
   * @default 'full'
   */
  rounded?: 'full' | 'md';
  /**
   * Kích thước badge ('sm' hoặc 'md')
   * @default 'sm'
   */
  size?: 'sm' | 'md';
  /**
   * ClassName bổ sung
   */
  className?: string;
}

/**
 * Component hiển thị nhãn trạng thái đăng ký Sinh trắc học (Face ID, Vân tay, ...)
 * Quy chuẩn thiết kế đồng nhất toàn hệ thống:
 * - ĐÃ ĐĂNG KÝ (enrolled = true): Màu xanh lá (Emerald/Green)
 * - CHƯA ĐĂNG KÝ (enrolled = false): Màu đỏ (Rose/Red)
 */
export const BiometricStatusBadge: React.FC<BiometricStatusBadgeProps> = ({
  enrolled,
  uppercase = false,
  enrolledText,
  notEnrolledText,
  rounded = 'full',
  size = 'sm',
  className = '',
}) => {
  const defaultEnrolled = uppercase ? 'ĐÃ ĐĂNG KÝ' : 'Đã đăng ký';
  const defaultNotEnrolled = uppercase ? 'CHƯA ĐĂNG KÝ' : 'Chưa đăng ký';

  const text = enrolled
    ? (enrolledText || defaultEnrolled)
    : (notEnrolledText || defaultNotEnrolled);

  const roundedClass = rounded === 'md' ? 'rounded-md' : 'rounded-full';

  const sizeClass =
    size === 'md'
      ? 'px-3 py-1 text-xs'
      : 'px-2.5 py-0.5 text-[10px]';

  // Quy chuẩn màu sắc: Đỏ cho Chưa đăng ký, Xanh lá cho Đã đăng ký
  const colorClass = enrolled
    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50';

  return (
    <span
      className={`inline-flex items-center justify-center font-bold font-mono tracking-tight whitespace-nowrap shadow-xs transition-colors ${roundedClass} ${sizeClass} ${colorClass} ${className}`}
    >
      {text}
    </span>
  );
};
