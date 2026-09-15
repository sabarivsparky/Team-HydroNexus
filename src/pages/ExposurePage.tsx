// Exposure Readings — every analyzed wristband photo (CV + ML results)
import { useState } from 'react';
import {
  Activity, FlaskConical, Image as ImageIcon, X,
} from 'lucide-react';
import StatusBadge from '../components/ui/StatusBadge';
import { EmptyState, ErrorPanel, Loading } from '../components/ui/States';
import { api } from '../services/api';
import { useAsync } from '../services/hooks';
import type { Reading } from '../types/api';
import { formatDateTime, formatNumber } from '../utils/format';

type Filter = 'ALL' | 'HIGH' | 'REJECTED';

export default function ExposurePage() {
  const { data, loading, error, reload } = useAsync<Reading[]>(
    () => api.readings(300, 7), []);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [image, setImage] = useState<Reading | null>(null);

  const rows = (data ?? []).filter((r) => {
    if (filter === 'HIGH') return r.high_exposure;
    if (filter === 'REJECTED') return r.reading_status !== 'valid';
    return true;
  });

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Exposure Readings</h1>
          <p className="page-subtitle">
            Every wristband photograph processed through the CV color-correction and
            ML dose model over the last 7 days.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['ALL', 'HIGH', 'REJECTED'] as Filter[]).map((f) => (
            <button key={f}
              className={`wk-shift-chip ${filter === f ? 'active' : ''}`}
              style={{ borderRadius: 6 }}
              onClick={() => setFilter(f)}>
              {f === 'ALL' ? 'All readings' : f === 'HIGH' ? 'High exposure' : 'Rejected'}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="table-toolbar">
          <div className="table-toolbar-title">
            <Activity size={18} /> {rows.length} readings
          </div>
        </div>
        <div className="table-container">
          {loading ? <Loading label="Loading readings…" />
            : error ? <ErrorPanel message={error} onRetry={reload} />
            : rows.length === 0 ? <EmptyState label="No readings in this period." />
            : (
              <table>
                <thead>
                  <tr>
                    <th>Ref</th><th>Worker</th><th>Band</th><th>Shift</th>
                    <th>Est. dose (ppm·hr)</th><th>ΔE</th><th>Expiry</th>
                    <th>Model</th><th>Source</th><th>Time</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const rejected = r.reading_status !== 'valid';
                    return (
                      <tr key={r.id}>
                        <td className="td-mono">{r.ref.slice(-10)}</td>
                        <td className="td-main">
                          {r.worker_name}
                          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                            {r.employee_id} · {r.department ?? ''}
                          </div>
                        </td>
                        <td className="td-mono">{r.band_qr}</td>
                        <td>{r.shift_label ?? '—'}</td>
                        <td className={`td-exposure ${
                          rejected ? '' : r.high_exposure
                            ? 'td-exposure--danger' : 'td-exposure--safe'
                        }`}>
                          {rejected ? 'rejected' : formatNumber(r.estimated_dose)}
                        </td>
                        <td className="td-mono">{r.features?.delta_e?.toFixed(1) ?? '—'}</td>
                        <td>
                          <StatusBadge
                            tone={r.expiry_status === 'VALID' ? 'safe' : 'danger'} small>
                            {r.expiry_status}
                          </StatusBadge>
                        </td>
                        <td className="td-mono" style={{ fontSize: '0.72rem' }}>
                          {r.model_version ?? '—'}
                        </td>
                        <td>
                          {r.source === 'seed' ? (
                            <span className="src-pill">seed</span>
                          ) : r.source === 'simulated' ? (
                            <span className="src-pill src-pill-sim"><FlaskConical size={11} /> sim</span>
                          ) : (
                            <span className="src-pill src-pill-photo">photo</span>
                          )}
                        </td>
                        <td>{formatDateTime(r.timestamp)}</td>
                        <td>
                          {r.image_rectified && (
                            <button className="icon-btn" title="View analyzed image"
                              onClick={() => setImage(r)}>
                              <ImageIcon size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
        </div>
      </div>

      {image && (
        <div className="modal-backdrop" onClick={() => setImage(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <strong>{image.ref} · {image.band_qr}</strong>
              <button className="icon-btn" onClick={() => setImage(null)}><X size={18} /></button>
            </div>
            <img className="modal-image" src={image.image_rectified ?? ''}
              alt="Rectified analyzed wristband" />
            <div className="modal-meta">
              {image.reading_status === 'valid'
                ? `Estimated dose ${formatNumber(image.estimated_dose)} ppm·hr · model ${image.model_version}`
                : 'Reading rejected (expired wristband)'}
              {image.features?.delta_e != null &&
                ` · ΔE ${image.features.delta_e.toFixed(1)}`}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
