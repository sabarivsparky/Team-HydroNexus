import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, BadgeCheck, Clock3, Cpu, FlaskConical,
  Info, QrCode, ShieldCheck, XCircle,
} from 'lucide-react';
import type { PredictionResponse, Reading, Wristband } from '../types/api';
import { formatDateTime } from '../utils/format';

interface State {
  response?: PredictionResponse;
  reading?: Reading;
  band?: Wristband;
}

function rgb(c: number[]): string {
  return `rgb(${c.map((v) => Math.round(v)).join(',')})`;
}

export default function ResultPage() {
  const navigate = useNavigate();
  const { response, reading: compactReading, band } = (useLocation().state ?? {}) as State;

  const reading = response?.reading ?? compactReading;
  if (!reading) {
    return (
      <div className="wk-page">
        <div className="wk-muted">No reading to display.</div>
        <Link to="/worker/scan" className="btn btn-primary" style={{ marginTop: 16 }}>
          Start a new scan
        </Link>
      </div>
    );
  }

  const d = response?.diagnostics;
  const expired = reading.reading_status === 'rejected_expired';
  const high = reading.high_exposure ??
    (reading.estimated_dose !== null && reading.estimated_dose >= 10);
  const sim = reading.source === 'simulated';

  return (
    <div className="wk-page">
      {/* ── Hero result ── */}
      <div className={`wk-result-hero ${expired ? 'expired' : high ? 'danger' : 'safe'}`}>
        <div className="wk-result-status">
          {expired
            ? <><XCircle size={22} /> EXPIRED WRISTBAND</>
            : high
              ? <><AlertTriangle size={22} /> HIGH EXPOSURE</>
              : <><ShieldCheck size={22} /> VALID · WITHIN RANGE</>}
        </div>
        {expired ? (
          <div className="wk-result-no-dose">Reading rejected</div>
        ) : (
          <>
            <div className="wk-result-dose">
              {reading.estimated_dose?.toFixed(2)}
              <span> ppm·hr</span>
            </div>
            <div className="wk-result-caption">Estimated cumulative H₂S exposure</div>
          </>
        )}
        <div className="wk-result-check">
          {expired
            ? <BadgeCheck size={15} />
            : reading.expiry_status === 'VALID'
              ? <BadgeCheck size={15} /> : <XCircle size={15} />}
          Expiry patch: {reading.expiry_status}
        </div>
      </div>

      <div className="wk-result-msg">
        {expired
          ? 'This wristband has expired and cannot produce a valid reading. Discard it and use a new wristband.'
          : response?.message ?? 'Estimated cumulative H₂S exposure calculated.'}
      </div>

      {/* ── CV-annotated image ── */}
      {reading.image_rectified && (
        <div className="wk-card wk-image-card">
          <img src={reading.image_rectified}
            alt="Rectified wristband with detected regions"
            className="wk-rect-image" />
          <div className="wk-image-caption">
            Detected strip, reference scale, expiry patch and QR (rectified view)
          </div>
        </div>
      )}

      {/* ── Metadata ── */}
      <div className="wk-card">
        <div className="wk-band-detail-row">
          <QrCode size={16} /><span>Band</span><strong>{reading.band_qr}</strong>
        </div>
        <div className="wk-band-detail-row">
          <Clock3 size={16} />
          <span>Time</span><strong>{formatDateTime(reading.timestamp)}</strong>
        </div>
        <div className="wk-band-detail-row">
          <Cpu size={16} />
          <span>Model</span><strong>{reading.model_version ?? '—'}</strong>
        </div>
        <div className="wk-band-detail-row">
          {sim ? <FlaskConical size={16} /> : <Info size={16} />}
          <span>Source</span>
          <strong className="text-capitalize">{reading.source}</strong>
        </div>
        {band && (
          <div className="wk-band-detail-row">
            <span className="wk-gap" /><span>Use by</span>
            <strong>{new Date(band.expiry_date).toLocaleDateString('en-IN')}</strong>
          </div>
        )}
      </div>

      {/* ── CV/ML diagnostics ── */}
      {d && (
        <div className="wk-card">
          <div className="wk-card-head"><Cpu size={16} /><span>CV / ML diagnostics</span></div>
          <div className="wk-diag-grid">
            <div><span>L*</span><strong>{d.strip_lab[0]?.toFixed(1)}</strong></div>
            <div><span>a*</span><strong>{d.strip_lab[1]?.toFixed(1)}</strong></div>
            <div><span>b*</span><strong>{d.strip_lab[2]?.toFixed(1)}</strong></div>
            <div><span>ΔE strip</span><strong>{d.delta_e.toFixed(1)}</strong></div>
            <div><span>ΔE env cell</span><strong>{d.delta_e_env.toFixed(1)}</strong></div>
            <div><span>Correction RMSE</span><strong>{d.correction_residual.toFixed(1)}</strong></div>
            <div><span>Brightness</span><strong>{d.brightness.toFixed(0)}</strong></div>
            <div><span>Focus score</span><strong>{d.blur_score.toFixed(0)}</strong></div>
          </div>
          <div className="wk-swatch-row">
            <div>
              <div className="wk-swatch-label">Measured reference</div>
              <div className="wk-swatches">
                {d.reference_measured.map((c, i) => (
                  <span key={i} className="wk-swatch" style={{ background: rgb(c) }} />
                ))}
              </div>
            </div>
            <div>
              <div className="wk-swatch-label">Printed reference</div>
              <div className="wk-swatches">
                {d.reference_expected.map((c, i) => (
                  <span key={i} className="wk-swatch" style={{ background: rgb(c) }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="wk-estimate-note">
        <Info size={14} />
        Dose is an estimate derived from the colorimetric response and a model
        trained on simulated calibration data. It is not an exact or certified
        measurement.
      </p>

      <div className="wk-actions-row">
        <Link to="/worker/history" className="btn btn-ghost">
          <Clock3 size={16} /> History
        </Link>
        <button className="btn btn-primary" onClick={() => navigate('/worker/scan')}>
          New reading <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
