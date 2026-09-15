import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import jsQR from 'jsqr';
import {
  AlertTriangle, ArrowRight, BadgeCheck, Camera, Keyboard, Loader2,
  QrCode, RefreshCw, Search, XCircle,
} from 'lucide-react';
import { api, ClientError } from '../services/api';
import type { Wristband } from '../types/api';
import { useCamera } from './useCamera';
import { formatDate } from '../utils/format';

type Phase = 'scanning' | 'checking' | 'found' | 'blocked';

export default function ScanPage() {
  const navigate = useNavigate();
  const { videoRef, ready, error, start } = useCamera('environment');
  const rafRef = useRef<number | null>(null);
  const scanningRef = useRef(true);
  const [phase, setPhase] = useState<Phase>('scanning');
  const [band, setBand] = useState<Wristband | null>(null);
  const [message, setMessage] = useState('');
  const [manual, setManual] = useState('');
  const [showManual, setShowManual] = useState(false);

  const verifyBand = async (qrId: string) => {
    if (!scanningRef.current) return;
    scanningRef.current = false;
    setPhase('checking');
    setMessage('');
    try {
      const b = await api.lookupBand(qrId);
      setBand(b);
      setPhase(b.can_use ? 'found' : 'blocked');
    } catch (err) {
      scanningRef.current = true;
      setPhase('scanning');
      setMessage(
        err instanceof ClientError
          ? `${qrId}: ${err.message}`
          : `Could not verify ${qrId}`,
      );
    }
  };

  useEffect(() => {
    start();
    const canvas = document.createElement('canvas');

    const tick = () => {
      const video = videoRef.current;
      if (scanningRef.current && video && video.videoWidth > 0) {
        const w = Math.min(480, video.videoWidth);
        const scale = w / video.videoWidth;
        canvas.width = w;
        canvas.height = Math.round(video.videoHeight * scale);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(img.data, img.width, img.height,
                            { inversionAttempts: 'attemptBoth' });
          if (code?.data) {
            void verifyBand(code.data.trim().toUpperCase());
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      scanningRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const reset = () => {
    setBand(null);
    setMessage('');
    setPhase('scanning');
    scanningRef.current = true;
  };

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (manual.trim()) void verifyBand(manual.trim().toUpperCase());
  };

  return (
    <div className="wk-page">
      <h1 className="wk-page-title">Scan wristband</h1>
      <p className="wk-page-sub">Point the camera at the QR code on the band.</p>

      {phase !== 'found' && phase !== 'blocked' && (
        <div className="wk-scanner">
          {error ? (
            <div className="wk-camera-error">
              <Camera size={30} />
              <p>{error}</p>
            </div>
          ) : (
            <div className="wk-video-wrap">
              <video ref={videoRef} playsInline muted className="wk-video" />
              <div className="wk-qr-overlay">
                <span className="wk-qr-corner tl" /><span className="wk-qr-corner tr" />
                <span className="wk-qr-corner bl" /><span className="wk-qr-corner br" />
              </div>
              {phase === 'checking' && (
                <div className="wk-scan-toast">
                  <Loader2 size={17} className="wk-spin" /> Verifying band…
                </div>
              )}
            </div>
          )}
          <button className="wk-link-btn" onClick={() => setShowManual((v) => !v)}>
            <Keyboard size={15} /> Enter band ID manually
          </button>
          {showManual && (
            <form className="wk-manual-form" onSubmit={submitManual}>
              <input
                className="form-input"
                placeholder="e.g. H2S-000013"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
              />
              <button className="btn btn-primary" type="submit">
                <Search size={16} /> Verify
              </button>
            </form>
          )}
          {message && <div className="wk-inline-error"><AlertTriangle size={15} />{message}</div>}
        </div>
      )}

      {phase === 'checking' && !band && <div className="wk-muted">Checking band with server…</div>}

      {(phase === 'found' || phase === 'blocked') && band && (
        <div className="wk-band-result">
          <div className={`wk-band-status ${phase === 'found' ? 'ok' : 'bad'}`}>
            {phase === 'found' ? <BadgeCheck size={40} /> : <XCircle size={40} />}
            <div>
              <div className="wk-band-status-title">
                {phase === 'found' ? 'Wristband verified' : 'Wristband cannot be used'}
              </div>
              <div className="wk-band-status-sub">
                {phase === 'found'
                  ? 'Band is valid and assigned to you.'
                  : band.is_expired
                    ? 'This band has passed its expiry date.'
                    : band.status === 'invalid'
                      ? 'This band has been invalidated.'
                      : 'This band is assigned to another worker.'}
              </div>
            </div>
          </div>

          <div className="wk-card">
            <div className="wk-band-detail-row">
              <QrCode size={17} /><span>Band ID</span><strong>{band.qr_id}</strong>
            </div>
            <div className="wk-band-detail-row">
              <span className="wk-gap" />
              <span>Status</span>
              <strong className="text-capitalize">{band.status.replace('_', ' ')}</strong>
            </div>
            <div className="wk-band-detail-row">
              <span className="wk-gap" /><span>Use by</span>
              <strong>{formatDate(band.expiry_date)}</strong>
            </div>
            {band.worker_name && (
              <div className="wk-band-detail-row">
                <span className="wk-gap" /><span>Assigned</span>
                <strong>{band.worker_name}</strong>
              </div>
            )}
          </div>

          <div className="wk-actions-row">
            <button className="btn btn-ghost" onClick={reset}>
              <RefreshCw size={16} /> Scan another
            </button>
            {phase === 'found' && (
              <button className="btn btn-primary"
                onClick={() => navigate('/worker/capture', { state: { band } })}>
                Continue <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
