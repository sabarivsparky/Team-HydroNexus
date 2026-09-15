// ============================================================
// Typed API client for the FastAPI backend.
// All calls are relative (/api/...) so Vite's dev proxy and any
// production reverse proxy route them correctly.
// ============================================================

import type {
  CalibrationPoint,
  DashboardSummary,
  ModelInfo,
  PredictionResponse,
  Reading,
  ReportRow,
  ShiftLabel,
  ShiftSummary,
  TokenResponse,
  TrendPoint,
  User,
  WorkerSummary,
  Wristband,
} from '../types/api';

const BASE = '/api';
const TOKEN_KEY = 'hydronexus_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ClientError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  const token = tokenStore.get();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    // FastAPI validation/error bodies: {detail: {code,message}} or
    // {detail: "..."} or {detail: [{msg...}]}
    const detail = (data as { detail?: unknown })?.detail;
    if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
      const d = detail as { code?: string; message?: string };
      throw new ClientError(res.status, d.code ?? 'ERROR',
        d.message ?? 'Request failed');
    }
    const message =
      typeof detail === 'string'
        ? detail
        : res.status === 401
          ? 'Please log in again.'
          : 'Request failed. Please try again.';
    throw new ClientError(res.status, 'ERROR', message);
  }
  return data as T;
}

// ─── Auth ────────────────────────────────────────────────────

export const api = {
  login(email: string, password: string) {
    return request<TokenResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  me() {
    return request<User>('/auth/me');
  },

  // ─── Workers / admin ─────────────────────────────────────
  listWorkers(query = '', status = '') {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (status) params.set('status', status);
    const qs = params.toString();
    return request<WorkerSummary[]>(`/workers${qs ? `?${qs}` : ''}`);
  },

  worker(id: number) {
    return request<WorkerSummary>(`/workers/${id}`);
  },

  workerReadings(id: number, limit = 100) {
    return request<Reading[]>(`/workers/${id}/readings?limit=${limit}`);
  },

  mySummary() {
    return request<WorkerSummary>('/workers/me/summary');
  },

  myReadings(limit = 50) {
    return request<Reading[]>(`/workers/me/readings?limit=${limit}`);
  },

  // ─── Bands ───────────────────────────────────────────────
  listBands(status?: string) {
    const qs = status ? `?status=${status}` : '';
    return request<Wristband[]>(`/bands${qs}`);
  },

  lookupBand(qrId: string) {
    return request<Wristband>(`/bands/lookup/${encodeURIComponent(qrId)}`);
  },

  registerBatch(count: number) {
    return request<{ created: number; bands: Wristband[] }>('/bands/batch', {
      method: 'POST',
      body: JSON.stringify({ count, prefix: 'H2S-', shelf_life_days: 90 }),
    });
  },

  // ─── Readings ────────────────────────────────────────────
  predictPhoto(file: Blob, bandQrId: string, shiftLabel: ShiftLabel,
               tempC?: number, rhPct?: number) {
    const form = new FormData();
    form.append('file', file, 'capture.jpg');
    form.append('band_qr_id', bandQrId);
    form.append('shift_label', shiftLabel);
    if (Number.isFinite(tempC)) form.append('temp_c', String(tempC));
    if (Number.isFinite(rhPct)) form.append('rh_pct', String(rhPct));
    return request<PredictionResponse>('/readings/predict', {
      method: 'POST',
      body: form,
    });
  },

  simulateCapture(input: {
    band_qr_id: string;
    dose_ppm_hr?: number | null;
    temp_c: number;
    rh_pct: number;
    shift_label: ShiftLabel;
    force_expired?: boolean;
  }) {
    return request<PredictionResponse>('/readings/simulate', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  readings(limit = 100, days?: number) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (days) params.set('days', String(days));
    return request<Reading[]>(`/readings?${params.toString()}`);
  },

  // ─── Admin analytics ─────────────────────────────────────
  summary() {
    return request<DashboardSummary>('/admin/summary');
  },

  trends(days = 14) {
    return request<TrendPoint[]>(`/admin/trends?days=${days}`);
  },

  reports(days = 7) {
    return request<ReportRow[]>(`/admin/reports?days=${days}`);
  },

  shiftsToday() {
    return request<ShiftSummary[]>('/admin/shifts/today');
  },

  models() {
    return request<ModelInfo[]>('/models');
  },

  calibration(limit = 1000) {
    return request<CalibrationPoint[]>(`/calibration?limit=${limit}`);
  },
};

/** Join a backend-returned media path (already includes /api) to origin. */
export function mediaUrl(path?: string | null): string | undefined {
  return path ?? undefined;
}
