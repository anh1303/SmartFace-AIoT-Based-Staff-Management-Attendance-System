import React, { lazy } from 'react';
import { RouteObject } from 'react-router-dom';
import { PublicGuard } from './guards/PublicGuard';

const LandingPage = lazy(() =>
  import('../pages/public/LandingPage').then(module => ({ default: module.LandingPage }))
);
const LoginPage = lazy(() =>
  import('../pages/public/LoginPage').then(module => ({ default: module.LoginPage }))
);

export const publicRoutes: RouteObject[] = [
  {
    path: '/',
    element: <LandingPage />,
  },
  {
    path: '/login',
    element: (
      <PublicGuard>
        <LoginPage />
      </PublicGuard>
    ),
  },
];
