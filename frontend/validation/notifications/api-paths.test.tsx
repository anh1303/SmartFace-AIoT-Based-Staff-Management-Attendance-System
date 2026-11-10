// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { NotificationProvider, useNotifications } from '../../src/features/notifications/context/NotificationContext'

vi.mock('../../src/config', () => ({ config: { apiBaseUrl: '' } }))
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

it('loads, reads and deletes notifications using the mounted /api routes', async () => {
  const requests: Array<{ url: string; method?: string }> = []
  vi.stubEnv('VITE_DEMO_MODE', 'false')
  vi.stubGlobal('fetch', vi.fn(async (url: string, options: RequestInit) => {
    requests.push({ url, method: options.method })
    if (!/^\/api\/notifications(?:\/42)?$/.test(url)) return new Response('', { status: 404 })
    const data = options.method === 'GET' ? [{ id: 'server_42', title: 'DB alert', message: 'Actual server item', timestamp: new Date().toISOString(), type: 'warning', read: false }] : { updated: true }
    return new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }))
  sessionStorage.setItem('userSession', 'test-session')
  let model!: ReturnType<typeof useNotifications>
  function Probe() { model = useNotifications(); return null }
  const host = document.createElement('div'); document.body.appendChild(host)
  const root = createRoot(host)
  try {
    await act(async () => root.render(<NotificationProvider><Probe /></NotificationProvider>))
    expect(model.notifications.map(item => item.id)).toContain('server_42')
    await act(async () => { await model.markAsRead('server_42'); await model.removeNotification('server_42'); await model.markAllAsRead(); await model.clearAll() })
    expect(requests).toEqual([
      { url: '/api/notifications', method: 'GET' },
      { url: '/api/notifications/42', method: 'PATCH' },
      { url: '/api/notifications/42', method: 'PATCH' },
      { url: '/api/notifications', method: 'PATCH' },
      { url: '/api/notifications', method: 'PATCH' },
    ])
    expect(model.notifications).toEqual([])
  } finally {
    await act(async () => root.unmount())
    host.remove(); sessionStorage.clear(); vi.unstubAllGlobals(); vi.unstubAllEnvs()
  }
})
