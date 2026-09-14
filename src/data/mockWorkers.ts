// ============================================================
// H₂S Worker Safety Monitoring — Mock Worker Data
// ============================================================
// THREE-SCAN MODEL: Morning / Lunch Break / Evening Break
//
// Cumulative Exposure = Morning + Lunch + Evening
// Status = DANGER if cumulative >= 10 ppm
//
// When backend is ready: replace mock exposure values with
// actual values returned by the ML/camera pipeline.
// Worker interface remains unchanged.
// ============================================================

import type { Worker, Shift, ShiftLabel, DailyExposure, ScanStatus, WorkerStatus } from './types';

const SHIFTS: Record<ShiftLabel, Shift> = {
  Morning:   { label: 'Morning',   start: '08:00 AM', end: '04:00 PM' },
  Afternoon: { label: 'Afternoon', start: '04:00 PM', end: '12:00 AM' },
  Night:     { label: 'Night',     start: '12:00 AM', end: '08:00 AM' },
};

const DEPARTMENTS = [
  'Extraction Unit A',
  'Extraction Unit B',
  'Processing Plant',
  'Pipeline Section 1',
  'Pipeline Section 2',
  'Maintenance Crew',
  'Safety Team',
];

const WORKER_NAMES = [
  'Santhosh R',     'Arjun Kumar',     'Priya Devi',      'Mohammed Faisal', 'Kavitha S',
  'Rajesh Nair',    'Deepa Menon',     'Suresh Babu',     'Anitha V',        'Vijay Krishnan',
  'Lakshmi P',      'Ramesh D',        'Sunitha M',       'Manoj George',    'Sreeja A',
  'Arun Prasad',    'Meera Nair',      'Biju Thomas',     'Nisha K',         'Sujith P',
  'Harish L',       'Divya R',         'Prakash N',       'Sindhu M',        'Kiran P',
  'Vivek S',        'Reshma T',        'Dinesh B',        'Parvathy N',      'Ashok K',
  'Jisha C',        'Unnikrishnan P',  'Asha R',          'Sreekanth M',     'Bindu V',
  'Gopinath S',     'Rema L',          'Sajeev K',        'Thankamani R',    'Sijo M',
  'Girish T',       'Nirmala S',       'Sreedharan K',    'Beena J',         'Rajan M',
  'Leela S',        'Prasanth K',      'Suma R',          'Chandran N',      'Rani V',
];

function maskMobile(suffix: string): string {
  return 'XXXXXXXX' + suffix;
}

const MOBILE_SUFFIXES = [
  '10','09','98','87','55','44','33','22','33','44',
  '55','66','22','33','44','55','11','22','33','44',
  '22','11','00','99','00','99','88','77','66','55',
  '44','33','22','11','00','99','88','77','66','55',
  '44','33','22','11','00','99','88','77','66','55',
];

const SHIFT_LABELS: ShiftLabel[] = ['Morning', 'Afternoon', 'Night'];

// ─── Scan time labels per shift ───────────────────────────────
const LAST_SCAN_LABELS: Record<ShiftLabel, Record<'morning' | 'lunch' | 'evening', string>> = {
  Morning:   { morning: '08:30 AM', lunch: '12:30 PM', evening: '03:30 PM' },
  Afternoon: { morning: '04:30 PM', lunch: '08:30 PM', evening: '11:30 PM' },
  Night:     { morning: '12:30 AM', lunch: '04:30 AM', evening: '07:30 AM' },
};

// ─── Compute status from cumulative ───────────────────────────
// H₂S danger threshold: 10 ppm cumulative per shift
function deriveStatus(cumulative: number): WorkerStatus {
  return cumulative >= 10 ? 'DANGER' : 'SAFE';
}

// ─── Generate realistic 3-scan exposure for a worker ──────────
// isDanger = true → at least one scan is high, cumulative >= 10
// scanPattern controls which scans are completed:
//   'all'     → all three done
//   'no-eve'  → evening pending
//   'no-lunch'→ lunch + evening pending (only morning done)
type ScanPattern = 'all' | 'no-eve' | 'no-lunch';

function makeScanValue(base: number, spread: number): number {
  return parseFloat((base + (Math.random() - 0.5) * spread).toFixed(1));
}

function generateExposure(
  isDanger: boolean,
  pattern: ScanPattern
): { exposure: DailyExposure; scanStatus: ScanStatus } {
  let morning: number | null = null;
  let lunch:   number | null = null;
  let evening: number | null = null;

  if (isDanger) {
    // Danger workers have higher individual readings
    morning = makeScanValue(4.5, 3);   // 3.0 – 6.0
    lunch   = makeScanValue(5.2, 3);   // 3.7 – 6.7
    evening = makeScanValue(6.1, 3);   // 4.6 – 7.6
  } else {
    morning = makeScanValue(2.2, 2.5); // 0.95 – 3.45
    lunch   = makeScanValue(2.8, 2.5); // 1.55 – 4.05
    evening = makeScanValue(3.1, 2.5); // 1.85 – 4.35
  }

  // Enforce minimum 0.1
  morning = Math.max(0.1, morning);
  lunch   = Math.max(0.1, lunch);
  evening = Math.max(0.1, evening);

  // Apply scan pattern — missing scans are null
  let scanStatus: ScanStatus = { morning: true, lunch: true, evening: true };
  if (pattern === 'no-eve') {
    evening   = null;
    scanStatus = { morning: true, lunch: true, evening: false };
  } else if (pattern === 'no-lunch') {
    lunch      = null;
    evening    = null;
    scanStatus = { morning: true, lunch: false, evening: false };
  }

  const cumulative = parseFloat(
    [(morning ?? 0), (lunch ?? 0), (evening ?? 0)].reduce((a, b) => a + b, 0).toFixed(1)
  );

  return {
    exposure: { morning, lunch, evening, cumulative },
    scanStatus,
  };
}

function randomJoinDate(): string {
  const year  = 2018 + Math.floor(Math.random() * 6);
  const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  const day   = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ─── Worker assignment ────────────────────────────────────────
// 50 workers:
//   8  in DANGER (cumulative >= 10) — indices 3,7,12,18,24,31,38,44
//   all others SAFE
//   ~10 workers with incomplete scans (mix of no-eve and no-lunch)
const DANGER_INDICES   = new Set([3, 7, 12, 18, 24, 31, 38, 44]);
const NO_EVE_INDICES   = new Set([5, 10, 15, 20, 25, 35, 40]);   // evening pending
const NO_LUNCH_INDICES = new Set([8, 22, 30, 46]);                // lunch+evening pending

function getScanPattern(i: number): ScanPattern {
  if (NO_LUNCH_INDICES.has(i)) return 'no-lunch';
  if (NO_EVE_INDICES.has(i))   return 'no-eve';
  return 'all';
}

function getLastScan(shift: ShiftLabel, pattern: ScanPattern): string {
  const labels = LAST_SCAN_LABELS[shift];
  if (pattern === 'all')      return `Evening · ${labels.evening}`;
  if (pattern === 'no-eve')   return `Lunch · ${labels.lunch}`;
  if (pattern === 'no-lunch') return `Morning · ${labels.morning}`;
  return '—';
}

export const mockWorkers: Worker[] = WORKER_NAMES.map((name, i) => {
  const isDanger    = DANGER_INDICES.has(i);
  const pattern     = getScanPattern(i);
  const shiftLabel  = SHIFT_LABELS[i % 3];
  const isWorking   = i < 45;

  const { exposure, scanStatus } = generateExposure(isDanger, pattern);
  const status = deriveStatus(exposure.cumulative);

  return {
    workerId:   `W${1024 + i}`,
    name,
    mobile:     maskMobile(MOBILE_SUFFIXES[i]),
    shift:      SHIFTS[shiftLabel],
    exposure,
    scanStatus,
    status,
    isWorking,
    lastScan:   isWorking ? getLastScan(shiftLabel, pattern) : '—',
    department: DEPARTMENTS[i % DEPARTMENTS.length],
    joinDate:   randomJoinDate(),
  };
});
