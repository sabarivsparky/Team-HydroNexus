import { useCallback, useEffect, useRef, useState } from 'react';

interface CameraState {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  ready: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

/** getUserMedia lifecycle shared by QR scanning and capture pages. */
export function useCamera(facingMode: 'environment' | 'user' = 'environment'): CameraState {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setReady(false);
  }, []);

  const start = useCallback(async () => {
    if (streamRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access is not supported in this browser. Use the Demo Simulator below.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
        setReady(true);
      }
    } catch (err) {
      const name = (err as DOMException)?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setError('Camera permission was denied. Allow camera access or use the Demo Simulator.');
      } else if (name === 'NotFoundError') {
        setError('No camera found on this device. Use the Demo Simulator below.');
      } else {
        setError('Could not start the camera. Use the Demo Simulator below.');
      }
    }
  }, [facingMode]);

  useEffect(() => () => stop(), [stop]);

  return { videoRef, ready, error, start, stop };
}

/** Capture the current video frame as a JPEG Blob. */
export function captureFrame(video: HTMLVideoElement | null,
                              maxSide = 1600): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (!video || !video.videoWidth) return resolve(null);
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const scale = Math.min(1, maxSide / Math.max(vw, vh));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(vw * scale);
    canvas.height = Math.round(vh * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return resolve(null);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92);
  });
}
