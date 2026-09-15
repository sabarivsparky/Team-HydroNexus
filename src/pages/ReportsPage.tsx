// Reports — exposure summary by worker with CSV export
// (Structured similarly to a daily HSE exposure register; this is NOT an
//  official DGMS/OISD certification.)
import { useMemo, useState } from 'react';
import Papa from 'papaparse';
import { Download, FileText, FlaskConical } from 'lucide-react';
import StatusBadge from '../components/ui/StatusBadge';
import { EmptyState, ErrorPanel, Loading } from '../components/ui/States';
import { api } from '../services/api';
import { useAsync } from '../services/hooks';
import type { ReportRow } from '../types/api';
import { formatNumber } from '../utils/format';

const RANGES = [
  { label: 'Today', days: 1 },
  { label: '7 days', days: 7 },
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
];

export default function ReportsPage() {
  const [days, setDays] = useState(7);
  const { data, loading, error, reload } = useAsync<ReportRow[]>(
    () => api.reports(days), [days]);

  const totals = useMemo(() => {
    const rows = data ?? [];
    const readings = rows.reduce((a, r) => a + r.readings, 0);
    const dose = rows.reduce((a, r) => a + r.cumulative_dose, 0);
    const high = rows.filter((r) => r.latest_status === 'HIGH').length;
    return { readings, dose, high, workers: rows.filter((r) => r.readings > 0).length };
  }, [data]);

  const exportCsv = () => {
    const csv = Papa.unparse((data ?? []).map((r) => ({
      employee_id: r.employee_id,
      name: r.name,
      department: r.department ?? '',
      wristband: r.band_qr ?? '',
      shift: r.shift_label ?? '',
      readings: r.readings,
      cumulative_dose_ppm_hr: r.cumulative_dose,
      average_dose_ppm_hr: r.average_dose,
      max_dose_ppm_hr: r.max_dose,
      flag: r.latest_status === 'HIGH' ? 'HIGH EXPOSURE' : 'OK',
    })));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `h2s_exposure_report_${days}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">
            Cumulative exposure register grouped by worker and wristband.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {RANGES.map((r) => (
            <button key={r.days}
              className={`wk-shift-chip ${days === r.days ? 'active' : ''}`}
              style={{ borderRadius: 6 }}
              onClick={() => setDays(r.days)}>{r.label}</button>
          ))}
          <button className="btn btn-secondary" onClick={exportCsv}
            disabled={loading || !(data?.length)}>
            <Download size={16} /> CSV
          </button>
        </div>
      </div>

      <div className="sim-banner" style={{ background: 'var(--color-info-bg)',
        border: '1px solid var(--color-info-border)', color: '#075985' }}>
        <FileText size={16} />
        <span>
          Register format inspired by daily HSE / DGMS-style exposure records.
          This report is <strong>not an official regulatory certification</strong>,
          and all doses are model <strong>estimates</strong>.
        </span>
      </div>

      <div className="reports-summary-grid">
        <div className="reports-summary-card">
          <div className="reports-summary-value">{totals.workers}</div>
          <div className="reports-summary-label">active workers</div>
        </div>
        <div className="reports-summary-card">
          <div className="reports-summary-value">{totals.readings}</div>
          <div className="reports-summary-label">valid readings</div>
        </div>
        <div className="reports-summary-card">
          <div className="reports-summary-value">{formatNumber(totals.dose)}</div>
          <div className="reports-summary-label">total ppm·hr</div>
        </div>
        <div className="reports-summary-card" style={{
          borderColor: totals.high ? 'var(--color-danger-border)' : undefined }}>
          <div className="reports-summary-value"
            style={{ color: totals.high ? 'var(--color-danger)' : undefined }}>
            {totals.high}
          </div>
          <div className="reports-summary-label">flagged workers</div>
        </div>
      </div>

      <div className="card">
        <div className="table-toolbar">
          <div className="table-toolbar-title">
            <FlaskConical size={17} /> Worker exposure register
          </div>
        </div>
        <div className="table-container">
          {loading ? <Loading label="Building report…" />
            : error ? <ErrorPanel message={error} onRetry={reload} />
            : (data ?? []).length === 0 ? <EmptyState />
            : (
              <table>
                <thead>
                  <tr>
                    <th>Employee</th><th>Name</th><th>Department</th><th>Wristband</th>
                    <th>Shift</th><th>Readings</th><th>Cumulative (ppm·hr)</th>
                    <th>Average</th><th>Maximum</th><th>Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {(data ?? []).slice()
                    .sort((a, b) => b.cumulative_dose - a.cumulative_dose)
                    .map((r) => (
                      <tr key={r.worker_id}>
                        <td className="td-mono">{r.employee_id}</td>
                        <td className="td-main">{r.name}</td>
                        <td>{r.department ?? '—'}</td>
                        <td className="td-mono">{r.band_qr ?? '—'}</td>
                        <td>{r.shift_label ?? '—'}</td>
                        <td>{r.readings}</td>
                        <td className={`td-exposure ${
                          r.latest_status === 'HIGH'
                            ? 'td-exposure--danger' : 'td-exposure--safe'
                        }`}>{formatNumber(r.cumulative_dose)}</td>
                        <td>{formatNumber(r.average_dose)}</td>
                        <td className={r.max_dose >= 10 ? 'text-danger' : ''}>
                          {formatNumber(r.max_dose)}
                        </td>
                        <td>
                          {r.readings === 0 ? <span>—</span>
                            : r.latest_status === 'HIGH'
                              ? <StatusBadge tone="danger" small>HIGH</StatusBadge>
                              : <StatusBadge tone="safe" small>OK</StatusBadge>}
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
