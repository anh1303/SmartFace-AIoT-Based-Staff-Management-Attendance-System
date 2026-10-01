import { apiFetch } from './client';

export interface BiometricSample {
  id: string;
  employee_id: string;
  model_version: string;
  sample_tag: string | null;
  quality_score: number | null;
  is_active: boolean;
  created_at: string;
}

export interface BiometricResponse {
  employeeId: string;
  sampleCount: number;
  samples: BiometricSample[];
}

/**
 * Lấy thông tin mẫu sinh trắc học của nhân viên
 */
export async function fetchEmployeeBiometricsApi(employeeId: string): Promise<BiometricResponse> {
  const res = await apiFetch(`/api/biometrics/${employeeId}`);
  return res.data as BiometricResponse;
}

export interface EnrollFaceResult {
  status: string;
  employee_id: string;
  employee_code: string;
  total_images: number;
  detected_faces: number;
  n_samples_used: number;
  n_outliers_removed: number;
  extraction_rate: number;
  valid_rate?: number;
  message?: string;
  warnings?: string[];
}

/**
 * Gửi danh sách ảnh khuôn mặt (Base64) để trích xuất vector và cập nhật sinh trắc học
 */
export async function enrollFaceImagesApi(employeeId: string, imagesBase64: string[]): Promise<EnrollFaceResult> {
  const res = await apiFetch(`/api/biometrics/${employeeId}/enroll-images`, {
    method: 'POST',
    body: JSON.stringify({ images: imagesBase64 }),
  });
  return res.data as EnrollFaceResult;
}

/**
 * Xóa toàn bộ dữ liệu sinh trắc học khuôn mặt của nhân viên
 */
export async function deleteEmployeeBiometricsApi(employeeId: string) {
  const res = await apiFetch(`/api/biometrics/${employeeId}`, {
    method: 'DELETE',
  });
  return res.data;
}
