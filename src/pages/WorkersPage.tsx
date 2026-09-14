// ─── Workers Page — 3-scan table ──────────────────────────
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Eye, ChevronLeft, ChevronRight, Users, CheckCircle2, Clock } from 'lucide-react';
import StatusBadge from '../components/ui/StatusBadge';
import { filterWorkers } from '../data/mockDataService';
import type { ShiftLabel } from '../data/types';

const PAGE_SIZE = 15;

type StatusFilter = 'ALL' | 'SAFE' | 'DANGER';
type ShiftFilter  = 'ALL' | ShiftLabel;
type ScanFilter   = 'ALL' | 'complete' | 'incomplete';

function ScanDot({ done }: { done: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontSize: '0.72rem', fontWeight: 600,
      color: done ? 'var(--color-safe)' : 'var(--color-text-muted)',
    }}>
      {done
        ? <CheckCircle2 size={12} />
        : <Clock size={12} />
      }
      {done ? 'Done' : 'Pending'}
    </span>
  );
}

export default function WorkersPage() {
  const navigate = useNavigate();
  const [query, setQuery]       = useState('');
  const [status, setStatus]     = useState<StatusFilter>('ALL');
  const [shift, setShift]       = useState<ShiftFilter>('ALL');
  const [scanFilter, setScan]   = useState<ScanFilter>('ALL');
  const [page, setPage]         = useState(1);

  const base = useMemo(() => filterWorkers(query, status, shift), [query, status, shift]);

  const filtered = useMemo(() => {
    if (scanFilter === 'ALL') return base;
    return base.filter(w => {
      const allDone = w.scanStatus.morning && w.scanStatus.lunch && w.scanStatus.evening;
      return scanFilter === 'complete' ? allDone : !allDone;
    });
  }, [base, scanFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSearchChange = (v: string) => { setQuery(v); setPage(1); };
  const handleStatusChange = (v: StatusFilter) => { setStatus(v); setPage(1); };
  const handleShiftChange  = (v: ShiftFilter)  => { setShift(v);  setPage(1); };
  const handleScanChange   = (v: ScanFilter)   => { setScan(v);   setPage(1); };

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Worker Monitoring</h1>
        <p className="page-subtitle">
          All workers with today's 3-scan exposure data — Morning · Lunch · Evening.
        </p>
      </div>

      <div className="table-container">
        {/* Toolbar */}
        <div className="table-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={18} color="var(--color-accent)" />
            <span className="table-toolbar-title">
              All Workers
              <span style={{ marginLeft: 8, fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                ({filtered.length} results)
              </span>
            </span>
          </div>

          <div className="table-toolbar-actions">
            <div className="search-input-wrap">
              <Search size={16} className="search-input-icon" />
              <input
                id="workers-search-input"
                type="text"
                placeholder="Search name or ID…"
                className="search-input"
                value={query}
                onChange={e => handleSearchChange(e.target.value)}
                aria-label="Search workers"
              />
            </div>

            <select id="workers-status-filter" className="filter-select" value={status}
              onChange={e => handleStatusChange(e.target.value as StatusFilter)}
              aria-label="Filter by status">
              <option value="ALL">All Status</option>
              <option value="SAFE">Safe</option>
              <option value="DANGER">Danger</option>
            </select>

            <select id="workers-shift-filter" className="filter-select" value={shift}
              onChange={e => handleShiftChange(e.target.value as ShiftFilter)}
              aria-label="Filter by shift">
              <option value="ALL">All Shifts</option>
              <option value="Morning">Morning</option>
              <option value="Afternoon">Afternoon</option>
              <option value="Night">Night</option>
            </select>

            <select id="workers-scan-filter" className="filter-select" value={scanFilter}
              onChange={e => handleScanChange(e.target.value as ScanFilter)}
              aria-label="Filter by scan completion">
              <option value="ALL">All Scans</option>
              <option value="complete">All Scans Done</option>
              <option value="incomplete">Incomplete</option>
            </select>
          </div>
        </div>

        {/* Table */}
        {pageData.length === 0 ? (
          <div className="empty-state">
            <Search size={40} className="empty-state-icon" />
            <p className="empty-state-text">No workers found matching your filters.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table aria-label="Workers table">
              <thead>
                <tr>
                  <th>Worker Name</th>
                  <th>Worker ID</th>
                  <th>Mobile</th>
                  <th>Shift</th>
                  <th>Morning (ppm)</th>
                  <th>Lunch (ppm)</th>
                  <th>Evening (ppm)</th>
                  <th>Cumulative (ppm)</th>
                  <th>Status</th>
                  <th>Last Scan</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {pageData.map(w => (
                  <tr key={w.workerId} className={w.status === 'DANGER' ? 'danger-row' : ''}>
                    <td className="td-main">{w.name}</td>
                    <td className="td-mono">{w.workerId}</td>
                    <td style={{ fontSize: '0.8rem' }}>{w.mobile}</td>
                    <td>
                      <div style={{ fontSize: '0.78rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{w.shift.label}</div>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem' }}>
                          {w.shift.start} – {w.shift.end}
                        </div>
                      </div>
                    </td>

                    {/* Morning */}
                    <td>
                      {w.scanStatus.morning
                        ? <span style={{ fontWeight: 700, color: 'var(--color-warning)' }}>{w.exposure.morning}</span>
                        : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>Pending</span>}
                    </td>

                    {/* Lunch */}
                    <td>
                      {w.scanStatus.lunch
                        ? <span style={{ fontWeight: 700, color: 'var(--color-accent)' }}>{w.exposure.lunch}</span>
                        : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>Pending</span>}
                    </td>

                    {/* Evening */}
                    <td>
                      {w.scanStatus.evening
                        ? <span style={{ fontWeight: 700, color: '#a78bfa' }}>{w.exposure.evening}</span>
                        : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>Pending</span>}
                    </td>

                    {/* Cumulative */}
                    <td>
                      <span className={`td-exposure td-exposure--${w.status === 'DANGER' ? 'danger' : 'safe'}`}>
                        {w.exposure.cumulative}
                      </span>
                    </td>

                    <td><StatusBadge status={w.status} /></td>

                    <td style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                      {w.lastScan}
                    </td>

                    <td>
                      <button
                        id={`view-worker-${w.workerId}`}
                        className="btn btn-ghost"
                        onClick={() => navigate(`/workers/${w.workerId}`)}
                        aria-label={`View details for ${w.name}`}
                      >
                        <Eye size={14} />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="pagination">
          <div className="pagination-info">
            Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} workers
          </div>
          <div className="pagination-controls">
            <button className="pagination-btn" onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1} aria-label="Previous page">
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .map((p, idx, arr) => (
                <>
                  {idx > 0 && arr[idx - 1] !== p - 1 && (
                    <button key={`e-${p}`} className="pagination-btn" disabled style={{ cursor: 'default' }}>…</button>
                  )}
                  <button
                    key={p}
                    className={`pagination-btn${p === page ? ' active' : ''}`}
                    onClick={() => setPage(p)}
                    aria-label={`Page ${p}`}
                    aria-current={p === page ? 'page' : undefined}
                  >
                    {p}
                  </button>
                </>
              ))}
            <button className="pagination-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages} aria-label="Next page">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
