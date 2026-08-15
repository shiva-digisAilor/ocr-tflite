import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, X, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';

export default function CameraModal({ isOpen, onClose, onCapture, onError }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraError, setCameraError] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setIsInitializing(true);
    setCameraError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera capture is not supported in this browser environment.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsInitializing(false);
    } catch (err) {
      console.error('Camera access error:', err);
      setIsInitializing(false);
      let msg = 'Failed to access camera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera permission denied. Please allow camera permissions in your browser settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No camera device found on this system.';
      } else {
        msg = err.message || msg;
      }
      setCameraError(msg);
      onError?.(msg);
    }
  }, [onError]);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  const handleTakePhoto = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `camera_capture_${Date.now()}.png`, { type: 'image/png' });
        onCapture(file);
        onClose();
      }
    }, 'image/png');
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">
            <Camera size={20} />
            Capture Photo
          </h3>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="camera-view-container">
          {cameraError ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
              <AlertTriangle size={40} style={{ marginBottom: '1rem', display: 'block', margin: '0 auto 1rem' }} />
              <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Camera Unavailable</p>
              <p style={{ fontSize: '0.875rem', color: '#cbd5e1', maxWidth: '360px', margin: '0 auto' }}>
                {cameraError}
              </p>
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="camera-video"
            />
          )}

          {isInitializing && !cameraError && (
            <div style={{ position: 'absolute', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <RefreshCw size={20} className="spin-icon" style={{ animation: 'spin 1s linear infinite' }} />
              <span>Starting camera stream...</span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>

          {!cameraError && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleTakePhoto}
              disabled={isInitializing}
            >
              <CheckCircle size={18} />
              Take Photo
            </button>
          )}

          {cameraError && (
            <button type="button" className="btn btn-secondary" onClick={startCamera}>
              <RefreshCw size={16} />
              Retry Camera
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
