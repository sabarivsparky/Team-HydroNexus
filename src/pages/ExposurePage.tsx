// ─── Exposure Monitoring Page — 3-Scan Model ──────────────
import { useState, useMemo } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, ReferenceLine,
} from 'recharts';
import { Activity, ShieldCheck, TriangleAlert, Gauge, ClipboardCheck, ClipboardX } from 'lucide-react';
import StatusBadge  from '../components/ui/StatusBadge';
import StatCard     from '../components/ui/StatCard';
import {
  getDashboardSummary,
  getSafeVsDangerChartData,
  getScanCompletionChartData,
  getScanPeriodAverages,
  getThreePointExposures,
  filterWorkers,
} from '../data/mockDataService';
import type { ShiftLabel } from '../data/types';

const TOOLTIP_STYLE = {
  backgroundColor: '#ffffff',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  color: '#0f172a',
  fontSize: 12,
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
};

export default function ExposurePage() {
  const [shiftFilter, setShiftFilter] = useState<ShiftLabel | 'ALL'>('ALL');

  const summary    = getDashboardSummary();
  const pieStatus  = getSafeVsDangerChartData();
  const pieScan    = getScanCompletionChartData();
  const periodAvgs = getScanPeriodAverages();
  const threePoint = getThreePointExposures(12);
  const workers    = useMemo(() => filterWorkers('', 'ALL', shiftFilter), [shiftFilter]);

  const avgCumulative = (workers.reduce((a, w) => a + w.exposure.cumulative, 0) / (workers.length || 1)).toFixed(1);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Exposure Monitoring</h1>
        <p className="page-subtitle">
          Daily 3-scan exposure analytics — Morning · Lunch Break · Evening Break.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="stat-cards-grid" style={{ marginBottom: '2rem' }}>
        <StatCard label="Avg Cumulative"    value={`${avgCumulative} ppm`} sub="Per worker today"         icon={<Gauge size={22} />}           variant="exposure" />
        <StatCard label="Safe Workers"      value={summary.safeWorkers}   sub="Cumulative < 10 ppm"       icon={<ShieldCheck size={22} />}     variant="safe" />
        <StatCard label="Danger Workers"    value={summary.dangerWorkers} sub="Cumulative ≥ 10 ppm"       icon={<TriangleAlert size={22} />}   variant="danger" />
        <StatCard label="All Scans Done"    value={summary.allScansCompleted} sub="3/3 scans completed"   icon={<ClipboardCheck size={22} />}  variant="total" />
        <StatCard label="Incomplete Scans"  value={summary.incompleteScans}   sub="Missing ≥ 1 scan"      icon={<ClipboardX size={22} />}      variant="working" />
      </div>

      {/* Shift Filter */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Shift:</span>
        {(['ALL', 'Morning', 'Afternoon', 'Night'] as const).map(s => (
          <button
            key={s}
            id={`exposure-shift-filter-${s.toLowerCase()}`}
            className={`btn btn-${shiftFilter === s ? 'primary' : 'secondary'}`}
            style={{ padding: '0.35rem 1rem', fontSize: '0.8rem' }}
            onClick={() => setShiftFilter(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Charts Row 1 — Period Averages + Safe/Danger Pie */}
      <div className="exposure-grid">
        {/* Grouped bar: avg exposure per period */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Average Exposure per Scan Period</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              Average ppm across all workers
            </div>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={periodAvgs} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="period" tick={{ fill: '#475569', fontSize: 13, fontWeight: 600 }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, name) => [
                  `${v} ppm`,
                  name === 'average' ? 'Avg Exposure' : name === 'max' ? 'Peak Exposure' : String(name),
                ]} />
                <ReferenceLine y={10} stroke="var(--color-danger)" strokeDasharray="5 3"
                  label={{ value: 'Danger (10 ppm)', fill: 'var(--color-danger)', fontSize: 9, position: 'insideTopRight' }} />
                <Bar name="Avg Exposure"  dataKey="average" radius={[6,6,0,0]} maxBarSize={70}>
                  {periodAvgs.map((_, i) => (
                    <Cell key={i} fill={['var(--color-warning)', 'var(--color-accent)', '#a78bfa'][i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Danger count summary */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--color-border)' }}>
            {periodAvgs.map((p, i) => (
              <div key={p.period} style={{
                flex: 1, textAlign: 'center', background: 'var(--color-surface-2)',
                borderRadius: 'var(--radius-md)', padding: '0.6rem',
              }}>
                <div style={{ fontSize: '0.7rem', color: ['var(--color-warning)', 'var(--color-accent)', '#a78bfa'][i], fontWeight: 700, marginBottom: 2 }}>
                  {p.period}
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-text)' }}>{p.average} ppm avg</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 1 }}>peak {p.max} ppm</div>
                {p.dangerCount > 0 && (
                  <div style={{ fontSize: '0.68rem', color: 'var(--color-danger)', fontWeight: 700, marginTop: 2 }}>
                    {p.dangerCount} above threshold
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Pie — Status + Scan completion */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Safe vs Danger</div>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieStatus} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                  paddingAngle={4} dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={{ stroke: 'var(--color-text-muted)' }}
                >
                  {pieStatus.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Scan Completion
            </div>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height={100}>
                <PieChart>
                  <Pie data={pieScan} cx="50%" cy="50%" innerRadius={28} outerRadius={45} paddingAngle={3} dataKey="value">
                    {pieScan.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend
                    formatter={(val, entry: any) => (
                      <span style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>
                        {val}: <strong style={{ color: entry.payload.color }}>{entry.payload.value}</strong>
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Grouped 3-bar chart: top workers M/L/E */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <div className="card-title">Worker Exposure — Morning · Lunch · Evening (Top 12)</div>
          <div style={{ display: 'flex', gap: '1rem', fontSize: 11 }}>
            <span style={{ color: 'var(--color-warning)' }}>■ Morning</span>
            <span style={{ color: 'var(--color-accent)'  }}>■ Lunch</span>
            <span style={{ color: '#a78bfa'              }}>■ Evening</span>
          </div>
        </div>
        <div className="chart-wrapper">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={threePoint} margin={{ top: 5, right: 15, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [`${v} ppm`]} />
              <ReferenceLine y={10} stroke="var(--color-danger)" strokeDasharray="5 3" />
              <Bar dataKey="morning" name="Morning" fill="var(--color-warning)" radius={[3,3,0,0]} fillOpacity={0.85} />
              <Bar dataKey="lunch"   name="Lunch"   fill="var(--color-accent)"  radius={[3,3,0,0]} fillOpacity={0.85} />
              <Bar dataKey="evening" name="Evening" fill="#a78bfa"              radius={[3,3,0,0]} fillOpacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Worker-wise table */}
      <div className="table-container">
        <div className="table-toolbar">
          <span className="table-toolbar-title">
            Worker Exposure Detail — {shiftFilter === 'ALL' ? 'All Shifts' : `${shiftFilter} Shift`}
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{workers.length} workers</span>
        </div>
        <div style={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}>
          <table aria-label="Worker exposure detail table">
            <thead>
              <tr>
                <th>Worker</th>
                <th>ID</th>
                <th>Shift</th>
                <th style={{ color: 'var(--color-warning)' }}>Morning (ppm)</th>
                <th style={{ color: 'var(--color-accent)'  }}>Lunch (ppm)</th>
                <th style={{ color: '#a78bfa'              }}>Evening (ppm)</th>
                <th>Cumulative</th>
                <th>Scans</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {workers
                .sort((a, b) => b.exposure.cumulative - a.exposure.cumulative)
                .map(w => {
                  const done = [w.scanStatus.morning, w.scanStatus.lunch, w.scanStatus.evening].filter(Boolean).length;
                  return (
                    <tr key={w.workerId} className={w.status === 'DANGER' ? 'danger-row' : ''}>
                      <td className="td-main">{w.name}</td>
                      <td className="td-mono">{w.workerId}</td>
                      <td style={{ fontSize: '0.78rem' }}>{w.shift.label}</td>
                      <td>
                        {w.scanStatus.morning
                          ? <span style={{ fontWeight: 700, color: 'var(--color-warning)' }}>{w.exposure.morning}</span>
                          : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>—</span>}
                      </td>
                      <td>
                        {w.scanStatus.lunch
                          ? <span style={{ fontWeight: 700, color: 'var(--color-accent)' }}>{w.exposure.lunch}</span>
                          : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>—</span>}
                      </td>
                      <td>
                        {w.scanStatus.evening
                          ? <span style={{ fontWeight: 700, color: '#a78bfa' }}>{w.exposure.evening}</span>
                          : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>—</span>}
                      </td>
                      <td>
                        <span className={`td-exposure td-exposure--${w.status === 'DANGER' ? 'danger' : 'safe'}`}>
                          {w.exposure.cumulative}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: done === 3 ? 'var(--color-safe)' : 'var(--color-warning)' }}>
                          {done}/3 ✓
                        </span>
                      </td>
                      <td><StatusBadge status={w.status} size="sm" /></td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
