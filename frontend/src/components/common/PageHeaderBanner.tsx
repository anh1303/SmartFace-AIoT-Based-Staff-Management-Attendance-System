import React from 'react';
export interface PageHeaderBannerProps {
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    icon?: React.ReactNode;
    titleExtra?: React.ReactNode;
    badge?: React.ReactNode;
    actions?: React.ReactNode;
    children?: React.ReactNode;
    className?: string;
    titleClassName?: string;
    showBlobs?: boolean;
    overflowHidden?: boolean;
}
export const PageHeaderBanner: React.FC<PageHeaderBannerProps> = ({ title, subtitle, icon, titleExtra, badge, actions, children, className = '', titleClassName = '' }) => <section className={`sf-page-heading ${className}`}><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-3">{icon && <span className="text-blue-600">{icon}</span>}<h1 className={`text-2xl font-bold tracking-tight ${titleClassName}`}>{title}</h1>{titleExtra}{badge}</div>{subtitle && <p className="text-slate-500 mt-2 text-sm">{subtitle}</p>}</div>{actions && <div className="flex flex-wrap gap-2">{actions}</div>}</div>{children && <div className="mt-4">{children}</div>}</section>;
export const PageHeader = PageHeaderBanner;
