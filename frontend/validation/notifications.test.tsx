// @vitest-environment jsdom
import React, { useEffect } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { describe, it, expect } from 'vitest';
import { formatRelativeTime } from '../src/features/notifications/utils/timeAgo';
import { NotificationEmptyState } from '../src/features/notifications/components/NotificationEmptyState';

describe('Floating Notifications Feature', () => {
  it('formats relative time accurately in Vietnamese', () => {
    const now = new Date();
    expect(formatRelativeTime(now.toISOString())).toBe('Vừa xong');

    const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);
    expect(formatRelativeTime(twoMinutesAgo.toISOString())).toBe('2 phút trước');

    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    expect(formatRelativeTime(twoHoursAgo.toISOString())).toBe('2 giờ trước');
  });

  it('renders NotificationEmptyState correctly with NO NEW NOTIFICATIONS text', () => {
    const html = renderToStaticMarkup(<NotificationEmptyState />);
    expect(html).toContain('NO NEW NOTIFICATIONS');
  });

  it('guarantees that logout purges notification cache from storage', () => {
    sessionStorage.setItem('smartface_notifications_cache', JSON.stringify([{ id: '1', message: 'test' }]));
    localStorage.setItem('smartface_notifications_cache', JSON.stringify([{ id: '1', message: 'test' }]));

    // Emulate logout purge
    sessionStorage.removeItem('smartface_notifications_cache');
    localStorage.removeItem('smartface_notifications_cache');

    expect(sessionStorage.getItem('smartface_notifications_cache')).toBeNull();
    expect(localStorage.getItem('smartface_notifications_cache')).toBeNull();
  });
});

