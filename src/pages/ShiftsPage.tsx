// ─── Shift Monitoring Page — 3-Scan Model ─────────────────
import { useState, useMemo } from 'react';
import { Clock, Search, CheckCircle2, XCircle } from 'lucide-react';
import StatusBadge from '../components/ui/StatusBadge';
import { getShiftMonitoringRows } from '../data/mockDataService';
import type { ShiftLabel } from '../data/types';
import { useNavigate } from 'react-router-dom';

type ShiftFilter = 'ALL' | ShiftLabel;

function ScanCheck({ done }: { done: boolean }) {
  return done
    ? <CheckCircle2 size={14} color="var(--color-safe)" />
    : <XCircle      size={14} color="var(--color-text-muted)" style={{ opacity: 0.5 }} />;
}

export default function ShiftsPage() {
  const navigate   = useNavigate();
  const [shift, setShift] = useState<ShiftFilter>('ALL');
  const [query, setQuery] = useState('');

  const rows = useMemo(() => getShiftMonitoringRows(shift), [shift]);

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter(
      r => r.worker.name.toLowerCase().includes(q) || r.worker.workerId.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const safeCnt      = filtered.filter(r => r.worker.status === 'SAFE').length;
  const dangerCnt    = filtered.filter(r => r.worker.status === 'DANGER').length;
  const allDoneCnt   = filtered.filter(r => r.scansCompleted === 3).length;
  const incompleteCnt = filtered.filter(r => r.scansCompleted < 3).length;

  const shiftColor = (s: string) =>
    s === 'Morning' ? 'var(--color-warning)' :
    s === 'Afternoon' ? 'var(--color-accent)' : '#a78bfa';

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Shift Monitoring</h1>
        <p className="page-subtitle">
          Track workers by shift — on-duty status, 3-scan completion, and current exposure.
        </p>
      </div>

      {/* Shift tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {(['ALL', 'Morning', 'Afternoon', 'Night'] as const).map(s => (
          <button
            key={s}
            id={`shift-filter-${s.toLowerCase()}`}
            className={`btn btn-${shift === s ? 'primary' : 'secondary'}`}
            style={{ padding: '0.4rem 1.25rem', fontSize: '0.85rem' }}
            onClick={() => setShift(s)}
          >
            <Clock size={14} style={{ marginRight: 4 }} />
            {s === 'ALL' ? 'All Shifts' : `${s} Shift`}
          </button>
        ))}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '1.25rem', fontSize: '0.8rem' }}>
          <span style={{ color: 'var(--color-safe)'    }}>✓ Safe: {safeCnt}</span>
          <span style={{ color: 'var(--color-danger)'  }}>⚠ Danger: {dangerCnt}</span>
          <span style={{ color: 'var(--color-accent)'  }}>✓ All Scans: {allDoneCnt}</span>
          <span style={{ color: 'var(--color-warning)' }}>⏳ Incomplete: {incompleteCnt}</span>
        </div>
      </div>

      <div className="table-container">
        <div className="table-toolbar">
          <span className="table-toolbar-title">
            {shift === 'ALL' ? 'All Shifts' : `${shift} Shift`}
            <span style={{ marginLeft: 8, fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
              ({filtered.length} workers)
            </span>
          </span>
          <div className="table-toolbar-actions">
            <div className="search-input-wrap">
              <Search size={16} className="search-input-icon" />
              <input
                id="shift-search-input"
                type="text"
                placeholder="Search name or ID…"
                className="search-input"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table aria-label="Shift monitoring table">
            <thead>
              <tr>
                <th>Worker</th>
                <th>ID</th>
                <th>Shift</th>
                <th>Start</th>
                <th>End</th>
                <th>Duration</th>
                <th style={{ color: 'var(--color-warning)' }}>☀ Morning</th>
                <th style={{ color: 'var(--color-accent)'  }}>🍽 Lunch</th>
                <th style={{ color: '#a78bfa'              }}>🌆 Evening</th>
                <th>Scans</th>
                <th>Cumulative</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={12}>
                    <div className="empty-state">
                      <Search size={36} className="empty-state-icon" />
                      <p className="empty-state-text">No workers found.</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.map(({ worker: w, workingDuration, scansCompleted: done }) => (
                <tr
                  key={w.workerId}
                  className={w.status === 'DANGER' ? 'danger-row' : ''}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/workers/${w.workerId}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && navigate(`/workers/${w.workerId}`)}
                >
                  <td className="td-main">{w.name}</td>
                  <td className="td-mono">{w.workerId}</td>
                  <td>
                    <span style={{
                      padding: '2px 10px', borderRadius: 20, fontSize: '0.73rem', fontWeight: 600,
                      background: `${shiftColor(w.shift.label)}22`,
                      color: shiftColor(w.shift.label),
                    }}>
                      {w.shift.label}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{w.shift.start}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{w.shift.end}</td>
                  <td><span style={{ fontWeight: 600, color: 'var(--color-warning)' }}>{workingDuration}</span></td>

                  {/* Scan values with icons */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <ScanCheck done={w.scanStatus.morning} />
                      <span style={{ fontWeight: 700, color: w.scanStatus.morning ? 'var(--color-warning)' : 'var(--color-text-muted)', fontSize: '0.82rem' }}>
                        {w.scanStatus.morning ? `${w.exposure.morning} ppm` : '—'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <ScanCheck done={w.scanStatus.lunch} />
                      <span style={{ fontWeight: 700, color: w.scanStatus.lunch ? 'var(--color-accent)' : 'var(--color-text-muted)', fontSize: '0.82rem' }}>
                        {w.scanStatus.lunch ? `${w.exposure.lunch} ppm` : '—'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <ScanCheck done={w.scanStatus.evening} />
                      <span style={{ fontWeight: 700, color: w.scanStatus.evening ? '#a78bfa' : 'var(--color-text-muted)', fontSize: '0.82rem' }}>
                        {w.scanStatus.evening ? `${w.exposure.evening} ppm` : '—'}
                      </span>
                    </div>
                  </td>

                  <td>
                    <span style={{
                      fontSize: '0.78rem', fontWeight: 700,
                      color: done === 3 ? 'var(--color-safe)' : 'var(--color-warning)',
                    }}>
                      {done}/3
                    </span>
                  </td>
                  <td>
                    <span className={`td-exposure td-exposure--${w.status === 'DANGER' ? 'danger' : 'safe'}`}>
                      {w.exposure.cumulative}
                    </span>
                  </td>
                  <td><StatusBadge status={w.status} size="sm" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
