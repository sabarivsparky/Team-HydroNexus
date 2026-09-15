// Shift Monitoring — Morning / Afternoon / Night exposure summaries
import { Clock, Moon, Sunrise, Sunset } from 'lucide-react';
import StatusBadge from '../components/ui/StatusBadge';
import { ErrorPanel, Loading } from '../components/ui/States';
import { api } from '../services/api';
import { useAsync } from '../services/hooks';
import type { Reading, ShiftSummary } from '../types/api';
import { formatTime, formatNumber } from '../utils/format';

const SHIFT_META = {
  Morning: { icon: <Sunrise size={22} />, window: '08:00 – 16:00', tone: 'safe' as const },
  Afternoon: { icon: <Sunset size={22} />, window: '16:00 – 00:00', tone: 'warning' as const },
  Night: { icon: <Moon size={22} />, window: '00:00 – 08:00', tone: 'info' as const },
};

export default function ShiftsPage() {
  const shifts = useAsync<ShiftSummary[]>(() => api.shiftsToday(), []);
  const readings = useAsync<Reading[]>(() => api.readings(200, 1), []);

  if (shifts.loading || readings.loading) return <Loading label="Loading shift data…" />;
  if (shifts.error) return <ErrorPanel message={shifts.error} onRetry={shifts.reload} />;

  const byShift = (label: string) =>
    (readings.data ?? []).filter((r) => r.shift_label === label);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Shift Monitoring</h1>
          <p className="page-subtitle">Readings grouped across today&apos;s shifts.</p>
        </div>
      </div>

      <div className="shift-cards-grid">
        {(shifts.data ?? []).map((s) => {
          const meta = SHIFT_META[s.shift];
          return (
            <div className="card shift-card" key={s.shift}>
              <div className="shift-card-head">
                <div className="shift-card-icon">{meta.icon}</div>
                <div>
                  <div className="shift-card-name">{s.shift} shift</div>
                  <div className="shift-card-window">{meta.window}</div>
                </div>
                {s.high_exposure > 0 && (
                  <StatusBadge tone="danger" small>{s.high_exposure} high</StatusBadge>
                )}
              </div>
              <div className="shift-card-metrics">
                <div>
                  <div className="shift-metric-value">{s.readings}</div>
                  <div className="shift-metric-label">readings</div>
                </div>
                <div>
                  <div className="shift-metric-value">{formatNumber(s.average_dose)}</div>
                  <div className="shift-metric-label">avg ppm·hr</div>
                </div>
                <div>
                  <div className={`shift-metric-value ${s.max_dose >= 10 ? 'text-danger' : ''}`}>
                    {formatNumber(s.max_dose)}
                  </div>
                  <div className="shift-metric-label">max</div>
                </div>
                <div>
                  <div className="shift-metric-value">{formatNumber(s.cumulative_dose)}</div>
                  <div className="shift-metric-label">cumulative</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {(Object.keys(SHIFT_META) as (keyof typeof SHIFT_META)[]).map((label) => {
        const rows = byShift(label);
        if (rows.length === 0) return null;
        return (
          <div className="card" key={label} style={{ marginBottom: 18 }}>
            <div className="card-header">
              <h2 className="card-title">
                <Clock size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />
                {label} shift readings ({rows.length})
              </h2>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Time</th><th>Worker</th><th>Band</th>
                    <th>Est. dose (ppm·hr)</th><th>Status</th><th>Model</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>{formatTime(r.timestamp)}</td>
                      <td className="td-main">{r.worker_name}</td>
                      <td className="td-mono">{r.band_qr}</td>
                      <td className={`td-exposure ${
                        r.reading_status !== 'valid' ? ''
                          : r.high_exposure ? 'td-exposure--danger' : 'td-exposure--safe'
                      }`}>
                        {r.reading_status !== 'valid' ? 'rejected' : formatNumber(r.estimated_dose)}
                      </td>
                      <td>
                        {r.reading_status === 'valid'
                          ? <StatusBadge tone={r.high_exposure ? 'danger' : 'safe'} small>
                              {r.high_exposure ? 'HIGH' : 'OK'}
                            </StatusBadge>
                          : <StatusBadge tone="warning" small>EXPIRED</StatusBadge>}
                      </td>
                      <td className="td-mono" style={{ fontSize: '0.72rem' }}>
                        {r.model_version ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </>
  );
}
