import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, Camera, Clock, QrCode, ShieldCheck, Wind,
} from 'lucide-react';
import { api } from '../services/api';
import { useAsync } from '../services/hooks';
import type { Reading } from '../types/api';
import { formatDateTime, formatDose } from '../utils/format';

export default function WorkerDashboardPage() {
  const summary = useAsync(() => api.mySummary(), []);
  const recent = useAsync(() => api.myReadings(6), []);

  const s = summary.data;
  const danger = (s?.today_cumulative_dose ?? 0) >= (s?.action_level ?? 10);

  return (
    <div className="wk-page">
      <div className={`wk-banner ${danger ? 'wk-banner-danger' : 'wk-banner-safe'}`}>
        <div className="wk-banner-icon">
          {danger ? <AlertTriangle size={26} /> : <ShieldCheck size={26} />}
        </div>
        <div>
          <div className="wk-banner-title">
            {danger ? 'Action level reached today' : 'Within safe exposure today'}
          </div>
          <div className="wk-banner-sub">
            Cumulative estimated dose {formatDose(s?.today_cumulative_dose)}
            {s ? ` · action level ${s.action_level} ppm·hr` : ''}
          </div>
        </div>
      </div>

      <div className="wk-stat-row">
        <div className="wk-stat">
          <div className="wk-stat-label">Today&apos;s dose</div>
          <div className={`wk-stat-value ${danger ? 'text-danger' : 'text-safe'}`}>
            {s ? s.today_cumulative_dose.toFixed(2) : '—'}
            <span className="wk-stat-unit">ppm·hr</span>
          </div>
        </div>
        <div className="wk-stat">
          <div className="wk-stat-label">Readings</div>
          <div className="wk-stat-value">{s?.today_readings ?? '—'}</div>
          <div className="wk-stat-sub">today</div>
        </div>
      </div>

      <div className="wk-card">
        <div className="wk-card-head">
          <QrCode size={17} />
          <span>Assigned wristband</span>
        </div>
        {summary.loading ? (
          <div className="wk-muted">Loading…</div>
        ) : s?.band_qr ? (
          <>
            <div className="wk-band-id">{s.band_qr}</div>
            <div className="wk-band-meta">
              Status: <strong className="text-capitalize">{s.band_status}</strong>
              {' · '}valid until {new Date(s.band_expiry ?? '').toLocaleDateString('en-IN',
                { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
          </>
        ) : (
          <div className="wk-muted">No wristband assigned yet.</div>
        )}
      </div>

      <Link to="/worker/scan" className="btn btn-primary wk-cta">
        <Camera size={19} /> Scan wristband &amp; take reading
        <ArrowRight size={18} style={{ marginLeft: 'auto' }} />
      </Link>

      <div className="wk-card">
        <div className="wk-card-head"><Clock size={17} /><span>Recent readings</span></div>
        {recent.loading ? (
          <div className="wk-muted">Loading…</div>
        ) : (recent.data ?? []).length === 0 ? (
          <div className="wk-muted">No readings yet.</div>
        ) : (
          <ul className="wk-list">
            {(recent.data ?? []).map((r: Reading) => (
              <li key={r.id} className="wk-list-item">
                <div>
                  <div className="wk-list-primary">
                    {r.reading_status === 'valid'
                      ? formatDose(r.estimated_dose)
                      : 'Expired band · rejected'}
                  </div>
                  <div className="wk-list-secondary">
                    {r.band_qr} · {formatDateTime(r.timestamp)}
                  </div>
                </div>
                <span className={`wk-dot ${
                  r.reading_status !== 'valid'
                    ? 'wk-dot-expired'
                    : (r.estimated_dose ?? 0) >= (s?.action_level ?? 10)
                      ? 'wk-dot-danger'
                      : 'wk-dot-safe'
                }`} />
              </li>
            ))}
          </ul>
        )}
        <Link to="/worker/history" className="wk-card-link">
          View full history <ArrowRight size={15} />
        </Link>
      </div>

      <div className="wk-footnote">
        <Wind size={13} />
        Dose values are model estimates from colorimetric readings, not exact
        measurements. Model trained on simulated calibration data.
      </div>
    </div>
  );
}
