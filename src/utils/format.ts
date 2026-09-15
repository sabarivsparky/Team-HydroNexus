export function formatDose(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined) return '—';
  return `${v.toFixed(digits)} ppm·hr`;
}

export function formatNumber(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined) return '—';
  return v.toFixed(digits);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export function doseClass(dose: number | null | undefined,
                          actionLevel = 10): 'safe' | 'danger' | 'muted' {
  if (dose === null || dose === undefined) return 'muted';
  return dose >= actionLevel ? 'danger' : 'safe';
}

export function currentShift(): 'Morning' | 'Afternoon' | 'Night' {
  const h = new Date().getHours();
  if (h >= 8 && h < 16) return 'Morning';
  if (h >= 16 && h < 24) return 'Afternoon';
  return 'Night';
}
