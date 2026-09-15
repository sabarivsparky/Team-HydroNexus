import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronRight, History, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { useAsync } from '../services/hooks';
import type { Reading } from '../types/api';
import { dayKey, formatTime } from '../utils/format';

export default function HistoryPage() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAsync(() => api.myReadings(100), []);

  const groups = new Map<string, Reading[]>();
  for (const r of data ?? []) {
    const key = dayKey(r.timestamp);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const open = (reading: Reading) =>
    navigate('/worker/result', { state: { reading } });

  return (
    <div className="wk-page">
      <h1 className="wk-page-title">
        <History size={20} /> Exposure history
      </h1>
      <p className="wk-page-sub">All readings recorded for your wristbands.</p>

      {loading && (
        <div className="wk-loading"><Loader2 size={22} className="wk-spin" /> Loading…</div>
      )}
      {error && (
        <div className="wk-inline-error"><AlertTriangle size={16} />{error}
          <button className="wk-link-btn" onClick={reload}>Retry</button>
        </div>
      )}

      {!loading && (data ?? []).length === 0 && (
        <div className="wk-empty">No readings yet. Scan your wristband to begin.</div>
      )}

      {[...groups.entries()].map(([day, rows]) => (
        <div key={day} className="wk-history-group">
          <div className="wk-history-date">
            {new Date(day + 'T00:00:00').toLocaleDateString('en-IN',
              { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
          {rows.map((r) => {
            const rejected = r.reading_status !== 'valid';
            const high = !rejected && (r.estimated_dose ?? 0) >= 10;
            return (
              <button key={r.id} className="wk-history-row" onClick={() => open(r)}>
                <div className={`wk-history-dose ${rejected ? 'rejected' : high ? 'danger' : 'safe'}`}>
                  {rejected ? '—' : r.estimated_dose?.toFixed(1)}
                  {!rejected && <span>ppm·hr</span>}
                </div>
                <div className="wk-history-meta">
                  <div className="wk-history-primary">
                    {r.band_qr}
                    {r.shift_label ? ` · ${r.shift_label}` : ''}
                    {r.source === 'simulated' && (
                      <span className="wk-tag-sim">SIM</span>
                    )}
                  </div>
                  <div className="wk-history-secondary">
                    {formatTime(r.timestamp)} · {r.model_version ?? 'no model'}
                    {rejected && ' · expired band rejected'}
                  </div>
                </div>
                <ChevronRight size={18} className="wk-chevron" />
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
