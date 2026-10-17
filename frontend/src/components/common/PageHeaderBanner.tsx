import React from 'react';

export interface PageHeaderBannerProps {
  /** Tiêu đề chính của trang */
  title: React.ReactNode;
  /** Đoạn mô tả phụ bên dưới tiêu đề (tuỳ chọn) */
  subtitle?: React.ReactNode;
  /** Icon hiển thị phía trước tiêu đề */
  icon?: React.ReactNode;
  /** Nội dung bổ sung ngay cạnh tiêu đề (ví dụ dropdown bộ lọc nhanh, kỳ lương, ...) */
  titleExtra?: React.ReactNode;
  /** Huy hiệu/badge hiển thị cạnh tiêu đề */
  badge?: React.ReactNode;
  /** Nhóm nút hành động ở phía bên phải */
  actions?: React.ReactNode;
  /** Nội dung tuỳ biến lồng bên trong banner (hiển thị dưới hàng header) */
  children?: React.ReactNode;
  /** ClassName bổ sung cho container chính */
  className?: string;
  /** ClassName bổ sung cho thẻ h1 tiêu đề */
  titleClassName?: string;
  /** Bật/tắt hiệu ứng 3 ambient morphing blobs (mặc định: true) */
  showBlobs?: boolean;
  /** Bật/tắt overflow-hidden trên container (mặc định: true) */
  overflowHidden?: boolean;
}

/**
 * Component Header Banner dùng chung với phong cách thiết kế Bento Shifting Gradient
 * và 3 ambient blurred morphing blobs chuyển động mượt mà.
 */
export const PageHeaderBanner: React.FC<PageHeaderBannerProps> = ({
  title,
  subtitle,
  icon,
  titleExtra,
  badge,
  actions,
  children,
  className = '',
  titleClassName = '',
  showBlobs = true,
  overflowHidden = true,
}) => {
  return (
    <div
      className={`bento-hero-gradient rounded-2xl p-6 transition-all relative ${
        overflowHidden ? 'overflow-hidden' : ''
      } ${className}`}
    >
      {/* Ambient Floating & Morphing Blurred Blobs */}
      {showBlobs && (
        <>
          <div className="absolute -top-14 -right-10 w-72 h-72 bg-gradient-to-br from-purple-500/30 to-fuchsia-500/25 dark:from-purple-600/35 dark:to-fuchsia-600/25 rounded-full blur-3xl pointer-events-none animate-blob-1" />
          <div className="absolute -bottom-16 left-1/4 w-64 h-64 bg-gradient-to-tr from-indigo-500/30 to-blue-500/20 dark:from-indigo-600/30 dark:to-blue-600/20 rounded-full blur-3xl pointer-events-none animate-blob-2" />
          <div className="absolute top-1/4 right-1/3 w-48 h-48 bg-gradient-to-r from-violet-400/25 to-pink-400/25 dark:from-violet-500/25 dark:to-pink-500/20 rounded-full blur-2xl pointer-events-none animate-blob-3" />
        </>
      )}

      {/* Main Content Row */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            {icon && (
              <div className="flex items-center justify-center text-purple-600 dark:text-purple-400">
                {icon}
              </div>
            )}
            <h1
              className={`text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-heading tracking-tight ${titleClassName}`}
            >
              {title}
            </h1>
            {titleExtra && (
              <div className="flex items-center">{titleExtra}</div>
            )}
            {badge && (
              <div className="flex items-center">{badge}</div>
            )}
          </div>

          {subtitle && (
            <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
              {subtitle}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-3 flex-wrap">
            {actions}
          </div>
        )}
      </div>

      {children && (
        <div className="relative z-10 mt-4">
          {children}
        </div>
      )}
    </div>
  );
};

export const PageHeader = PageHeaderBanner;
