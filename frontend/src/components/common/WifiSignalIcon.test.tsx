import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WifiSignalIcon } from './WifiSignalIcon';

describe('Wi-Fi signal display shared by device settings', () => {
  it.each([
    [0, 'wifi-zero', 'text-rose-500'],
    [24, 'wifi-zero', 'text-rose-500'],
    [25, 'wifi-low', 'text-amber-500'],
    [49, 'wifi-low', 'text-amber-500'],
    [50, 'wifi-high', 'text-emerald-500 dark:text-emerald-400'],
    [74, 'wifi-high', 'text-emerald-500 dark:text-emerald-400'],
    [75, 'wifi', 'text-emerald-500'],
    [100, 'wifi', 'text-emerald-500'],
  ])('renders signal %s with the existing icon and color', (signal, icon, color) => {
    const markup = renderToStaticMarkup(<WifiSignalIcon signal={signal} />);
    expect(markup).toContain(`lucide-${icon} `);
    expect(markup).toContain(`w-4 h-4 shrink-0 ${color}`);
  });

  it('preserves the caller size instead of adding the default size', () => {
    const markup = renderToStaticMarkup(<WifiSignalIcon signal={60} className="w-5 h-5" />);
    expect(markup).toContain('w-5 h-5 text-emerald-500');
    expect(markup).not.toContain('w-4 h-4');
  });
});
