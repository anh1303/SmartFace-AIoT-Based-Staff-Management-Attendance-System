// @vitest-environment jsdom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { describe, it, expect } from 'vitest';
import { formatRelativeTime } from '../../src/features/notifications/utils/timeAgo';
import { NotificationEmptyState } from '../../src/features/notifications/components/NotificationEmptyState';

describe('Floating Notifications Feature', () => {
  it('formats relative time accurately in Vietnamese', () => {
    const now = new Date();
    expect(formatRelativeTime(now.toISOString())).toBe('Vừa xong');

    const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);
    expect(formatRelativeTime(twoMinutesAgo.toISOString())).toBe('2 phút trước');

    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    expect(formatRelativeTime(twoHoursAgo.toISOString())).toBe('2 giờ trước');
  });

  it('renders NotificationEmptyState correctly with Không có thông báo mới text', () => {
    const html = renderToStaticMarkup(<NotificationEmptyState />);
    expect(html).toContain('Không có thông báo mới');
  });

});

