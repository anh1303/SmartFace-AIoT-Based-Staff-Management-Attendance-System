// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, it, vi } from 'vitest'

const socket = vi.hoisted(() => ({ handlers: {} as Record<string, (...args: any[]) => void>, on(name: string, fn: (...args: any[]) => void) { this.handlers[name] = fn }, disconnect: vi.fn() }))
vi.mock('socket.io-client', () => ({ io: () => socket }))
import { useAttendanceSocket } from '../../src/features/attendances/hooks/useAttendanceSocket'
import { LiveEventFeed } from '../../src/features/attendances/components/LiveEventFeed'

it('shows a flagged scan as a warning rather than a successful check-in', async () => {
  ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
  const toast = vi.fn()
  function Monitor() {
    const { liveEvents, isSocketConnected, clearEvents } = useAttendanceSocket({ showToast: toast })
    return <LiveEventFeed events={liveEvents} onClear={clearEvents} isSocketConnected={isSocketConnected} />
  }
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  await act(async () => root.render(<QueryClientProvider client={new QueryClient()}><Monitor /></QueryClientProvider>))
  await act(async () => socket.handlers['attendance-flagged']?.({ event_id: 'event-1', employee_id: 'NV01', device_id: 'gate', timestamp: '2026-10-15T03:00:00Z' }))
  expect(host.textContent).toContain('TỪ CHỐI')
  expect(host.textContent).toContain('NV01')
  expect(toast).toHaveBeenCalledWith(expect.any(String), 'warning')
  await act(async () => root.unmount())
  host.remove()
})
