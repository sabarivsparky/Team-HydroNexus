// ============================================================
// HydroNexus H2S Dosimeter — API domain types
// ============================================================

export type Role = 'admin' | 'worker';

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface User {
  id: number;
  name: string;
  email: string;
  employee_id: string;
  role: Role;
  department?: string | null;
  mobile?: string | null;
}

export interface Wristband {
  id: number;
  qr_id: string;
  manufacture_date: string;
  expiry_date: string;
  status: 'unassigned' | 'assigned' | 'used' | 'invalid';
  assigned_worker_id?: number | null;
  worker_name?: string | null;
  is_expired: boolean;
  can_use?: boolean;
}

export type ReadingStatus = 'valid' | 'rejected_expired' | 'rejected_quality';
export type ShiftLabel = 'Morning' | 'Afternoon' | 'Night';

export interface ReadingFeatures {
  L?: number;
  a?: number;
  b?: number;
  delta_e?: number;
  delta_e_env?: number;
}

export interface Reading {
  id: number;
  ref: string;
  worker_id: number;
  worker_name?: string | null;
  employee_id?: string | null;
  department?: string | null;
  band_qr?: string | null;
  shift_label?: ShiftLabel | null;
  timestamp: string;
  estimated_dose: number | null;
  expiry_status: 'VALID' | 'EXPIRED';
  reading_status: ReadingStatus;
  temperature_c?: number | null;
  humidity_pct?: number | null;
  model_version?: string | null;
  source: 'photo' | 'simulated' | 'seed';
  features: ReadingFeatures;
  image_original?: string | null;
  image_rectified?: string | null;
  high_exposure?: boolean;
}

export interface PredictionDiagnostics {
  band_id_qr: string | null;
  expiry_status: 'VALID' | 'EXPIRED';
  strip_rgb: number[];
  strip_lab: number[];
  delta_e: number;
  delta_e_env: number;
  correction_residual: number;
  brightness: number;
  blur_score: number;
  reference_measured: number[][];
  reference_expected: number[][];
}

export interface PredictionResponse {
  reading: Reading;
  estimated_dose: number | null;
  model_version: string | null;
  is_estimate: boolean;
  simulated: boolean;
  message: string;
  diagnostics: PredictionDiagnostics;
}

export interface DashboardSummary {
  total_workers: number;
  active_bands: number;
  assigned_bands: number;
  used_bands: number;
  unassigned_bands: number;
  expired_bands: number;
  invalid_bands: number;
  readings_today: number;
  total_readings: number;
  high_exposure_today: number;
  cumulative_dose_today: number;
  average_dose_today: number;
  max_dose_today: number;
  action_level: number;
  active_model: string | null;
  model_ready: boolean;
  simulated_calibration: boolean;
}

export interface WorkerSummary {
  id: number;
  name: string;
  email: string;
  employee_id: string;
  department?: string | null;
  mobile?: string | null;
  role: Role;
  band_qr?: string | null;
  band_status?: string | null;
  band_expiry?: string | null;
  today_readings: number;
  today_cumulative_dose: number;
  latest_dose?: number | null;
  latest_status?: string | null;
  latest_timestamp?: string | null;
  status: 'SAFE' | 'DANGER';
  action_level: number;
}

export interface TrendPoint {
  date: string;
  readings: number;
  average_dose: number;
  max_dose: number;
  high_exposure: number;
}

export interface ReportRow {
  worker_id: number;
  employee_id: string;
  name: string;
  department?: string | null;
  band_qr?: string | null;
  shift_label?: string | null;
  readings: number;
  cumulative_dose: number;
  max_dose: number;
  average_dose: number;
  latest_status: string;
}

export interface ShiftSummary {
  shift: ShiftLabel;
  readings: number;
  cumulative_dose: number;
  average_dose: number;
  max_dose: number;
  high_exposure: number;
}

export interface ModelInfo {
  id: number;
  version: string;
  model_type: string;
  is_active: boolean;
  simulated_calibration: boolean;
  trained_at: string;
  metrics?: Record<string, {
    cv_mae: number; cv_r2: number; test_mae: number; test_r2: number;
  }> | null;
  on_disk: boolean;
}

export interface CalibrationPoint {
  id: number;
  dose_ppm_hr: number;
  concentration_ppm?: number | null;
  duration_hours?: number | null;
  temp_c?: number | null;
  rh_pct?: number | null;
  source: string;
  features: ReadingFeatures;
}

export interface ApiError {
  code: string;
  message: string;
}
