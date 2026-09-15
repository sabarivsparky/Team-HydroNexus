// Settings — model registry, ML metrics and wristband stock management
import { useState } from 'react';
import {
  CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip,
  XAxis, YAxis,
} from 'recharts';
import {
  Cpu, FlaskConical, Loader2, Plus, QrCode, RefreshCw, ShieldCheck,
} from 'lucide-react';
import StatusBadge from '../components/ui/StatusBadge';
import { ErrorPanel, Loading } from '../components/ui/States';
import { api } from '../services/api';
import { useAsync } from '../services/hooks';
import { useAuth } from '../context/AuthContext';
import type { CalibrationPoint, ModelInfo, Wristband } from '../types/api';
import { formatDate } from '../utils/format';

function CalibrationChart({ points }: { points: CalibrationPoint[] }) {
  const data = points
    .map((p) => ({ dose: p.dose_ppm_hr, deltaE: p.features.delta_e ?? 0 }))
    .filter((d) => Number.isFinite(d.deltaE));
  return (
    <div className="chart-wrapper" style={{ height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 12, right: 18, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis type="number" dataKey="dose" name="Known dose"
            unit=" ppm·hr" fontSize={12} tickLine={false} />
          <YAxis type="number" dataKey="deltaE" name="ΔE"
            fontSize={12} tickLine={false} />
          <Tooltip formatter={(v, n) =>
            [`${Number(v).toFixed(1)}${n === 'Known dose' ? ' ppm·hr' : ''}`, String(n)]} />
          <Scatter data={data} fill="#7c3aed" fillOpacity={0.55} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

function MetricsTable({ model }: { model: ModelInfo }) {
  if (!model.metrics) return <p className="wk-muted">No metrics recorded.</p>;
  return (
    <table className="mini-table">
      <thead>
        <tr><th>Algorithm</th><th>CV MAE</th><th>CV R²</th><th>Holdout MAE</th><th>Holdout R²</th></tr>
      </thead>
      <tbody>
        {Object.entries(model.metrics).map(([name, m]) => {
          const activeName = model.model_type;
          return (
            <tr key={name} style={{
              fontWeight: name === activeName ? 700 : 400,
              background: name === activeName ? 'var(--color-accent-bg)' : undefined,
            }}>
              <td>{name}{name === activeName ? ' ✓ deployed' : ''}</td>
              <td>{m.cv_mae.toFixed(2)}</td>
              <td>{m.cv_r2.toFixed(3)}</td>
              <td>{m.test_mae.toFixed(2)}</td>
              <td>{m.test_r2.toFixed(3)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const models = useAsync<ModelInfo[]>(() => api.models(), []);
  const calibration = useAsync<CalibrationPoint[]>(() => api.calibration(1000), []);
  const bands = useAsync<Wristband[]>(() => api.listBands(), []);
  const [batchCount, setBatchCount] = useState(10);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [stockFilter, setStockFilter] = useState('all');

  const registerBatch = async () => {
    setBusy(true);
    setMsg('');
    try {
      const res = await api.registerBatch(batchCount);
      setMsg(`Registered ${res.created} new wristbands.`);
      bands.reload();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const stock = (bands.data ?? []).filter((b) =>
    stockFilter === 'all' ? true : b.status === stockFilter);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings &amp; System</h1>
          <p className="page-subtitle">Model registry, calibration and wristband stock.</p>
        </div>
      </div>

      {/* Model registry */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-header">
          <h2 className="card-title"><Cpu size={17} style={{ verticalAlign: '-3px' }} /> Dose model registry</h2>
          <button className="btn btn-ghost" onClick={models.reload} title="Refresh">
            <RefreshCw size={15} />
          </button>
        </div>

        {models.loading ? <Loading label="Loading models…" />
          : models.error ? <ErrorPanel message={models.error} />
          : (
            <>
              <div className="sim-banner">
                <FlaskConical size={17} />
                <span>
                  All models here are trained on <strong>simulated calibration
                  data</strong> generated from rendered band photographs. They validate
                  the software/ML pipeline only — physical H₂S exposure calibration is
                  still required.
                </span>
              </div>
              {(models.data ?? []).map((m) => (
                <div key={m.id} style={{ marginBottom: 18 }}>
                  <div className="setting-row">
                    <div>
                      <div className="setting-row-label" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <strong>{m.version}</strong>
                        {m.is_active
                          ? <StatusBadge tone="safe" small><ShieldCheck size={11} /> ACTIVE</StatusBadge>
                          : <StatusBadge tone="info" small>inactive</StatusBadge>}
                        {m.simulated_calibration && (
                          <StatusBadge tone="warning" small>simulated data</StatusBadge>
                        )}
                      </div>
                      <div className="setting-row-desc">
                        {m.model_type} · trained {formatDate(m.trained_at)}
                      </div>
                    </div>
                  </div>
                  <MetricsTable model={m} />
                  <p className="wk-muted" style={{ marginTop: 6, fontSize: '0.78rem' }}>
                    Retraining workflow: collect new calibration points →
                    <code style={{ margin: '0 4px' }}>ml/scripts/train_model.py</code>
                    → compare MAE/R² → activate only if validated (not automated).
                  </p>
                </div>
              ))}
            </>
          )}
      </div>

      {/* Calibration dataset */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-header">
          <h2 className="card-title">
            <FlaskConical size={17} style={{ verticalAlign: '-3px' }} />
            Calibration dataset — known dose vs measured ΔE
          </h2>
          <span className="src-pill src-pill-sim">
            {(calibration.data ?? []).length} simulated points
          </span>
        </div>
        {calibration.loading ? <Loading label="Loading calibration points…" />
          : calibration.error ? <ErrorPanel message={calibration.error} />
          : <CalibrationChart points={calibration.data ?? []} />}
        <p className="wk-muted" style={{ padding: '0 18px 14px', fontSize: '0.78rem' }}>
          Each point is a rendered wristband photograph run through the real CV
          pipeline at a known cumulative dose. Real controlled-H₂S exposure data
          must replace this set before any field accuracy claim.
        </p>
      </div>

      {/* Wristband stock */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title"><QrCode size={17} style={{ verticalAlign: '-3px' }} /> Wristband stock</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="number" min={1} max={100} value={batchCount}
              className="form-input" style={{ width: 80, padding: '7px 10px' }}
              onChange={(e) => setBatchCount(Math.max(1, Number(e.target.value)))}
            />
            <button className="btn btn-primary" onClick={registerBatch} disabled={busy}>
              {busy ? <Loader2 size={15} className="wk-spin" /> : <Plus size={15} />}
              Register batch
            </button>
          </div>
        </div>
        {msg && <div className="setting-row-desc" style={{ padding: '0 18px 8px', color: 'var(--color-safe-text)' }}>{msg}</div>}

        <div style={{ padding: '0 18px 10px', display: 'flex', gap: 6 }}>
          {[['all', 'All'], ['unassigned', 'Stock'], ['assigned', 'Assigned'],
            ['used', 'Used'], ['invalid', 'Invalid']].map(([v, label]) => (
            <button key={v} className={`wk-shift-chip ${stockFilter === v ? 'active' : ''}`}
              style={{ borderRadius: 6 }}
              onClick={() => setStockFilter(v)}>{label}</button>
          ))}
        </div>

        <div className="table-container">
          {bands.loading ? <Loading /> : bands.error ? <ErrorPanel message={bands.error} /> : (
            <table>
              <thead>
                <tr><th>QR ID</th><th>Status</th><th>Assigned to</th>
                <th>Manufactured</th><th>Use by</th><th></th></tr>
              </thead>
              <tbody>
                {stock.slice(0, 100).map((b) => (
                  <tr key={b.id}>
                    <td className="td-mono">{b.qr_id}</td>
                    <td className="text-capitalize">
                      <StatusBadge
                        tone={b.status === 'invalid' ? 'danger'
                          : b.is_expired ? 'warning'
                          : b.status === 'used' ? 'info' : 'safe'} small>
                        {b.status.replace('_', ' ')}
                      </StatusBadge>
                    </td>
                    <td>{b.worker_name ?? '—'}</td>
                    <td>{formatDate(b.manufacture_date)}</td>
                    <td style={{ color: b.is_expired ? 'var(--color-danger-text)' : undefined }}>
                      {formatDate(b.expiry_date)}{b.is_expired ? ' (expired)' : ''}
                    </td>
                    <td></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="setting-row-desc" style={{ padding: 12 }}>
          Signed in as <strong>{user?.name}</strong> ({user?.email}) · role {user?.role}.
          Shelf life is set to 90 days in this prototype and is a claim requiring
          aging validation.
        </div>
      </div>
    </>
  );
}
