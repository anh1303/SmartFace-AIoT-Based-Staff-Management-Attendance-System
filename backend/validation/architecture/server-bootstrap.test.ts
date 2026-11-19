import { describe, expect, it, vi } from 'vitest';
import {
  listRegisteredOperationHandlers,
  startOperationWorker,
  stopOperationWorker,
} from '../../src/modules/operations/index.js';
import { apiRouter } from '../../src/routes.js';
import { registerServerBootstrap } from '../../src/server.js';

describe('Backend server bootstrap contract (Phase 2 Batch 1)', () => {
  it('registers all three background operation handlers and initializes socket gateways through public module entries', async () => {
    const namespaces = new Set<string>();
    const fakeNamespace = () => ({
      use: vi.fn(),
      on: vi.fn(),
      emit: vi.fn(),
      to: vi.fn(() => ({ emit: vi.fn(), except: vi.fn(() => ({ emit: vi.fn() })) })),
      sockets: new Map(),
    });
    const fakeIo = {
      use: vi.fn(),
      on: vi.fn(),
      of: vi.fn((nsp: string) => {
        namespaces.add(nsp);
        return fakeNamespace();
      }),
    };

    registerServerBootstrap(fakeIo as any);

    expect(fakeIo.use).toHaveBeenCalledTimes(1);
    expect(namespaces.has('/operations')).toBe(true);
    expect(listRegisteredOperationHandlers()).toEqual([
      'biometric.enroll',
      'employee.email',
      'shifts.batch',
    ]);

    startOperationWorker();
    await stopOperationWorker();

    expect(apiRouter).toBeDefined();
  });
});
