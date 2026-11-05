import React from 'react';
import { Fingerprint } from 'lucide-react';
import { PageHeaderBanner } from '../../../components/common';

export const BiometricsHeader: React.FC = () => {
  return (
    <PageHeaderBanner title="Sinh trắc học" icon={<div className="w-10 h-10 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-inner"><Fingerprint className="w-5 h-5" /></div>} />
  );
};
