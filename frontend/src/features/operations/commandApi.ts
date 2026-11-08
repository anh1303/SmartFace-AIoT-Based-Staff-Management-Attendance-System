import { ApiError, apiFetch } from '../../api/client';
import type { Operation } from './OperationsProvider';
import { getActiveSessionId, getActiveUsername } from '../../context/AuthContext';
export class UncertainWriteError extends Error {}
function assertSession(session: number) {
  if (getActiveSessionId() !== session) throw new UncertainWriteError('Phiên đăng nhập đã thay đổi. Vui lòng tải lại dữ liệu.');
}

export class OperationFailedError extends Error {
  constructor(public operation: Operation) {
    const details = operation.items?.filter(item => item.status === 'failed').slice(0, 5)
      .map(item => `${item.item_key}: ${item.error || 'Không lưu được'}`).join('; ');
    super(`${operation.progress.succeeded} thành công, ${operation.progress.failed} lỗi, ${operation.progress.skipped} bỏ qua.${details ? ` ${details}` : operation.error ? ` ${operation.error}` : ''}`);
  }
}

export async function waitForOperation(initial: Operation): Promise<Operation> {
  const session = getActiveSessionId();
  const deadline = Date.now() + 10 * 60_000;
  let job = initial;
  let failures = 0;
  while (job.status === 'queued' || job.status === 'running') {
    if (getActiveSessionId() !== session) throw new UncertainWriteError('Phiên đăng nhập đã thay đổi. Vui lòng tải lại dữ liệu.');
    if (Date.now() > deadline) throw new UncertainWriteError('Chưa xác định kết quả. Thử lại cùng nội dung để tiếp tục kiểm tra yêu cầu đã gửi.');
    try {
      const response = await apiFetch<Operation>(`/api/operations/${job.jobId}`);
      if (!response.data) throw new Error('Thiếu kết quả thao tác');
      job = response.data; failures = 0;
    } catch (error) {
      if (definitiveFailure(error) || ++failures >= 3) throw new UncertainWriteError('Chưa kết nối được để xác nhận kết quả. Thử lại cùng nội dung để kiểm tra, không tạo yêu cầu mới.');
    }
    if (job.status === 'queued' || job.status === 'running') await new Promise(resolve => window.setTimeout(resolve, 1500));
  }
  if (getActiveSessionId() !== session) throw new UncertainWriteError('Phiên đăng nhập đã thay đổi. Vui lòng tải lại dữ liệu.');
  if (job.status !== 'succeeded') throw new OperationFailedError(job);
  return job;
}

// Keep only the job ID while the outcome is unknown, so retries resume the original write.
export async function submitAndWait(endpoint: string, body: unknown): Promise<Operation> {
  const session = getActiveSessionId();
  const request = await commandKey(endpoint, body);
  assertSession(session);
  const pendingKey = `${request.storageKey}:job`;
  const previous = sessionStorage.getItem(pendingKey);
  const job = previous
    ? (await apiFetch<Operation>(`/api/operations/${previous}`)).data!
    : await submitBackgroundCommand(endpoint, body);
  assertSession(session);
  sessionStorage.setItem(pendingKey, job.jobId);
  try {
    const result = await waitForOperation(job);
    assertSession(session);
    sessionStorage.removeItem(pendingKey); sessionStorage.removeItem(request.storageKey);
    return result;
  } catch (error) {
    if (error instanceof OperationFailedError) { sessionStorage.removeItem(pendingKey); sessionStorage.removeItem(request.storageKey); }
    throw error;
  }
}

// Only a digest and request ID are persisted. Images, credentials and form contents stay out of storage.
export async function commandKey(endpoint: string, body: unknown) {
  const session = getActiveSessionId();
  const owner = getActiveUsername();
  if (!owner) throw new UncertainWriteError('Vui lòng đăng nhập trước khi lưu dữ liệu.');
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([owner, endpoint, body])));
  assertSession(session);
  const digest = Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
  const storageKey = `smartface_pending_command:${digest}`;
  const existing = sessionStorage.getItem(storageKey);
  const key = existing || crypto.randomUUID();
  sessionStorage.setItem(storageKey, key);
  return { key, storageKey };
}
export const definitiveFailure = (error: unknown) => error instanceof ApiError && error.statusCode >= 400 && error.statusCode < 500;

export async function submitBackgroundCommand(endpoint: string, body: unknown): Promise<Operation> {
  const session = getActiveSessionId();
  const request = await commandKey(endpoint, body);
  assertSession(session);
  try {
    const response = await apiFetch<Operation>(endpoint, { method: 'POST', headers: { 'Idempotency-Key': request.key }, body: JSON.stringify(body) });
    assertSession(session);
    sessionStorage.removeItem(request.storageKey);
    return response.data!;
  } catch (error) {
    assertSession(session);
    if (definitiveFailure(error)) { sessionStorage.removeItem(request.storageKey); throw error; }
    try {
      const response = await apiFetch<Operation>(`/api/operations/by-key/${request.key}`);
      assertSession(session);
      sessionStorage.removeItem(request.storageKey);
      return response.data!;
    } catch {
      throw new UncertainWriteError('Chưa xác định máy chủ đã nhận yêu cầu hay chưa. Thử lại cùng nội dung để kiểm tra bằng mã yêu cầu cũ.');
    }
  }
}
