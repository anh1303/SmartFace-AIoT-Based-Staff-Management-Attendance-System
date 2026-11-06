import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Fingerprint, ScanFace, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import type { Employee } from '../../types';
import { PageHeaderBanner } from '../../components/common';

export const EmployeeBiometrics: React.FC = () => {
  const { currentUser } = useAuth();
  const employeeId = currentUser?.employee_id;
  const profile = useQuery({ queryKey: ['ownEmployeeProfile', employeeId], enabled: !!employeeId,
    queryFn: async () => {
      const res = await api.get<Employee>(`/api/employees/${encodeURIComponent(employeeId!)}`);
      if (!res.success || !res.data) throw new Error(res.message || 'Không tải được trạng thái sinh trắc học');
      return res.data;
    },
  });
  return <div className="sf-employee-page space-y-5">
    <PageHeaderBanner icon={<span className="sf-employee-title-icon"><ScanFace size={22}/></span>} title="Sinh trắc học"/>
    {!employeeId ? <p className="sf-empty">Chưa có hồ sơ nhân viên liên kết.</p> : profile.isPending ? <p role="status">Đang tải trạng thái sinh trắc học…</p> : profile.isError ? <p role="alert" className="sf-feedback error">{profile.error.message} <button className="underline" onClick={() => void profile.refetch()}>Thử lại</button></p> : <section className="sf-panel px-5 divide-y divide-slate-200 dark:divide-slate-700">{[
      { name: 'Nhận diện khuôn mặt', method: 'khuôn mặt', icon: ScanFace, enrolled: profile.data.face_enrolled },
      { name: 'Vân tay', method: 'vân tay', icon: Fingerprint, enrolled: profile.data.fingerprint_enrolled },
    ].map(({ name, method, icon: Icon, enrolled }) => <div key={name} className="flex flex-wrap items-center gap-5 py-6"><Icon size={30} className="text-blue-600 dark:text-blue-400"/><div className="flex-1 min-w-40"><h2 className="text-lg font-semibold">{name}</h2><p className="sf-secondary mt-1">Xác thực chấm công bằng {method}</p></div><span className={`sf-badge ${enrolled ? 'success' : ''}`}>{enrolled == null ? 'Chưa có dữ liệu' : enrolled ? 'Đã đăng ký' : 'Chưa đăng ký'}</span></div>)}</section>}
    <section className="sf-panel p-5"><h2 className="flex items-center gap-2 font-semibold"><ShieldCheck size={19} className="text-emerald-700 dark:text-emerald-400"/>Bảo mật dữ liệu sinh trắc học</h2><p className="sf-secondary mt-3">Để đăng ký lại hoặc thay đổi dữ liệu sinh trắc học, vui lòng liên hệ người quản lý có thẩm quyền để được xác minh.</p></section>
  </div>;
};
