import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { PublicGuard } from './PublicGuard';

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ currentUser: { role: 'manager' }, isInitializing: false }),
}));
vi.mock('react-router-dom', () => ({
  useLocation: () => ({ state: { from: { pathname: '/app/manager/employees' } } }),
  Navigate: ({ to }: { to: string }) => <span>{to}</span>,
  Outlet: () => null,
}));

describe('PublicGuard', () => {
  it('opens the dashboard even when login has a previous destination', () => {
    expect(renderToString(<PublicGuard />)).toContain('/app/manager/dashboard');
  });
});
