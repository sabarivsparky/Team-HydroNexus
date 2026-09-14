// ============================================================
// H₂S Worker Safety Monitoring — Data Types & Interfaces
// ============================================================
// THREE-SCAN MODEL: Each worker completes exactly 3 scans per day:
//   1. Morning Scan
//   2. Lunch Break Scan
//   3. Evening Break Scan
//
// Cumulative = Morning + Lunch + Evening
//
// Future integration: replace mock exposure values with real
// values from ML/camera pipeline — interface stays unchanged.
// ============================================================

export type WorkerStatus = 'SAFE' | 'DANGER';

export type ShiftLabel = 'Morning' | 'Afternoon' | 'Night';

export interface Shift {
  label: ShiftLabel;
  start: string; // "08:00 AM"
  end:   string; // "04:00 PM"
}

// ─── Three-Scan Daily Exposure ────────────────────────────────
// null = scan not yet completed for this period
export interface DailyExposure {
  morning:    number | null; // ppm — from morning scan
  lunch:      number | null; // ppm — from lunch break scan
  evening:    number | null; // ppm — from evening break scan
  cumulative: number;        // sum of all completed scans
}

// ─── Scan Completion Status ───────────────────────────────────
// Tracks whether each of the 3 daily scans has been performed
export interface ScanStatus {
  morning: boolean; // Lead Acetate Strip scanned in morning?
  lunch:   boolean; // Scanned at lunch break?
  evening: boolean; // Scanned at evening break?
}

// ─── Worker ───────────────────────────────────────────────────
export interface Worker {
  workerId:   string;       // e.g. "W1024"
  name:       string;
  mobile:     string;       // masked, e.g. "XXXXXXXX90"
  shift:      Shift;
  exposure:   DailyExposure;
  scanStatus: ScanStatus;
  status:     WorkerStatus; // derived from cumulative exposure
  isWorking:  boolean;
  lastScan:   string;       // e.g. "Lunch · 11:30 AM"
  department: string;
  joinDate:   string;       // ISO date "2023-01-15"
}

// ─── Dashboard Summary ────────────────────────────────────────
export interface DashboardSummary {
  totalWorkers:          number;
  safeWorkers:           number;
  dangerWorkers:         number;
  workingWorkers:        number;
  allScansCompleted:     number; // workers with morning+lunch+evening done
  incompleteScans:       number; // workers missing ≥1 scan
  totalCumulativeExposure: number;
}

// ─── Reports ─────────────────────────────────────────────────
export interface WorkerExposureSummary {
  workerId:           string;
  name:               string;
  shift:              string;
  morningExposure:    number | null;
  lunchExposure:      number | null;
  eveningExposure:    number | null;
  cumulativeExposure: number;
  status:             WorkerStatus;
  scansCompleted:     number; // 0, 1, 2, or 3
}

// ─── Settings ────────────────────────────────────────────────
export interface AdminProfile {
  name:  string;
  email: string;
  role:  string;
}

export interface NotificationPreferences {
  dangerAlerts:       boolean;
  missedScanAlerts:   boolean;
  shiftSummary:       boolean;
  dailyReport:        boolean;
  emailNotifications: boolean;
}

export interface DashboardPreferences {
  autoRefreshInterval:    number; // seconds; 0 = disabled
  theme:                  'dark' | 'light';
  defaultPage:            string;
  showCumulativeOnCards:  boolean;
}

export interface AppSettings {
  adminProfile:   AdminProfile;
  notifications:  NotificationPreferences;
  dashboard:      DashboardPreferences;
}

// ─── Auth ─────────────────────────────────────────────────────
export interface AdminCredentials {
  email:    string;
  password: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  adminName:       string;
}

// ─── Chart data shapes ────────────────────────────────────────
// Three-point exposure visualization: Morning → Lunch → Evening
export interface ThreePointExposure {
  name:      string;       // worker first name
  workerId:  string;
  morning:   number;
  lunch:     number;
  evening:   number;
  status:    WorkerStatus;
}

export interface ScanPeriodAverage {
  period:    'Morning' | 'Lunch' | 'Evening';
  average:   number;
  max:       number;
  dangerCount: number;
}
