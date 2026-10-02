import React, { Suspense } from 'react';
import { useRoutes, Navigate, RouteObject } from 'react-router-dom';
import { publicRoutes } from './publicRoutes';
import { staffRoutes } from './staffRoutes';
import { managerRoutes } from './managerRoutes';
import { LoadingScreen } from '../components/common/LoadingScreen';

export const routes: RouteObject[] = [
  ...publicRoutes,
  staffRoutes,
  managerRoutes,
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
];

export const AppRoutes: React.FC = () => {
  const element = useRoutes(routes);

  return (
    <Suspense fallback={<LoadingScreen message="Đang tải giao diện..." subMessage="Khởi tạo tài nguyên..." />}>
      {element}
    </Suspense>
  );
};
