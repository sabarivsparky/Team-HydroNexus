// ─── Industrial Safety Command Center — Dashboard Page ─────────────
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, ShieldCheck, TriangleAlert, ClipboardX,
  Clock, ArrowRight, CheckCircle2, Search, ArrowDown,
  Eye, ChevronLeft, ChevronRight, AlertOctagon,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import StatCard    from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import {
  getDashboardSummary,
  getAllWorkers,
  getSafeVsDangerChartData,
  getScanPeriodAverages,
  filterWorkers,
} from '../data/mockDataService';
import type { ShiftLabel, Worker } from '../data/types';

const TOOLTIP_STYLE = {
  backgroundColor: '#ffffff',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
  color: '#0f172a',
  fontSize: 12,
  padding: '8px 12px',
};

const TABLE_PAGE_SIZE = 10;

export default function DashboardPage() {
  const navigate   = useNavigate();
  const summary    = getDashboardSummary();
  const allWorkers = getAllWorkers();
  const pieStatus  = getSafeVsDangerChartData();
  const periodAvgs = getScanPeriodAverages();

  // Search & Filter state for the worker monitoring table
  const [tableQuery, setTableQuery]   = useState('');
  const [tableStatus, setTableStatus] = useState<'ALL' | 'SAFE' | 'DANGER'>('ALL');
  const [tableShift, setTableShift]   = useState<'ALL' | ShiftLabel>('ALL');
  const [tablePage, setTablePage]     = useState(1);

  // Tab state for "Workers Requiring Attention"
  const [attentionTab, setAttentionTab] = useState<'danger' | 'incomplete'>('danger');

  // Danger workers (Cumulative >= 10 ppm)
  const dangerWorkers = useMemo(
    () => allWorkers.filter(w => w.status === 'DANGER'),
    [allWorkers]
  );

  // Incomplete scan workers (missing at least 1 scan)
  const incompleteWorkers = useMemo(
    () => allWorkers.filter(w => !(w.scanStatus.morning && w.scanStatus.lunch && w.scanStatus.evening)),
    [allWorkers]
  );

  // Filtered workers for monitoring table
  const filteredWorkers = useMemo(
    () => filterWorkers(tableQuery, tableStatus, tableShift),
    [tableQuery, tableStatus, tableShift]
  );

  const totalTablePages = Math.max(1, Math.ceil(filteredWorkers.length / TABLE_PAGE_SIZE));
  const tableData = filteredWorkers.slice(
    (tablePage - 1) * TABLE_PAGE_SIZE,
    tablePage * TABLE_PAGE_SIZE
  );

  // Scan period completion counts
  const morningDoneCount  = allWorkers.filter(w => w.scanStatus.morning).length;
  const lunchDoneCount    = allWorkers.filter(w => w.scanStatus.lunch).length;
  const eveningDoneCount  = allWorkers.filter(w => w.scanStatus.evening).length;

  return (
    <>
      {/* ─── Command Center Header ────────────────────────────── */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Industrial Safety Command Center</h1>
          <p className="page-subtitle">
            H₂S Worker Exposure Monitoring &bull; 3 Daily Scans Protocol (Morning &bull; Lunch &bull; Evening) &bull; Safety Limit: 10.0 ppm
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6,
            padding: '6px 12px', fontSize: '0.78rem', color: '#334155', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a' }} />
            Active Monitoring: <strong>3 Shifts</strong>
          </div>
        </div>
      </div>

      {/* ─── Hierarchy 1–4: Top 4 Primary Safety Metrics ──────── */}
      <div className="stat-cards-grid">
        {/* 1. Total Workers */}
        <StatCard
          label="1. Total Workers"
          value={summary.totalWorkers}
          sub="Registered plant workforce"
          icon={<Users size={20} />}
          variant="total"
        />

        {/* 2. Safe Workers */}
        <StatCard
          label="2. Safe Workers"
          value={summary.safeWorkers}
          sub={`${Math.round((summary.safeWorkers / summary.totalWorkers) * 100)}% compliant (< 10.0 ppm)`}
          icon={<ShieldCheck size={20} />}
          variant="safe"
        />

        {/* 3. Danger Workers */}
        <StatCard
          label="3. Danger Workers"
          value={summary.dangerWorkers}
          sub="Cumulative exposure ≥ 10.0 ppm"
          icon={<TriangleAlert size={20} />}
          variant="danger"
        />

        {/* 4. Workers with Incomplete Scans */}
        <StatCard
          label="4. Incomplete Scans"
          value={summary.incompleteScans}
          sub="Missing 1+ daily scan check"
          icon={<ClipboardX size={20} />}
          variant="working"
        />
      </div>

      {/* ─── Hierarchy 5: Today's Exposure Overview ───────────── */}
      <div className="workflow-stepper">
        <div className="workflow-header">
          <div className="workflow-title">
            <span style={{ color: 'var(--color-accent)', fontWeight: 800 }}>5.</span>
            Today&apos;s Exposure Overview &bull; 3-Scan Workflow Architecture
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
            Formula: Cumulative = Morning + Lunch + Evening
          </span>
        </div>

        {/* Visual Workflow: Morning -> Lunch -> Evening -> Cumulative */}
        <div className="workflow-grid">
          {/* Step 1: Morning */}
          <div className="workflow-step">
            <div className="workflow-step-num">Scan Period 1</div>
            <div className="workflow-step-name">Morning Exposure</div>
            <div className="workflow-step-stat" style={{ color: '#d97706' }}>
              {periodAvgs[0]?.average ?? 0} <span style={{ fontSize: '0.75rem' }}>ppm avg</span>
            </div>
            <div className="workflow-step-sub">
              {morningDoneCount}/{allWorkers.length} Scanned &bull; Peak: {periodAvgs[0]?.max} ppm
            </div>
          </div>

          <div className="workflow-arrow">&rarr;</div>

          {/* Step 2: Lunch */}
          <div className="workflow-step">
            <div className="workflow-step-num">Scan Period 2</div>
            <div className="workflow-step-name">Lunch Exposure</div>
            <div className="workflow-step-stat" style={{ color: '#2563eb' }}>
              {periodAvgs[1]?.average ?? 0} <span style={{ fontSize: '0.75rem' }}>ppm avg</span>
            </div>
            <div className="workflow-step-sub">
              {lunchDoneCount}/{allWorkers.length} Scanned &bull; Peak: {periodAvgs[1]?.max} ppm
            </div>
          </div>

          <div className="workflow-arrow">&rarr;</div>

          {/* Step 3: Evening */}
          <div className="workflow-step">
            <div className="workflow-step-num">Scan Period 3</div>
            <div className="workflow-step-name">Evening Exposure</div>
            <div className="workflow-step-stat" style={{ color: '#7c3aed' }}>
              {periodAvgs[2]?.average ?? 0} <span style={{ fontSize: '0.75rem' }}>ppm avg</span>
            </div>
            <div className="workflow-step-sub">
              {eveningDoneCount}/{allWorkers.length} Scanned &bull; Peak: {periodAvgs[2]?.max} ppm
            </div>
          </div>

          <div className="workflow-arrow" style={{ color: '#16a34a' }}>&darr;</div>

          {/* Step 4: Cumulative Result */}
          <div className="workflow-step workflow-step--highlight">
            <div className="workflow-step-num" style={{ color: 'var(--color-accent)' }}>Daily Aggregate</div>
            <div className="workflow-step-name">Cumulative Exposure</div>
            <div className="workflow-step-stat" style={{ color: '#0f172a' }}>
              {(summary.totalCumulativeExposure / summary.totalWorkers).toFixed(2)} <span style={{ fontSize: '0.75rem' }}>ppm plant avg</span>
            </div>
            <div className="workflow-step-sub" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: '#16a34a', fontWeight: 700 }}>Safe: &lt; 10 ppm</span>
              <span>&bull;</span>
              <span style={{ color: '#dc2626', fontWeight: 700 }}>Danger: &ge; 10 ppm</span>
            </div>
          </div>
        </div>
      </div>

      {/* Exposure Charts (No continuous real-time charts; only 3-scan periods) */}
      <div className="dashboard-charts-grid">
        {/* Left: 3-Scan Exposure Comparison Chart */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Average Exposure by Scan Period</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                Cross-shift average vs peak H₂S levels (ppm) across the 3 scan windows
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.85rem', fontSize: '0.75rem', fontWeight: 600, alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#334155' }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, background: '#2563eb', borderRadius: 2 }} /> Avg Exposure
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#334155' }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, background: '#f87171', borderRadius: 2 }} /> Peak Level
              </span>
            </div>
          </div>

          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={periodAvgs} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="period"
                  tick={{ fill: '#475569', fontSize: 12, fontWeight: 700 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  unit=" ppm"
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v: any, name: any) => [
                    `${v} ppm`,
                    name === 'average' ? 'Average Exposure' : 'Peak Exposure',
                  ]}
                />
                <Bar dataKey="average" name="average" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={45} />
                <Bar dataKey="max" name="max" fill="#f87171" radius={[4, 4, 0, 0]} maxBarSize={45} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Period Summary Footnotes */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem',
            marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9',
          }}>
            {periodAvgs.map(p => (
              <div key={p.period} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{p.period} Scan</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-mono)' }}>
                  {p.average} <span style={{ fontSize: '0.7rem' }}>ppm</span>
                </div>
                <div style={{ fontSize: '0.7rem', color: p.dangerCount > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                  {p.dangerCount > 0 ? `${p.dangerCount} threshold breaches` : '0 breaches'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Workforce Safety Distribution */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Workforce Safety Status</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                Cumulative exposure distribution
              </div>
            </div>
          </div>

          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={170}>
              <PieChart>
                <Pie
                  data={pieStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  <Cell fill="#16a34a" />
                  <Cell fill="#dc2626" />
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend
                  formatter={(value, entry: any) => (
                    <span style={{ color: '#334155', fontSize: 12, fontWeight: 600 }}>
                      {value}: <strong style={{ color: entry.payload.color }}>{entry.payload.value}</strong>
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Mini Scan Completion Progress */}
          <div style={{
            display: 'flex', flexDirection: 'column', gap: '0.45rem',
            marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600 }}>
              <span style={{ color: '#475569' }}>3-Scan Protocol Compliance</span>
              <span style={{ color: '#0f172a', fontFamily: 'var(--font-mono)' }}>
                {Math.round((summary.allScansCompleted / summary.totalWorkers) * 100)}%
              </span>
            </div>
            <div style={{ width: '100%', height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${(summary.allScansCompleted / summary.totalWorkers) * 100}%`,
                  height: '100%',
                  background: '#1d4ed8',
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b' }}>
              <span>{summary.allScansCompleted} all 3 scans done</span>
              <span style={{ color: '#d97706', fontWeight: 600 }}>{summary.incompleteScans} pending scans</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Hierarchy 6: Workers Requiring Attention ─────────── */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertOctagon size={18} color="#dc2626" />
              <span>6. Workers Requiring Immediate Attention</span>
            </div>
            {/* Attention Tabs */}
            <div style={{ display: 'flex', background: '#f1f5f9', padding: 2, borderRadius: 6 }}>
              <button
                type="button"
                onClick={() => setAttentionTab('danger')}
                style={{
                  padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700, borderRadius: 4,
                  background: attentionTab === 'danger' ? '#dc2626' : 'transparent',
                  color: attentionTab === 'danger' ? '#ffffff' : '#64748b',
                  border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                Danger Level ({dangerWorkers.length})
              </button>
              <button
                type="button"
                onClick={() => setAttentionTab('incomplete')}
                style={{
                  padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700, borderRadius: 4,
                  background: attentionTab === 'incomplete' ? '#d97706' : 'transparent',
                  color: attentionTab === 'incomplete' ? '#ffffff' : '#64748b',
                  border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                Incomplete Scans ({incompleteWorkers.length})
              </button>
            </div>
          </div>
          <button
            className="btn btn-ghost"
            onClick={() => navigate(attentionTab === 'danger' ? '/danger' : '/shifts')}
          >
            View Full List <ArrowRight size={14} />
          </button>
        </div>

        {/* Attention List Content */}
        {attentionTab === 'danger' ? (
          dangerWorkers.length === 0 ? (
            <div className="empty-state">
              <ShieldCheck size={36} color="#16a34a" />
              <p className="empty-state-text">Zero workers currently in danger zone.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.85rem' }}>
              {dangerWorkers.slice(0, 6).map((w: Worker) => (
                <div
                  key={w.workerId}
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fca5a5',
                    borderLeft: '4px solid #dc2626',
                    borderRadius: 6,
                    padding: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                  onClick={() => navigate(`/workers/${w.workerId}`)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>{w.name}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                        {w.workerId} &bull; {w.shift.label}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{
                        background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5',
                        fontWeight: 800, fontSize: '0.95rem', padding: '2px 8px', borderRadius: 4,
                        fontFamily: 'var(--font-mono)',
                      }}>
                        {w.exposure.cumulative} ppm
                      </span>
                      <div style={{ fontSize: '0.65rem', color: '#991b1b', fontWeight: 600, marginTop: 2 }}>
                        &ge; 10.0 ppm Threshold
                      </div>
                    </div>
                  </div>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem',
                    color: '#475569', background: '#ffffff', padding: '4px 8px', borderRadius: 4,
                    border: '1px solid #fecaca',
                  }}>
                    <span>M: <strong>{w.exposure.morning ?? '—'}</strong></span>
                    <span>L: <strong>{w.exposure.lunch ?? '—'}</strong></span>
                    <span>E: <strong>{w.exposure.evening ?? '—'}</strong></span>
                    <span style={{ color: '#b91c1c', fontWeight: 700 }}>CRITICAL PPE AUDIT</span>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.85rem' }}>
            {incompleteWorkers.slice(0, 6).map((w: Worker) => {
              const missingList: string[] = [];
              if (!w.scanStatus.morning) missingList.push('Morning');
              if (!w.scanStatus.lunch)   missingList.push('Lunch');
              if (!w.scanStatus.evening) missingList.push('Evening');

              return (
                <div
                  key={w.workerId}
                  style={{
                    background: '#fffbeb',
                    border: '1px solid #fcd34d',
                    borderLeft: '4px solid #d97706',
                    borderRadius: 6,
                    padding: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                  onClick={() => navigate(`/workers/${w.workerId}`)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>{w.name}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                        {w.workerId} &bull; {w.shift.label}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{
                        background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d',
                        fontWeight: 700, fontSize: '0.75rem', padding: '2px 8px', borderRadius: 4,
                      }}>
                        Missing {missingList.length} Scan{missingList.length > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem',
                    color: '#92400e', background: '#ffffff', padding: '4px 8px', borderRadius: 4,
                    border: '1px solid #fde68a', fontWeight: 600,
                  }}>
                    <span>Missing: {missingList.join(', ')}</span>
                    <span style={{ color: '#b45309' }}>Prompt Worker &rarr;</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Hierarchy 7: Worker Monitoring Table ─────────────── */}
      <div className="table-container">
        {/* Table Toolbar */}
        <div className="table-toolbar">
          <div>
            <div className="table-toolbar-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--color-accent)', fontWeight: 800 }}>7.</span>
              Worker Safety Monitoring Table
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              Complete 3-scan daily exposure records &bull; {filteredWorkers.length} personnel monitored
            </div>
          </div>

          <div className="table-toolbar-actions">
            {/* Search Input */}
            <div className="search-input-wrap">
              <Search className="search-input-icon" />
              <input
                type="text"
                placeholder="Search worker or ID..."
                className="search-input"
                value={tableQuery}
                onChange={e => { setTableQuery(e.target.value); setTablePage(1); }}
                id="dashboard-worker-search-input"
              />
            </div>

            {/* Status Filter */}
            <select
              className="filter-select"
              value={tableStatus}
              onChange={e => { setTableStatus(e.target.value as any); setTablePage(1); }}
              id="dashboard-status-filter"
            >
              <option value="ALL">All Statuses</option>
              <option value="SAFE">Safe Only (&lt; 10 ppm)</option>
              <option value="DANGER">Danger Only (&ge; 10 ppm)</option>
            </select>

            {/* Shift Filter */}
            <select
              className="filter-select"
              value={tableShift}
              onChange={e => { setTableShift(e.target.value as any); setTablePage(1); }}
              id="dashboard-shift-filter"
            >
              <option value="ALL">All Shifts</option>
              <option value="Shift A">Shift A (06:00 - 14:00)</option>
              <option value="Shift B">Shift B (14:00 - 22:00)</option>
              <option value="Shift C">Shift C (22:00 - 06:00)</option>
            </select>
          </div>
        </div>

        {/* Workers Table */}
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Worker</th>
                <th>Shift</th>
                <th>Morning (ppm)</th>
                <th>Lunch (ppm)</th>
                <th>Evening (ppm)</th>
                <th>Cumulative</th>
                <th>Safety Status</th>
                <th>Last Scan</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {tableData.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    No workers match your filter criteria.
                  </td>
                </tr>
              ) : (
                tableData.map(w => {
                  const isDanger = w.status === 'DANGER';
                  return (
                    <tr key={w.workerId} className={isDanger ? 'danger-row' : undefined}>
                      <td>
                        <div className="td-main">{w.name}</div>
                        <div className="td-mono">{w.workerId}</div>
                      </td>

                      <td>
                        <span style={{ fontWeight: 600, fontSize: '0.8rem', color: '#334155' }}>
                          {w.shift.label}
                        </span>
                      </td>

                      {/* Morning Scan */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          {w.scanStatus.morning ? (
                            <CheckCircle2 size={13} color="#16a34a" />
                          ) : (
                            <Clock size={13} color="#94a3b8" />
                          )}
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: w.scanStatus.morning ? '#0f172a' : '#94a3b8' }}>
                            {w.exposure.morning !== null ? `${w.exposure.morning} ppm` : 'Pending'}
                          </span>
                        </div>
                      </td>

                      {/* Lunch Scan */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          {w.scanStatus.lunch ? (
                            <CheckCircle2 size={13} color="#16a34a" />
                          ) : (
                            <Clock size={13} color="#94a3b8" />
                          )}
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: w.scanStatus.lunch ? '#0f172a' : '#94a3b8' }}>
                            {w.exposure.lunch !== null ? `${w.exposure.lunch} ppm` : 'Pending'}
                          </span>
                        </div>
                      </td>

                      {/* Evening Scan */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          {w.scanStatus.evening ? (
                            <CheckCircle2 size={13} color="#16a34a" />
                          ) : (
                            <Clock size={13} color="#94a3b8" />
                          )}
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: w.scanStatus.evening ? '#0f172a' : '#94a3b8' }}>
                            {w.exposure.evening !== null ? `${w.exposure.evening} ppm` : 'Pending'}
                          </span>
                        </div>
                      </td>

                      {/* Cumulative Total */}
                      <td>
                        <span className={`td-exposure ${isDanger ? 'td-exposure--danger' : 'td-exposure--safe'}`}>
                          {w.exposure.cumulative} ppm
                        </span>
                      </td>

                      {/* Status */}
                      <td>
                        <StatusBadge status={w.status} size="sm" />
                      </td>

                      {/* Last Scan Time */}
                      <td style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {w.lastScan}
                      </td>

                      {/* Action */}
                      <td>
                        <button
                          className="btn btn-ghost"
                          onClick={() => navigate(`/workers/${w.workerId}`)}
                          aria-label={`View worker ${w.name}`}
                          id={`dashboard-view-${w.workerId}`}
                        >
                          <Eye size={14} />
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination */}
        <div className="pagination">
          <div className="pagination-info">
            Showing {Math.min((tablePage - 1) * TABLE_PAGE_SIZE + 1, filteredWorkers.length)}&ndash;
            {Math.min(tablePage * TABLE_PAGE_SIZE, filteredWorkers.length)} of {filteredWorkers.length} workers
          </div>

          <div className="pagination-controls">
            <button
              className="pagination-btn"
              onClick={() => setTablePage(p => Math.max(1, p - 1))}
              disabled={tablePage === 1}
              aria-label="Previous Page"
            >
              <ChevronLeft size={14} />
            </button>

            {Array.from({ length: totalTablePages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                className={`pagination-btn ${p === tablePage ? 'active' : ''}`}
                onClick={() => setTablePage(p)}
              >
                {p}
              </button>
            ))}

            <button
              className="pagination-btn"
              onClick={() => setTablePage(p => Math.min(totalTablePages, p + 1))}
              disabled={tablePage === totalTablePages}
              aria-label="Next Page"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
