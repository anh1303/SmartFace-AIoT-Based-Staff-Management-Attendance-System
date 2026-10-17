import React from 'react';
import { Download } from 'lucide-react';
import { PageHeaderBanner } from '../../../components/common';

interface ReportsHeaderProps {
  onOpenExportModal: () => void;
}

export const ReportsHeader: React.FC<ReportsHeaderProps> = ({ onOpenExportModal }) => {
  return (
    <PageHeaderBanner
      title="Báo Cáo & Thống Kê Chuyên Cần"
      actions={
        <button
          type="button"
          onClick={onOpenExportModal}
          className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center gap-2 shadow-sm shadow-purple-500/20 transition-all active:scale-95 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Xuất báo cáo CSV</span>
        </button>
      }
    />
  );
};
