// ─── Danger Workers Page — 3-Scan Model ───────────────────
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { TriangleAlert, Search, Eye } from 'lucide-react';
import StatusBadge from '../components/ui/StatusBadge';
import { getAllWorkers } from '../data/mockDataService';

export default function DangerPage() {
  const navigate   = useNavigate();
  const [query, setQuery] = useState('');

  const dangerWorkers = useMemo(() => {
    const all = getAllWorkers().filter(w => w.status === 'DANGER');
    if (!query.trim()) return all;
    const q = query.toLowerCase();
    return all.filter(
      w => w.name.toLowerCase().includes(q) || w.workerId.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title" style={{ color: 'var(--color-danger)' }}>
          <TriangleAlert size={28} style={{ display: 'inline', marginRight: 10, verticalAlign: 'middle' }} />
          Danger Workers
        </h1>
        <p className="page-subtitle">
          Workers whose cumulative daily exposure (Morning + Lunch + Evening) exceeds 10 ppm.
        </p>
      </div>

      {/* Alert banner */}
      <div style={{
        background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)',
        borderRadius: 'var(--radius-lg)', padding: '1rem 1.5rem', marginBottom: '1.5rem',
        display: 'flex', alignItems: 'center', gap: '1rem',
      }}>
        <TriangleAlert size={22} color="var(--color-danger)" />
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-danger)' }}>
            {dangerWorkers.length > 0
              ? `⚠ ${dangerWorkers.length} worker${dangerWorkers.length > 1 ? 's' : ''} exceeded the 10 ppm cumulative threshold!`
              : '✓ No workers currently in the danger zone.'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
            Cumulative H₂S threshold: <strong>10 ppm</strong> (Morning + Lunch + Evening combined).
            Immediate review required.
          </div>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '1.25rem', display: 'flex', gap: 12, alignItems: 'center' }}>
        <div className="search-input-wrap">
          <Search size={16} className="search-input-icon" />
          <input
            id="danger-search-input"
            type="text"
            placeholder="Search by name or ID…"
            className="search-input"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
          {dangerWorkers.length} worker{dangerWorkers.length !== 1 ? 's' : ''} in danger
        </span>
      </div>

      {/* Danger cards */}
      {dangerWorkers.length === 0 ? (
        <div className="empty-state">
          <TriangleAlert size={48} className="empty-state-icon" />
          <p className="empty-state-text">
            {query ? 'No matching danger workers.' : 'No workers in danger zone. All clear!'}
          </p>
        </div>
      ) : (
        <div className="danger-grid">
          {dangerWorkers.map(w => {
            const scans = [w.scanStatus.morning, w.scanStatus.lunch, w.scanStatus.evening].filter(Boolean).length;
            return (
              <div
                key={w.workerId}
                className="danger-card"
                onClick={() => navigate(`/workers/${w.workerId}`)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && navigate(`/workers/${w.workerId}`)}
                id={`danger-card-${w.workerId}`}
                style={{ cursor: 'pointer' }}
              >
                <div className="danger-card-header">
                  <div>
                    <div className="danger-card-name">{w.name}</div>
                    <div className="danger-card-id">{w.workerId} · {w.shift.label}</div>
                  </div>
                  <StatusBadge status="DANGER" />
                </div>

                {/* 3-scan breakdown */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                  gap: '0.5rem', marginBottom: '0.75rem',
                }}>
                  {[
                    { label: '☀ Morning', value: w.exposure.morning, done: w.scanStatus.morning, color: 'var(--color-warning)' },
                    { label: '🍽 Lunch',  value: w.exposure.lunch,   done: w.scanStatus.lunch,   color: 'var(--color-accent)' },
                    { label: '🌆 Evening',value: w.exposure.evening, done: w.scanStatus.evening, color: '#a78bfa' },
                  ].map(s => (
                    <div key={s.label} style={{
                      background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)',
                      padding: '0.6rem 0.5rem', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '0.65rem', color: s.color, fontWeight: 700, marginBottom: 2 }}>{s.label}</div>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem', color: s.done ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                        {s.done ? `${s.value} ppm` : '—'}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="danger-card-stats">
                  <div className="danger-stat">
                    <div className="danger-stat-label">Cumulative</div>
                    <div className="danger-stat-value">
                      {w.exposure.cumulative} <span style={{ fontSize: '0.7rem' }}>ppm</span>
                    </div>
                  </div>
                  <div className="danger-stat">
                    <div className="danger-stat-label">Scans Done</div>
                    <div className="danger-stat-value" style={{ color: scans === 3 ? 'var(--color-safe)' : 'var(--color-warning)' }}>
                      {scans}<span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>/3</span>
                    </div>
                  </div>
                </div>

                <div className="danger-card-meta">
                  <span>{w.shift.start} – {w.shift.end}</span>
                  <span>Last: {w.lastScan}</span>
                </div>

                <button
                  className="btn btn-danger"
                  style={{ width: '100%', marginTop: '0.75rem', justifyContent: 'center' }}
                  onClick={e => { e.stopPropagation(); navigate(`/workers/${w.workerId}`); }}
                >
                  <Eye size={14} />
                  View Details
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Table view */}
      {dangerWorkers.length > 0 && (
        <div className="table-container" style={{ marginTop: '2rem' }}>
          <div className="table-toolbar">
            <span className="table-toolbar-title">Danger Workers — Table View</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table aria-label="Danger workers table">
              <thead>
                <tr>
                  <th>Worker Name</th>
                  <th>Worker ID</th>
                  <th>Shift</th>
                  <th style={{ color: 'var(--color-warning)' }}>Morning</th>
                  <th style={{ color: 'var(--color-accent)'  }}>Lunch</th>
                  <th style={{ color: '#a78bfa'              }}>Evening</th>
                  <th>Cumulative</th>
                  <th>Scans</th>
                  <th>Last Scan</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {dangerWorkers.map(w => {
                  const done = [w.scanStatus.morning, w.scanStatus.lunch, w.scanStatus.evening].filter(Boolean).length;
                  return (
                    <tr key={w.workerId} className="danger-row">
                      <td className="td-main">{w.name}</td>
                      <td className="td-mono">{w.workerId}</td>
                      <td style={{ fontSize: '0.8rem' }}>{w.shift.label} ({w.shift.start} – {w.shift.end})</td>
                      <td>
                        {w.scanStatus.morning
                          ? <span style={{ color: 'var(--color-warning)', fontWeight: 700 }}>{w.exposure.morning} ppm</span>
                          : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>—</span>}
                      </td>
                      <td>
                        {w.scanStatus.lunch
                          ? <span style={{ color: 'var(--color-accent)', fontWeight: 700 }}>{w.exposure.lunch} ppm</span>
                          : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>—</span>}
                      </td>
                      <td>
                        {w.scanStatus.evening
                          ? <span style={{ color: '#a78bfa', fontWeight: 700 }}>{w.exposure.evening} ppm</span>
                          : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>—</span>}
                      </td>
                      <td><span className="td-exposure td-exposure--danger">{w.exposure.cumulative}</span></td>
                      <td><span style={{ fontWeight: 700, color: done === 3 ? 'var(--color-safe)' : 'var(--color-warning)', fontSize: '0.8rem' }}>{done}/3</span></td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{w.lastScan}</td>
                      <td>
                        <button className="btn btn-ghost" onClick={() => navigate(`/workers/${w.workerId}`)}>
                          <Eye size={14} /> View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
