import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Aperture, Camera as CameraIcon, FlaskConical,
  Loader2, RefreshCw, Sparkles,
} from 'lucide-react';
import { api, ClientError } from '../services/api';
import type { PredictionResponse, ShiftLabel, Wristband } from '../types/api';
import { captureFrame, useCamera } from './useCamera';
import { currentShift } from '../utils/format';

type Phase = 'live' | 'review' | 'analyzing' | 'error';

interface LocationState {
  band: Wristband;
}

export default function CapturePage() {
  const navigate = useNavigate();
  const state = useLocation().state as LocationState | null;
  const band = state?.band;
  const { videoRef, ready, error, start } = useCamera('environment');

  const [phase, setPhase] = useState<Phase>('live');
  const [submitting, setSubmitting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [shift, setShift] = useState<ShiftLabel>(currentShift());

  // Demo-simulator controls
  const [simDose, setSimDose] = useState<number>(30);
  const [simTemp, setSimTemp] = useState(27);
  const [simRh, setSimRh] = useState(60);
  const [simBusy, setSimBusy] = useState(false);

  useEffect(() => { void start(); }, [start]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  if (!band) return <Navigate to="/worker/scan" replace />;

  const onCapture = async () => {
    const b = await captureFrame(videoRef.current);
    if (!b) {
      setErrorMsg('Could not capture a frame. Wait for the camera and retry.');
      setPhase('error');
      return;
    }
    setBlob(b);
    setPreviewUrl(URL.createObjectURL(b));
    setPhase('review');
  };

  const analyzePhoto = async () => {
    if (!blob) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      const response = await api.predictPhoto(blob, band.qr_id, shift);
      goResult(response);
    } catch (err) {
      setErrorMsg(err instanceof ClientError ? err.message : 'Analysis failed.');
      setPhase('error');
    } finally {
      setSubmitting(false);
    }
  };

  const runSimulator = async () => {
    setSimBusy(true);
    setErrorMsg('');
    try {
      const response = await api.simulateCapture({
        band_qr_id: band.qr_id,
        dose_ppm_hr: simDose,
        temp_c: simTemp,
        rh_pct: simRh,
        shift_label: shift,
      });
      goResult(response);
    } catch (err) {
      setErrorMsg(err instanceof ClientError ? err.message : 'Simulation failed.');
      setSimBusy(false);
    }
  };

  const goResult = (response: PredictionResponse) => {
    navigate('/worker/result', { state: { response, band } });
  };

  const retake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setBlob(null);
    setPhase('live');
  };

  return (
    <div className="wk-page">
      <h1 className="wk-page-title">Capture wristband</h1>
      <p className="wk-page-sub">
        Band <strong>{band.qr_id}</strong> · fit the full card inside the guide
      </p>

      <div className="wk-shift-select">
        {(['Morning', 'Afternoon', 'Night'] as ShiftLabel[]).map((label) => (
          <button key={label}
            className={`wk-shift-chip ${shift === label ? 'active' : ''}`}
            onClick={() => setShift(label)}>{label}</button>
        ))}
      </div>

      <div className="wk-video-wrap wk-capture">
        {phase === 'review' && previewUrl ? (
          <img src={previewUrl} alt="Captured wristband" className="wk-video" />
        ) : error ? (
          <div className="wk-camera-error">
            <CameraIcon size={30} /><p>{error}</p>
          </div>
        ) : (
          <video ref={videoRef} playsInline muted className="wk-video" />
        )}

        {phase !== 'review' && (
          <div className="wk-band-guide">
            <span className="wk-guide-corner tl" /><span className="wk-guide-corner tr" />
            <span className="wk-guide-corner bl" /><span className="wk-guide-corner br" />
            <div className="wk-guide-labels">
              <span>REACTIVE STRIP</span><span>REFERENCE SCALE</span>
              <span>EXPIRY · QR</span>
            </div>
          </div>
        )}

        {phase === 'analyzing' || submitting ? (
          <div className="wk-overlay-toast">
            <Loader2 size={22} className="wk-spin" />
            Running CV + ML analysis…
          </div>
        ) : null}
      </div>

      {phase === 'live' && (
        <button className="wk-shutter" onClick={onCapture} disabled={!ready}
          aria-label="Capture photo">
          <Aperture size={34} />
        </button>
      )}

      {phase === 'review' && (
        <div className="wk-actions-row">
          <button className="btn btn-ghost" onClick={retake} disabled={submitting}>
            <RefreshCw size={16} /> Retake
          </button>
          <button className="btn btn-primary" onClick={analyzePhoto} disabled={submitting}>
            {submitting
              ? <Loader2 size={16} className="wk-spin" />
              : <Sparkles size={16} />}
            Analyse dose
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="wk-inline-error">
          <AlertTriangle size={16} /> {errorMsg}
        </div>
      )}

      {/* ── Demo simulator: runs the REAL CV + ML pipeline on a
             server-rendered synthetic band photograph ── */}
      <div className="wk-sim-card">
        <div className="wk-sim-head">
          <FlaskConical size={17} />
          <span>Demo simulator</span>
          <span className="wk-sim-tag">synthetic photo · real CV + ML</span>
        </div>
        <label className="wk-range-row">
          <span>True exposure dose <strong>{simDose} ppm·hr</strong></span>
          <input type="range" min={0} max={100} value={simDose}
            onChange={(e) => setSimDose(Number(e.target.value))} />
        </label>
        <label className="wk-range-row">
          <span>Temperature <strong>{simTemp} °C</strong></span>
          <input type="range" min={15} max={40} value={simTemp}
            onChange={(e) => setSimTemp(Number(e.target.value))} />
        </label>
        <label className="wk-range-row">
          <span>Humidity <strong>{simRh} %RH</strong></span>
          <input type="range" min={30} max={90} value={simRh}
            onChange={(e) => setSimRh(Number(e.target.value))} />
        </label>
        <button className="btn btn-secondary wk-sim-btn" onClick={runSimulator}
          disabled={simBusy}>
          {simBusy ? <Loader2 size={16} className="wk-spin" /> : <FlaskConical size={16} />}
          {simBusy ? 'Rendering & analysing…' : 'Render photo & estimate dose'}
        </button>
      </div>
    </div>
  );
}
