// ============================================================
// H₂S Worker Safety Monitoring — Centralized Data Service
// ============================================================
// THREE-SCAN MODEL: Morning / Lunch / Evening scans per day.
// Cumulative Exposure = Morning + Lunch + Evening.
//
// ALL data access goes through this service.
// To connect real backend later:
//   1. Replace mock imports with async API calls
//   2. Keep function signatures identical
//   3. No changes needed in UI components
// ============================================================

import type {
  Worker,
  DashboardSummary,
  WorkerExposureSummary,
  ThreePointExposure,
  ScanPeriodAverage,
  ShiftLabel,
} from './types';
import { mockWorkers } from './mockWorkers';

// ─── Helpers ──────────────────────────────────────────────────

function scansCompleted(w: Worker): number {
  return [w.scanStatus.morning, w.scanStatus.lunch, w.scanStatus.evening]
    .filter(Boolean).length;
}

// ─── Worker Queries ───────────────────────────────────────────

export function getAllWorkers(): Worker[] {
  return mockWorkers;
}

export function getWorkerById(workerId: string): Worker | undefined {
  return mockWorkers.find(w => w.workerId === workerId);
}

export function getWorkersByStatus(status: 'SAFE' | 'DANGER' | 'ALL'): Worker[] {
  if (status === 'ALL') return mockWorkers;
  return mockWorkers.filter(w => w.status === status);
}

export function getWorkersByShift(shift: ShiftLabel | 'ALL'): Worker[] {
  if (shift === 'ALL') return mockWorkers;
  return mockWorkers.filter(w => w.shift.label === shift);
}

export function filterWorkers(
  query: string,
  status: 'SAFE' | 'DANGER' | 'ALL',
  shift: ShiftLabel | 'ALL',
): Worker[] {
  let result = mockWorkers;
  if (query.trim()) {
    const q = query.toLowerCase();
    result = result.filter(
      w => w.name.toLowerCase().includes(q) || w.workerId.toLowerCase().includes(q),
    );
  }
  if (status !== 'ALL') result = result.filter(w => w.status === status);
  if (shift !== 'ALL')  result = result.filter(w => w.shift.label === shift);
  return result;
}

// ─── Dashboard Summary ────────────────────────────────────────

export function getDashboardSummary(): DashboardSummary {
  const safe    = mockWorkers.filter(w => w.status === 'SAFE').length;
  const danger  = mockWorkers.filter(w => w.status === 'DANGER').length;
  const working = mockWorkers.filter(w => w.isWorking).length;

  const allDone = mockWorkers.filter(
    w => w.scanStatus.morning && w.scanStatus.lunch && w.scanStatus.evening,
  ).length;

  const incomplete = mockWorkers.length - allDone;

  const totalCumulative = parseFloat(
    mockWorkers.reduce((acc, w) => acc + w.exposure.cumulative, 0).toFixed(1),
  );

  return {
    totalWorkers:            mockWorkers.length,
    safeWorkers:             safe,
    dangerWorkers:           danger,
    workingWorkers:          working,
    allScansCompleted:       allDone,
    incompleteScans:         incomplete,
    totalCumulativeExposure: totalCumulative,
  };
}

// ─── Shift Monitoring ─────────────────────────────────────────

export interface ShiftMonitoringRow {
  worker:          Worker;
  workingDuration: string;
  scansCompleted:  number;
}

export function getShiftMonitoringRows(shift: ShiftLabel | 'ALL'): ShiftMonitoringRow[] {
  const workers =
    shift === 'ALL' ? mockWorkers : mockWorkers.filter(w => w.shift.label === shift);

  return workers.map(worker => {
    const hours = Math.floor(
      (worker.workerId.charCodeAt(1) % 7) + 1,
    );
    const mins = (worker.workerId.charCodeAt(2) % 60);
    return {
      worker,
      workingDuration: `${hours}h ${String(mins).padStart(2, '0')}m`,
      scansCompleted:  scansCompleted(worker),
    };
  });
}

// ─── Reports ─────────────────────────────────────────────────

export function getWorkerExposureSummaries(): WorkerExposureSummary[] {
  return mockWorkers.map(w => ({
    workerId:           w.workerId,
    name:               w.name,
    shift:              `${w.shift.label} (${w.shift.start} – ${w.shift.end})`,
    morningExposure:    w.exposure.morning,
    lunchExposure:      w.exposure.lunch,
    eveningExposure:    w.exposure.evening,
    cumulativeExposure: w.exposure.cumulative,
    status:             w.status,
    scansCompleted:     scansCompleted(w),
  }));
}

// ─── Chart Data ───────────────────────────────────────────────

/** Three-point exposure data for top workers (for bar chart) */
export function getThreePointExposures(limit = 15): ThreePointExposure[] {
  return mockWorkers
    .filter(w => w.isWorking && w.scanStatus.morning) // at least morning done
    .map(w => ({
      name:     w.name.split(' ')[0],
      workerId: w.workerId,
      morning:  w.exposure.morning  ?? 0,
      lunch:    w.exposure.lunch    ?? 0,
      evening:  w.exposure.evening  ?? 0,
      status:   w.status,
    }))
    .sort((a, b) => (b.morning + b.lunch + b.evening) - (a.morning + a.lunch + a.evening))
    .slice(0, limit);
}

/** Per-period averages across all workers for the period avg chart */
export function getScanPeriodAverages(): ScanPeriodAverage[] {
  const morningWorkers = mockWorkers.filter(w => w.scanStatus.morning);
  const lunchWorkers   = mockWorkers.filter(w => w.scanStatus.lunch);
  const eveningWorkers = mockWorkers.filter(w => w.scanStatus.evening);

  const avg = (arr: number[]) =>
    arr.length ? parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2)) : 0;
  const max = (arr: number[]) => (arr.length ? Math.max(...arr) : 0);

  const morningVals  = morningWorkers.map(w => w.exposure.morning!);
  const lunchVals    = lunchWorkers.map(w => w.exposure.lunch!);
  const eveningVals  = eveningWorkers.map(w => w.exposure.evening!);

  return [
    {
      period:      'Morning',
      average:     avg(morningVals),
      max:         max(morningVals),
      dangerCount: morningVals.filter(v => v >= 10).length,
    },
    {
      period:      'Lunch',
      average:     avg(lunchVals),
      max:         max(lunchVals),
      dangerCount: lunchVals.filter(v => v >= 10).length,
    },
    {
      period:      'Evening',
      average:     avg(eveningVals),
      max:         max(eveningVals),
      dangerCount: eveningVals.filter(v => v >= 10).length,
    },
  ];
}

/** Safe vs Danger pie chart data */
export function getSafeVsDangerChartData() {
  const summary = getDashboardSummary();
  return [
    { name: 'Safe',   value: summary.safeWorkers,   color: '#22c55e' },
    { name: 'Danger', value: summary.dangerWorkers, color: '#ef4444' },
  ];
}

/** Scan completion pie chart data */
export function getScanCompletionChartData() {
  const summary = getDashboardSummary();
  return [
    { name: 'All Scans Done', value: summary.allScansCompleted, color: '#4f7bff' },
    { name: 'Incomplete',     value: summary.incompleteScans,   color: '#f59e0b' },
  ];
}

/** Top workers by cumulative exposure (for comparison bar chart) */
export function getTopCumulativeWorkers(limit = 10) {
  return [...mockWorkers]
    .sort((a, b) => b.exposure.cumulative - a.exposure.cumulative)
    .slice(0, limit)
    .map(w => ({
      name:       w.name.split(' ')[0],
      workerId:   w.workerId,
      cumulative: w.exposure.cumulative,
      status:     w.status,
    }));
}
