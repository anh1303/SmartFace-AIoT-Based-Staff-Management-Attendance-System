// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { ActionButton, ActionForm } from '../../src/components/common/ActionFeedback';
import { Modal } from '../../src/components/common/Modal';

it('keeps the action and dialog locked until the request settles, then allows retry on failure', async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  let reject!: (error: Error) => void;
  const save = vi.fn(() => new Promise<void>((_, no) => { reject = no; }));
  const close = vi.fn();
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<Modal isOpen onClose={close} title="Test"><ActionForm onSubmit={save}><input defaultValue="draft"/><ActionButton type="submit" busyLabel="Đang thêm…">Thêm</ActionButton></ActionForm></Modal>));
  const form = document.querySelector('form')!;
  await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  expect(save).toHaveBeenCalledTimes(1);
  expect(document.body.textContent).toContain('Đang thêm…');
  expect(document.querySelector('fieldset')!.disabled).toBe(true);
  await act(async () => { (document.querySelector('[aria-label="Đóng hộp thoại"]') as HTMLButtonElement).click(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
  expect(close).not.toHaveBeenCalled();
  await act(async () => { reject(new Error('Không lưu được')); });
  expect(document.querySelector('[role="alert"]')!.textContent).toContain('Không lưu được');
  expect(document.querySelector('input')!.value).toBe('draft');
  expect(document.querySelector('fieldset')!.disabled).toBe(false);
  await act(async () => root.unmount()); host.remove();
});
