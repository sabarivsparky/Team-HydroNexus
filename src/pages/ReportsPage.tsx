// ─── Reports Page — 3-Scan Model ──────────────────────────
import { useState, useMemo } from 'react';
import { FileText, Download, Search } from 'lucide-react';
import StatusBadge from '../components/ui/StatusBadge';
import {
  getWorkerExposureSummaries,
  getDashboardSummary,
  getAllWorkers,
} from '../data/mockDataService';
import Papa from 'papaparse';

type ShiftFilter  = 'ALL' | 'Morning' | 'Afternoon' | 'Night';
type StatusFilter = 'ALL' | 'SAFE' | 'DANGER';
type ScanFilter   = 'ALL' | 'complete' | 'incomplete';

export default function ReportsPage() {
  const [query, setQuery]         = useState('');
  const [shiftFilter, setShift]   = useState<ShiftFilter>('ALL');
  const [statusFilter, setStatus] = useState<StatusFilter>('ALL');
  const [scanFilter, setScan]     = useState<ScanFilter>('ALL');

  const summary    = getDashboardSummary();
  const summaries  = useMemo(() => getWorkerExposureSummaries(), []);
  const allWorkers = getAllWorkers();

  const filtered = useMemo(() => {
    let data = summaries;
    if (query.trim()) {
      const q = query.toLowerCase();
      data = data.filter(s => s.name.toLowerCase().includes(q) || s.workerId.toLowerCase().includes(q));
    }
    if (statusFilter !== 'ALL') data = data.filter(s => s.status === statusFilter);
    if (shiftFilter  !== 'ALL') data = data.filter(s => s.shift.toLowerCase().startsWith(shiftFilter.toLowerCase()));
    if (scanFilter === 'complete')   data = data.filter(s => s.scansCompleted === 3);
    if (scanFilter === 'incomplete') data = data.filter(s => s.scansCompleted < 3);
    return data;
  }, [summaries, query, statusFilter, shiftFilter, scanFilter]);

  const handleCSVExport = () => {
    const rows = filtered.map(s => ({
      'Worker ID':              s.workerId,
      'Worker Name':            s.name,
      'Shift':                  s.shift,
      'Morning Exposure (ppm)': s.morningExposure  ?? 'Pending',
      'Lunch Exposure (ppm)':   s.lunchExposure    ?? 'Pending',
      'Evening Exposure (ppm)': s.eveningExposure  ?? 'Pending',
      'Cumulative Exposure (ppm)': s.cumulativeExposure,
      'Scans Completed':        `${s.scansCompleted}/3`,
      'Status':                 s.status,
    }));
    const csv  = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = `h2s_exposure_report_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const morningCnt   = allWorkers.filter(w => w.shift.label === 'Morning').length;
  const afternoonCnt = allWorkers.filter(w => w.shift.label === 'Afternoon').length;
  const nightCnt     = allWorkers.filter(w => w.shift.label === 'Night').length;
  const avgCumul     = (allWorkers.reduce((a, w) => a + w.exposure.cumulative, 0) / allWorkers.length).toFixed(1);

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">
            Daily 3-scan exposure summary — {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}.
            Export data as CSV for further analysis.
          </p>
        </div>
        <button id="export-csv-btn" className="btn btn-primary" onClick={handleCSVExport}>
          <Download size={16} />
          Export CSV
        </button>
      </div>

      {/* Summary cards */}
      <div className="reports-summary-grid">
        <div className="reports-summary-card">
          <div className="reports-summary-value" style={{ color: 'var(--color-accent)' }}>{summary.totalWorkers}</div>
          <div className="reports-summary-label">Total Workers</div>
        </div>
        <div className="reports-summary-card">
          <div className="reports-summary-value" style={{ color: 'var(--color-safe)' }}>{summary.safeWorkers}</div>
          <div className="reports-summary-label">Safe Workers</div>
        </div>
        <div className="reports-summary-card">
          <div className="reports-summary-value" style={{ color: 'var(--color-danger)' }}>{summary.dangerWorkers}</div>
          <div className="reports-summary-label">Danger Workers</div>
        </div>
        <div className="reports-summary-card">
          <div className="reports-summary-value" style={{ color: 'var(--color-info)' }}>{avgCumul} ppm</div>
          <div className="reports-summary-label">Avg Cumulative</div>
        </div>
      </div>

      {/* Scan completion summary */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <div className="card-title">Scan Completion Summary</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          {[
            { label: 'All 3 Scans Done',   count: summary.allScansCompleted, color: 'var(--color-safe)',    icon: '✓' },
            { label: 'Incomplete Scans',   count: summary.incompleteScans,   color: 'var(--color-warning)', icon: '⏳' },
            { label: 'Currently Working',  count: summary.workingWorkers,    color: 'var(--color-accent)',  icon: '⚙' },
          ].map(s => (
            <div key={s.label} style={{
              background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)', padding: '1rem', textAlign: 'center',
            }}>
              <div style={{ fontSize: '1.75rem', marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: s.color, marginBottom: 4 }}>{s.count}</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Shift summary */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <div className="card-title">Shift Summary</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          {[
            { label: 'Morning Shift',   count: morningCnt,   color: 'var(--color-warning)', time: '08:00 AM – 04:00 PM' },
            { label: 'Afternoon Shift', count: afternoonCnt, color: 'var(--color-accent)',  time: '04:00 PM – 12:00 AM' },
            { label: 'Night Shift',     count: nightCnt,     color: '#a78bfa',              time: '12:00 AM – 08:00 AM' },
          ].map(s => (
            <div key={s.label} style={{
              background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)', padding: '1rem', textAlign: 'center',
            }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: s.color, marginBottom: 4 }}>{s.count}</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)' }}>{s.label}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{s.time}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main table */}
      <div className="table-container">
        <div className="table-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={16} color="var(--color-accent)" />
            <span className="table-toolbar-title">
              Worker Exposure Report
              <span style={{ marginLeft: 8, fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                ({filtered.length} workers)
              </span>
            </span>
          </div>
          <div className="table-toolbar-actions">
            <div className="search-input-wrap">
              <Search size={16} className="search-input-icon" />
              <input
                id="reports-search-input"
                type="text"
                placeholder="Search…"
                className="search-input"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
            <select id="reports-status-filter" className="filter-select" value={statusFilter}
              onChange={e => setStatus(e.target.value as StatusFilter)}>
              <option value="ALL">All Status</option>
              <option value="SAFE">Safe</option>
              <option value="DANGER">Danger</option>
            </select>
            <select id="reports-shift-filter" className="filter-select" value={shiftFilter}
              onChange={e => setShift(e.target.value as ShiftFilter)}>
              <option value="ALL">All Shifts</option>
              <option value="Morning">Morning</option>
              <option value="Afternoon">Afternoon</option>
              <option value="Night">Night</option>
            </select>
            <select id="reports-scan-filter" className="filter-select" value={scanFilter}
              onChange={e => setScan(e.target.value as ScanFilter)}>
              <option value="ALL">All Scans</option>
              <option value="complete">All Done (3/3)</option>
              <option value="incomplete">Incomplete</option>
            </select>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table aria-label="Worker exposure report table">
            <thead>
              <tr>
                <th>Worker Name</th>
                <th>Worker ID</th>
                <th>Shift</th>
                <th style={{ color: 'var(--color-warning)' }}>Morning (ppm)</th>
                <th style={{ color: 'var(--color-accent)'  }}>Lunch (ppm)</th>
                <th style={{ color: '#a78bfa'              }}>Evening (ppm)</th>
                <th>Cumulative (ppm)</th>
                <th>Scans</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="empty-state">
                      <Search size={36} className="empty-state-icon" />
                      <p className="empty-state-text">No results match your filters.</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.map(s => (
                <tr key={s.workerId} className={s.status === 'DANGER' ? 'danger-row' : ''}>
                  <td className="td-main">{s.name}</td>
                  <td className="td-mono">{s.workerId}</td>
                  <td style={{ fontSize: '0.78rem' }}>{s.shift}</td>
                  <td>
                    {s.morningExposure !== null
                      ? <span style={{ fontWeight: 700, color: 'var(--color-warning)' }}>{s.morningExposure}</span>
                      : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>Pending</span>}
                  </td>
                  <td>
                    {s.lunchExposure !== null
                      ? <span style={{ fontWeight: 700, color: 'var(--color-accent)' }}>{s.lunchExposure}</span>
                      : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>Pending</span>}
                  </td>
                  <td>
                    {s.eveningExposure !== null
                      ? <span style={{ fontWeight: 700, color: '#a78bfa' }}>{s.eveningExposure}</span>
                      : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>Pending</span>}
                  </td>
                  <td>
                    <span className={`td-exposure td-exposure--${s.status === 'DANGER' ? 'danger' : 'safe'}`}>
                      {s.cumulativeExposure}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: s.scansCompleted === 3 ? 'var(--color-safe)' : 'var(--color-warning)' }}>
                      {s.scansCompleted}/3
                    </span>
                  </td>
                  <td><StatusBadge status={s.status} size="sm" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
