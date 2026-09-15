// Dashboard — overall exposure operations view (live API data)
import { Link } from 'react-router-dom';
import {
  Activity, AlertTriangle, FlaskConical, Gauge, Radio, TriangleAlert,
  Users, Wind,
} from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, Legend, Line, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import { EmptyState, ErrorPanel, Loading } from '../components/ui/States';
import { api } from '../services/api';
import { useAsync } from '../services/hooks';
import type { DashboardSummary, Reading, ShiftSummary, TrendPoint } from '../types/api';
import { formatDateTime, formatNumber } from '../utils/format';

function TrendChart({ data }: { data: TrendPoint[] }) {
  const chartData = data.map((d) => ({
    ...d,
    day: d.date.slice(5),
  }));
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={chartData} margin={{ top: 10, right: 12, left: -14, bottom: 0 }}>
        <defs>
          <linearGradient id="avgFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1d4ed8" stopOpacity={0.32} />
            <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="maxFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#dc2626" stopOpacity={0.24} />
            <stop offset="100%" stopColor="#dc2626" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="day" fontSize={12} tickLine={false} />
        <YAxis fontSize={12} tickLine={false} unit="" />
        <Tooltip formatter={(v) => `${formatNumber(Number(v))} ppm·hr`} />
        <Legend />
        <Area type="monotone" dataKey="average_dose" name="Avg dose"
          stroke="#1d4ed8" fill="url(#avgFill)" strokeWidth={2} />
        <Area type="monotone" dataKey="max_dose" name="Max dose"
          stroke="#dc2626" fill="url(#maxFill)" strokeWidth={2} />
        <Line type="monotone" dataKey="high_exposure" name="High readings"
          stroke="#d97706" strokeWidth={2} dot />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function DoseCell({ r, action }: { r: Reading; action: number }) {
  if (r.reading_status !== 'valid') {
    return <span className="td-exposure" style={{ color: 'var(--color-warning-text)' }}>
      Expired
    </span>;
  }
  const danger = (r.estimated_dose ?? 0) >= action;
  return (
    <span className={`td-exposure ${danger ? 'td-exposure--danger' : 'td-exposure--safe'}`}>
      {formatNumber(r.estimated_dose)}
    </span>
  );
}

export default function DashboardPage() {
  const summary = useAsync<DashboardSummary>(() => api.summary(), []);
  const trends = useAsync<TrendPoint[]>(() => api.trends(14), []);
  const shifts = useAsync<ShiftSummary[]>(() => api.shiftsToday(), []);
  const recent = useAsync<Reading[]>(() => api.readings(8, 1), []);

  if (summary.loading) return <Loading label="Loading dashboard…" />;
  if (summary.error || !summary.data) {
    return <ErrorPanel message={summary.error ?? 'Failed to load summary'}
      onRetry={summary.reload} />;
  }
  const s = summary.data;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Cumulative H₂S exposure from passive colorimetric wristbands · ppm·hr
          </p>
        </div>
        <StatusBadge tone="info">
          <Radio size={11} /> Model {s.active_model ?? '—'}
        </StatusBadge>
      </div>

      {s.simulated_calibration && (
        <div className="sim-banner">
          <FlaskConical size={17} />
          <span>
            <strong>Prototype:</strong> the dose model ({s.active_model}) is trained on
            <strong> simulated calibration data</strong>. See KNOWN_LIMITATIONS.md — not
            a physical validation.
          </span>
        </div>
      )}

      <div className="stat-cards-grid">
        <StatCard label="Workers" value={s.total_workers} sub="registered field staff"
          variant="total" icon={<Users size={22} />} />
        <StatCard label="Active bands" value={s.active_bands}
          sub={`${s.used_bands} used · ${s.assigned_bands} assigned`}
          variant="working" icon={<Wind size={22} />} />
        <StatCard label="Readings today" value={s.readings_today}
          sub={`${s.total_readings} all-time readings`}
          variant="safe" icon={<Activity size={22} />} />
        <StatCard label="High exposure today" value={s.high_exposure_today}
          sub={`action level ${s.action_level} ppm·hr`}
          variant="danger" icon={<TriangleAlert size={22} />} />
        <StatCard label="Cumulative dose today" value={formatNumber(s.cumulative_dose_today)}
          sub={`avg ${formatNumber(s.average_dose_today)} · max ${formatNumber(s.max_dose_today)} ppm·hr`}
          variant="exposure" icon={<Gauge size={22} />} />
        <StatCard label="Expired bands" value={s.expired_bands}
          sub={`${s.invalid_bands} invalidated`}
          variant="working" icon={<AlertTriangle size={22} />} />
      </div>

      <div className="dashboard-charts-grid">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Exposure trend — last 14 days</h2>
          </div>
          <div className="chart-wrapper">
            {trends.loading ? <Loading /> : trends.error
              ? <ErrorPanel message={trends.error} />
              : <TrendChart data={trends.data ?? []} />}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Shifts today</h2>
          </div>
          <div className="shift-summary-list">
            {(shifts.data ?? []).map((sh) => (
              <div key={sh.shift} className="shift-summary-row">
                <div className="shift-summary-name">{sh.shift}</div>
                <div className="shift-summary-metrics">
                  <span><strong>{sh.readings}</strong> readings</span>
                  <span>avg <strong>{formatNumber(sh.average_dose)}</strong></span>
                  <span>max <strong className={
                    sh.max_dose >= s.action_level ? 'text-danger' : ''
                  }>{formatNumber(sh.max_dose)}</strong></span>
                </div>
                {sh.high_exposure > 0 && (
                  <StatusBadge tone="danger" small>{sh.high_exposure} high</StatusBadge>
                )}
              </div>
            ))}
            {shifts.loading && <Loading label="Loading shifts…" />}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ justifyContent: 'space-between' }}>
          <h2 className="card-title">Latest readings</h2>
          <Link to="/exposure" className="table-link">View all →</Link>
        </div>
        <div className="table-container">
          {recent.loading ? <Loading label="Loading readings…" /> : recent.error
            ? <ErrorPanel message={recent.error} />
            : (recent.data ?? []).length === 0
              ? <EmptyState label="No readings yet." />
              : (
                <table>
                  <thead>
                    <tr>
                      <th>Reading</th><th>Worker</th><th>Band</th><th>Shift</th>
                      <th>Est. dose (ppm·hr)</th><th>Status</th><th>Model</th><th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(recent.data ?? []).map((r) => (
                      <tr key={r.id}>
                        <td className="td-mono">{r.ref.slice(-10)}</td>
                        <td className="td-main">{r.worker_name}</td>
                        <td className="td-mono">{r.band_qr}</td>
                        <td>{r.shift_label ?? '—'}</td>
                        <td><DoseCell r={r} action={s.action_level} /></td>
                        <td>
                          {r.reading_status === 'valid'
                            ? <StatusBadge tone={
                                (r.estimated_dose ?? 0) >= s.action_level ? 'danger' : 'safe'
                              } small>
                                {(r.estimated_dose ?? 0) >= s.action_level ? 'HIGH' : 'OK'}
                              </StatusBadge>
                            : <StatusBadge tone="warning" small>REJECTED</StatusBadge>}
                        </td>
                        <td className="td-mono" style={{ fontSize: '0.72rem' }}>
                          {r.model_version ?? '—'}
                        </td>
                        <td>{formatDateTime(r.timestamp)}</td>
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
