// Worker detail — profile, wristband and cumulative dose history
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, BadgeCheck, Building2, CalendarClock, Mail, Phone, QrCode,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import StatusBadge from '../components/ui/StatusBadge';
import { ErrorPanel, Loading } from '../components/ui/States';
import { api } from '../services/api';
import { useAsync } from '../services/hooks';
import type { Reading, WorkerSummary } from '../types/api';
import { dayKey, formatDateTime, formatNumber } from '../utils/format';

export default function WorkerDetailPage() {
  const { workerId } = useParams();
  const id = Number(workerId);
  const worker = useAsync<WorkerSummary>(() => api.worker(id), [id]);
  const readings = useAsync<Reading[]>(() => api.workerReadings(id, 200), [id]);

  const daily = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of readings.data ?? []) {
      if (r.reading_status !== 'valid') continue;
      const k = dayKey(r.timestamp);
      map.set(k, (map.get(k) ?? 0) + (r.estimated_dose ?? 0));
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, dose]) => ({
        date: date.slice(5),
        dose: Number(dose.toFixed(2)),
      }));
  }, [readings.data]);

  if (worker.loading) return <Loading label="Loading worker…" />;
  if (worker.error || !worker.data) {
    return <ErrorPanel message={worker.error ?? 'Worker not found'} onRetry={worker.reload} />;
  }
  const w = worker.data;

  return (
    <>
      <Link to="/workers" className="back-btn">
        <ArrowLeft size={16} /> Back to Workers
      </Link>

      <div className="page-header">
        <div>
          <h1 className="page-title">{w.name}</h1>
          <p className="page-subtitle">{w.employee_id} · {w.department ?? '—'}</p>
        </div>
        <StatusBadge tone={w.status === 'DANGER' ? 'danger' : 'safe'}>
          {w.status === 'DANGER' ? 'Action level reached' : 'Within limits'}
        </StatusBadge>
      </div>

      <div className="detail-grid">
        <div className="card">
          <div className="card-header"><h2 className="card-title">Profile</h2></div>
          <div className="detail-info-card">
            <div className="detail-info-row">
              <span className="detail-info-key"><BadgeCheck size={14} /> Employee ID</span>
              <span className="detail-info-value">{w.employee_id}</span>
            </div>
            <div className="detail-info-row">
              <span className="detail-info-key"><Mail size={14} /> Email</span>
              <span className="detail-info-value">{w.email}</span>
            </div>
            <div className="detail-info-row">
              <span className="detail-info-key"><Phone size={14} /> Mobile</span>
              <span className="detail-info-value">{w.mobile ?? '—'}</span>
            </div>
            <div className="detail-info-row">
              <span className="detail-info-key"><Building2 size={14} /> Department</span>
              <span className="detail-info-value">{w.department ?? '—'}</span>
            </div>
            <div className="detail-info-row">
              <span className="detail-info-key"><QrCode size={14} /> Wristband</span>
              <span className="detail-info-value">
                {w.band_qr ? `${w.band_qr} (${w.band_status})` : 'Unassigned'}
              </span>
            </div>
            <div className="detail-info-row">
              <span className="detail-info-key"><CalendarClock size={14} /> Band valid till</span>
              <span className="detail-info-value">
                {w.band_expiry
                  ? new Date(w.band_expiry).toLocaleDateString('en-IN')
                  : '—'}
              </span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h2 className="card-title">Today</h2></div>
          <div className="stat-cards-grid detail-stat-mini">
            <div className="stat-card stat-card--exposure">
              <div className="stat-card-label">Cumulative dose</div>
              <div className="stat-card-value">{formatNumber(w.today_cumulative_dose)}</div>
              <div className="stat-card-sub">ppm·hr · action {w.action_level}</div>
            </div>
            <div className="stat-card stat-card--safe">
              <div className="stat-card-label">Readings today</div>
              <div className="stat-card-value">{w.today_readings}</div>
            </div>
            <div className="stat-card stat-card--working">
              <div className="stat-card-label">Latest reading</div>
              <div className="stat-card-value" style={{ fontSize: '1.4rem' }}>
                {w.latest_dose != null ? formatNumber(w.latest_dose) : '—'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Daily cumulative dose (last 14 active days)</h2>
        </div>
        <div className="chart-wrapper">
          {readings.loading ? <Loading /> : daily.length === 0 ? (
            <div className="empty-state"><div className="empty-state-text">No readings yet.</div></div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={daily} margin={{ top: 10, right: 16, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" fontSize={12} tickLine={false} />
                <YAxis fontSize={12} tickLine={false} unit="" />
                <Tooltip formatter={(v) => [`${Number(v)} ppm·hr`, 'Cumulative dose']} />
                <ReferenceLine y={w.action_level} stroke="#dc2626"
                  strokeDasharray="5 4" label={{ value: 'Action level', fontSize: 11, fill: '#dc2626', position: 'insideTopRight' }} />
                <Bar dataKey="dose" radius={[5, 5, 0, 0]}>
                  {daily.map((d) => (
                    <Cell key={d.date}
                      fill={d.dose >= w.action_level ? '#dc2626' : '#1d4ed8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Reading history</h2>
        </div>
        <div className="table-container">
          {readings.loading ? <Loading label="Loading readings…" /> : (
            <table>
              <thead>
                <tr>
                  <th>Ref</th><th>Time</th><th>Band</th><th>Shift</th>
                  <th>Est. dose (ppm·hr)</th><th>Expiry</th><th>Source</th><th>Model</th>
                </tr>
              </thead>
              <tbody>
                {(readings.data ?? []).map((r) => {
                  const rejected = r.reading_status !== 'valid';
                  const high = !rejected && (r.estimated_dose ?? 0) >= w.action_level;
                  return (
                    <tr key={r.id}>
                      <td className="td-mono">{r.ref.slice(-10)}</td>
                      <td>{formatDateTime(r.timestamp)}</td>
                      <td className="td-mono">{r.band_qr}</td>
                      <td>{r.shift_label ?? '—'}</td>
                      <td className={`td-exposure ${
                        rejected ? '' : high ? 'td-exposure--danger' : 'td-exposure--safe'
                      }`}>
                        {rejected ? 'rejected' : formatNumber(r.estimated_dose)}
                      </td>
                      <td>
                        <StatusBadge tone={r.expiry_status === 'VALID' ? 'safe' : 'danger'} small>
                          {r.expiry_status}
                        </StatusBadge>
                      </td>
                      <td className="text-capitalize">{r.source}</td>
                      <td className="td-mono" style={{ fontSize: '0.72rem' }}>
                        {r.model_version ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
