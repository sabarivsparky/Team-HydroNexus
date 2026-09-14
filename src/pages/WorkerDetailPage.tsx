// ─── Worker Details Page — 3-Scan Model ───────────────────
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, User, Clock, Activity, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import StatusBadge  from '../components/ui/StatusBadge';
import { getWorkerById } from '../data/mockDataService';

const TOOLTIP_STYLE = {
  backgroundColor: '#ffffff',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  color: '#0f172a',
  fontSize: 12,
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
};

const PERIOD_COLORS = ['var(--color-warning)', 'var(--color-accent)', '#a78bfa'];

// ─── Scan status indicator ────────────────────────────────────
function ScanIndicator({
  label, done, value, time,
}: {
  label: string;
  done: boolean;
  value: number | null;
  time: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0.875rem 1rem',
      background: done ? 'rgba(34,197,94,0.06)' : 'rgba(100,116,139,0.06)',
      border: `1px solid ${done ? 'var(--color-safe-border)' : 'var(--color-border)'}`,
      borderRadius: 'var(--radius-md)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {done
          ? <CheckCircle2 size={20} color="var(--color-safe)" />
          : <XCircle      size={20} color="var(--color-text-muted)" />}
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)' }}>
            {label} Scan
          </div>
          <div style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)', marginTop: 1 }}>{time}</div>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        {done && value !== null ? (
          <>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--color-text)' }}>
              {value} <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>ppm</span>
            </div>
            <div style={{
              fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-safe)',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              ✓ Completed
            </div>
          </>
        ) : (
          <div style={{
            fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <Clock size={12} /> Pending
          </div>
        )}
      </div>
    </div>
  );
}

export default function WorkerDetailPage() {
  const { workerId } = useParams<{ workerId: string }>();
  const navigate     = useNavigate();

  const worker = workerId ? getWorkerById(workerId) : undefined;

  if (!worker) {
    return (
      <div className="empty-state" style={{ padding: '6rem 2rem' }}>
        <User size={48} className="empty-state-icon" />
        <p className="empty-state-text">Worker not found.</p>
        <button className="btn btn-secondary" style={{ marginTop: '1rem' }} onClick={() => navigate('/workers')}>
          ← Back to Workers
        </button>
      </div>
    );
  }

  // Scan time labels per shift
  const scanTimes = {
    Morning:   { morning: '08:30 AM', lunch: '12:30 PM', evening: '03:30 PM' },
    Afternoon: { morning: '04:30 PM', lunch: '08:30 PM', evening: '11:30 PM' },
    Night:     { morning: '12:30 AM', lunch: '04:30 AM', evening: '07:30 AM' },
  }[worker.shift.label];

  const scansCompleted = [
    worker.scanStatus.morning,
    worker.scanStatus.lunch,
    worker.scanStatus.evening,
  ].filter(Boolean).length;

  // Chart data for 3-point visualization
  const chartData = [
    { period: 'Morning', exposure: worker.exposure.morning ?? 0, done: worker.scanStatus.morning },
    { period: 'Lunch',   exposure: worker.exposure.lunch   ?? 0, done: worker.scanStatus.lunch },
    { period: 'Evening', exposure: worker.exposure.evening ?? 0, done: worker.scanStatus.evening },
  ];

  // Working duration
  const workingHours = Math.floor((worker.workerId.charCodeAt(1) % 7) + 1);
  const workingMins  = (worker.workerId.charCodeAt(2) % 60);

  return (
    <>
      {/* Back */}
      <button className="back-btn" onClick={() => navigate('/workers')}>
        <ChevronLeft size={16} />
        Back to Workers
      </button>

      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">{worker.name}</h1>
          <p className="page-subtitle">{worker.workerId} · {worker.department} · {worker.shift.label} Shift</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{
            background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)', padding: '0.4rem 0.875rem',
            fontSize: '0.78rem', color: 'var(--color-text-dim)', fontWeight: 600,
          }}>
            {scansCompleted}/3 Scans Done
          </div>
          <StatusBadge status={worker.status} />
        </div>
      </div>

      {/* Info cards */}
      <div className="detail-grid" style={{ marginBottom: '1.5rem' }}>
        {/* Personal */}
        <div className="detail-info-card">
          <div className="detail-info-title">
            <User size={12} style={{ display: 'inline', marginRight: 4 }} />
            Personal Information
          </div>
          {[
            { k: 'Full Name',   v: worker.name },
            { k: 'Worker ID',   v: worker.workerId, mono: true },
            { k: 'Mobile',      v: worker.mobile },
            { k: 'Department',  v: worker.department },
            { k: 'Join Date',   v: new Date(worker.joinDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) },
          ].map(({ k, v, mono }) => (
            <div key={k} className="detail-info-row">
              <span className="detail-info-key">{k}</span>
              <span className="detail-info-value" style={mono ? { color: 'var(--color-accent)', fontFamily: 'monospace' } : undefined}>{v}</span>
            </div>
          ))}
        </div>

        {/* Shift */}
        <div className="detail-info-card">
          <div className="detail-info-title">
            <Clock size={12} style={{ display: 'inline', marginRight: 4 }} />
            Shift Information
          </div>
          {[
            { k: 'Shift',             v: worker.shift.label },
            { k: 'Shift Start',       v: worker.shift.start },
            { k: 'Shift End',         v: worker.shift.end },
            { k: 'Working Duration',  v: `${workingHours}h ${String(workingMins).padStart(2,'0')}m`, highlight: true },
            { k: 'On Duty',           v: worker.isWorking ? '🟢 Yes' : '⚪ No' },
            { k: 'Last Scan',         v: worker.lastScan },
          ].map(({ k, v, highlight }) => (
            <div key={k} className="detail-info-row">
              <span className="detail-info-key">{k}</span>
              <span className="detail-info-value" style={highlight ? { color: 'var(--color-warning)' } : undefined}>{v}</span>
            </div>
          ))}
        </div>

        {/* Exposure summary */}
        <div className="detail-info-card">
          <div className="detail-info-title">
            <Activity size={12} style={{ display: 'inline', marginRight: 4 }} />
            Today's Exposure Summary
          </div>
          <div className="detail-info-row">
            <span className="detail-info-key">Morning Exposure</span>
            <span className="detail-info-value" style={{ color: 'var(--color-warning)' }}>
              {worker.scanStatus.morning ? `${worker.exposure.morning} ppm` : '—'}
            </span>
          </div>
          <div className="detail-info-row">
            <span className="detail-info-key">Lunch Exposure</span>
            <span className="detail-info-value" style={{ color: 'var(--color-accent)' }}>
              {worker.scanStatus.lunch ? `${worker.exposure.lunch} ppm` : '—'}
            </span>
          </div>
          <div className="detail-info-row">
            <span className="detail-info-key">Evening Exposure</span>
            <span className="detail-info-value" style={{ color: '#a78bfa' }}>
              {worker.scanStatus.evening ? `${worker.exposure.evening} ppm` : '—'}
            </span>
          </div>
          <div style={{ margin: '0.5rem 0', borderBottom: '1px dashed var(--color-border)' }} />
          <div className="detail-info-row">
            <span className="detail-info-key" style={{ fontWeight: 700 }}>Cumulative</span>
            <span className="detail-info-value" style={{
              fontSize: '1.1rem',
              color: worker.status === 'DANGER' ? 'var(--color-danger)' : 'var(--color-safe)',
            }}>
              {worker.exposure.cumulative} ppm
            </span>
          </div>
          <div className="detail-info-row">
            <span className="detail-info-key">Safe Threshold</span>
            <span className="detail-info-value" style={{ color: 'var(--color-text-muted)' }}>10.0 ppm</span>
          </div>
          <div className="detail-info-row">
            <span className="detail-info-key">Daily Status</span>
            <StatusBadge status={worker.status} />
          </div>
        </div>
      </div>

      {/* 3-Point Exposure Chart */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <div className="card-title">Today's Exposure — 3 Scan Points</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            Morning → Lunch → Evening &nbsp;·&nbsp;
            Cumulative = {worker.exposure.cumulative} ppm
          </div>
        </div>

        {/* Cumulative formula display */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.75rem 1rem',
          background: 'var(--color-surface-2)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '1rem',
          flexWrap: 'wrap',
          fontSize: '0.9rem',
        }}>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem', fontWeight: 600 }}>
            CUMULATIVE =
          </span>
          <span style={{ fontWeight: 800, color: 'var(--color-warning)' }}>
            {worker.exposure.morning ?? '?'} <span style={{ fontSize: '0.72rem' }}>Morning</span>
          </span>
          <span style={{ color: 'var(--color-text-muted)' }}>+</span>
          <span style={{ fontWeight: 800, color: 'var(--color-accent)' }}>
            {worker.exposure.lunch ?? '?'} <span style={{ fontSize: '0.72rem' }}>Lunch</span>
          </span>
          <span style={{ color: 'var(--color-text-muted)' }}>+</span>
          <span style={{ fontWeight: 800, color: '#a78bfa' }}>
            {worker.exposure.evening ?? '?'} <span style={{ fontSize: '0.72rem' }}>Evening</span>
          </span>
          <span style={{ color: 'var(--color-text-muted)' }}>=</span>
          <span style={{
            fontWeight: 900, fontSize: '1.1rem',
            color: worker.status === 'DANGER' ? 'var(--color-danger)' : 'var(--color-safe)',
          }}>
            {worker.exposure.cumulative} ppm
          </span>
        </div>

        <div className="chart-wrapper">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="period" tick={{ fill: '#475569', fontSize: 13, fontWeight: 600 }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(v, _n, props) => [
                  props.payload.done ? `${v} ppm` : 'Pending',
                  props.payload.period,
                ]}
              />
              <ReferenceLine
                y={10}
                stroke="var(--color-danger)"
                strokeDasharray="5 3"
                label={{ value: 'Danger threshold (10 ppm)', fill: 'var(--color-danger)', fontSize: 10, position: 'insideTopRight' }}
              />
              <Bar dataKey="exposure" radius={[8, 8, 0, 0]} maxBarSize={90}>
                {chartData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.done ? PERIOD_COLORS[i] : 'var(--color-border)'}
                    fillOpacity={entry.done ? 0.9 : 0.5}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Scan Status Section */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Scan Status — Today</div>
          {scansCompleted < 3 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--color-warning)', fontWeight: 600 }}>
              <AlertCircle size={14} />
              {3 - scansCompleted} scan{3 - scansCompleted > 1 ? 's' : ''} pending
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <ScanIndicator
            label="Morning"
            done={worker.scanStatus.morning}
            value={worker.exposure.morning}
            time={worker.scanStatus.morning ? `Completed at ${scanTimes.morning}` : `Expected: ${scanTimes.morning}`}
          />
          <ScanIndicator
            label="Lunch Break"
            done={worker.scanStatus.lunch}
            value={worker.exposure.lunch}
            time={worker.scanStatus.lunch ? `Completed at ${scanTimes.lunch}` : `Expected: ${scanTimes.lunch}`}
          />
          <ScanIndicator
            label="Evening Break"
            done={worker.scanStatus.evening}
            value={worker.exposure.evening}
            time={worker.scanStatus.evening ? `Completed at ${scanTimes.evening}` : `Expected: ${scanTimes.evening}`}
          />
        </div>

        {scansCompleted === 3 && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            background: 'var(--color-safe-bg)',
            border: '1px solid var(--color-safe-border)',
            borderRadius: 'var(--radius-md)',
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-safe)',
          }}>
            <CheckCircle2 size={16} />
            All 3 scans completed for today. Final cumulative: {worker.exposure.cumulative} ppm.
          </div>
        )}
      </div>
    </>
  );
}
