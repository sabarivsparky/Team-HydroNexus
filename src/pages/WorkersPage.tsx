// Workers — registry with live daily cumulative dose from wristband readings
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { QrCode, Search, Users } from 'lucide-react';
import StatusBadge from '../components/ui/StatusBadge';
import { EmptyState, ErrorPanel, Loading } from '../components/ui/States';
import { api } from '../services/api';
import { useAsync } from '../services/hooks';
import type { WorkerSummary } from '../types/api';
import { formatDateTime, formatNumber } from '../utils/format';

type Filter = 'ALL' | 'SAFE' | 'DANGER';

export default function WorkersPage() {
  const { data, loading, error, reload } = useAsync<WorkerSummary[]>(() => api.listWorkers(), []);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');

  const rows = (data ?? []).filter((w) => {
    if (filter !== 'ALL' && w.status !== filter) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      w.name.toLowerCase().includes(q) ||
      w.employee_id.toLowerCase().includes(q) ||
      (w.department ?? '').toLowerCase().includes(q) ||
      (w.band_qr ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Workers</h1>
          <p className="page-subtitle">Field staff and their assigned H₂S wristbands.</p>
        </div>
      </div>

      <div className="card">
        <div className="table-toolbar">
          <div className="table-toolbar-title">
            <Users size={18} /> {rows.length} workers
          </div>
          <div className="table-toolbar-actions" style={{ display: 'flex', gap: 10 }}>
            <div className="search-input-wrap">
              <Search size={16} className="search-input-icon" />
              <input
                className="search-input"
                placeholder="Search name, ID, dept or band…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <select className="filter-select" value={filter}
              onChange={(e) => setFilter(e.target.value as Filter)}>
              <option value="ALL">All statuses</option>
              <option value="SAFE">Safe</option>
              <option value="DANGER">Danger</option>
            </select>
          </div>
        </div>

        <div className="table-container">
          {loading ? <Loading label="Loading workers…" />
            : error ? <ErrorPanel message={error} onRetry={reload} />
            : rows.length === 0 ? <EmptyState label="No workers match." />
            : (
              <table>
                <thead>
                  <tr>
                    <th>Employee</th><th>Name</th><th>Department</th>
                    <th>Wristband</th><th>Readings today</th>
                    <th>Cumulative today (ppm·hr)</th><th>Latest reading</th>
                    <th>Status</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((w) => (
                    <tr key={w.id}>
                      <td className="td-mono">{w.employee_id}</td>
                      <td className="td-main">{w.name}</td>
                      <td>{w.department ?? '—'}</td>
                      <td>
                        {w.band_qr ? (
                          <span className="band-pill">
                            <QrCode size={13} /> {w.band_qr}
                          </span>
                        ) : <span style={{ color: 'var(--color-text-muted)' }}>unassigned</span>}
                      </td>
                      <td>{w.today_readings}</td>
                      <td className={`td-exposure ${
                        w.today_cumulative_dose >= w.action_level
                          ? 'td-exposure--danger' : 'td-exposure--safe'
                      }`}>
                        {formatNumber(w.today_cumulative_dose)}
                      </td>
                      <td>
                        {w.latest_dose != null
                          ? `${formatNumber(w.latest_dose)} · ${formatDateTime(w.latest_timestamp)}`
                          : '—'}
                      </td>
                      <td>
                        <StatusBadge tone={w.status === 'DANGER' ? 'danger' : 'safe'} small>
                          {w.status}
                        </StatusBadge>
                      </td>
                      <td>
                        <Link to={`/workers/${w.id}`} className="table-link">Details →</Link>
                      </td>
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
