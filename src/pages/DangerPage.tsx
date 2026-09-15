// Danger Workers — workers whose cumulative estimated dose crossed the
// action level today, plus recent high-exposure readings.
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, TriangleAlert } from 'lucide-react';
import StatusBadge from '../components/ui/StatusBadge';
import { EmptyState, ErrorPanel, Loading } from '../components/ui/States';
import { api } from '../services/api';
import { useAsync } from '../services/hooks';
import type { Reading, WorkerSummary } from '../types/api';
import { formatDateTime, formatNumber } from '../utils/format';

export default function DangerPage() {
  const workers = useAsync<WorkerSummary[]>(() => api.listWorkers('', 'DANGER'), []);
  const readings = useAsync<Reading[]>(() => api.readings(300, 7), []);

  const highReadings = (readings.data ?? []).filter((r) => r.high_exposure);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ color: 'var(--color-danger-text)' }}>
            Danger Workers
          </h1>
          <p className="page-subtitle">
            Workers at or above the {workers.data?.[0]?.action_level ?? 10} ppm·hr
            cumulative action level today.
          </p>
        </div>
      </div>

      <div className="danger-banner">
        <AlertTriangle size={22} />
        <span>
          Workers listed here should be moved away from further H₂S exposure and
          reassessed. Values are <strong>estimates</strong> from colorimetric bands.
        </span>
      </div>

      {workers.loading ? <Loading label="Loading workers…" />
        : workers.error ? <ErrorPanel message={workers.error} onRetry={workers.reload} />
        : (workers.data ?? []).length === 0
          ? <div className="card"><EmptyState label="No workers above the action level today. ✅" /></div>
          : (
            <div className="danger-grid">
              {(workers.data ?? []).map((w) => (
                <div className="danger-card" key={w.id}>
                  <div className="danger-card-header">
                    <div>
                      <div className="danger-card-name">{w.name}</div>
                      <div className="danger-card-id">{w.employee_id} · {w.department}</div>
                    </div>
                    <StatusBadge tone="danger"><TriangleAlert size={11} /> DANGER</StatusBadge>
                  </div>
                  <div className="danger-card-stats">
                    <div className="danger-stat">
                      <div className="danger-stat-value">
                        {formatNumber(w.today_cumulative_dose)}
                      </div>
                      <div className="danger-stat-label">cumulative ppm·hr</div>
                    </div>
                    <div className="danger-stat">
                      <div className="danger-stat-value">{w.today_readings}</div>
                      <div className="danger-stat-label">readings today</div>
                    </div>
                    <div className="danger-stat">
                      <div className="danger-stat-value">{formatNumber(w.latest_dose)}</div>
                      <div className="danger-stat-label">latest reading</div>
                    </div>
                  </div>
                  <Link to={`/workers/${w.id}`} className="table-link danger-link">
                    View worker record <ArrowRight size={14} />
                  </Link>
                </div>
              ))}
            </div>
          )}

      <div className="card" style={{ marginTop: 22 }}>
        <div className="card-header">
          <h2 className="card-title">High-exposure readings (last 7 days)</h2>
        </div>
        <div className="table-container">
          {readings.loading ? <Loading />
            : highReadings.length === 0
              ? <EmptyState label="No high-exposure readings recorded." />
              : (
                <table>
                  <thead>
                    <tr>
                      <th>Time</th><th>Worker</th><th>Band</th><th>Shift</th>
                      <th>Est. dose (ppm·hr)</th><th>Model</th>
                    </tr>
                  </thead>
                  <tbody>
                    {highReadings.map((r) => (
                      <tr key={r.id}>
                        <td>{formatDateTime(r.timestamp)}</td>
                        <td className="td-main">{r.worker_name}</td>
                        <td className="td-mono">{r.band_qr}</td>
                        <td>{r.shift_label ?? '—'}</td>
                        <td className="td-exposure td-exposure--danger">
                          {formatNumber(r.estimated_dose)}
                        </td>
                        <td className="td-mono" style={{ fontSize: '0.72rem' }}>
                          {r.model_version}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
        </div>
      </div>
    </>
  );
}
