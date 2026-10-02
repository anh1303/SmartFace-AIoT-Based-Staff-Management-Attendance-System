export interface BiometricEnrolledItem {
  id?: string;
  employee_id: string;
  type: 'FACE' | 'FINGERPRINT';
  feature_version?: string;
  enrolled_at?: string;
  device_source?: string;
}

export interface BiometricSample {
  image_base64?: string;
  template_base64?: string;
  format?: string;
  score?: number;
}
