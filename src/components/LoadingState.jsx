import React from 'react';
import { Zap } from 'lucide-react';

export default function LoadingState({ progressMessage, progressPercent = 50 }) {
  return (
    <div className="workspace-panel">
      <div className="loading-container">
        {/* Scanning Animation */}
        <div className="scanning-area">
          <div className="scanning-line" style={{ height: `${Math.min(Math.max(progressPercent, 5), 100)}%` }} />
          <div className="scanning-glow" />
        </div>

        {/* Text Content */}
        <div className="loading-content">
          <h3 className="loading-title">Processing</h3>
          <p className="loading-message">
            {progressMessage || 'Extracting text from image...'}
          </p>

          {/* Progress Bar */}
          <div className="progress-container">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${Math.min(Math.max(progressPercent, 0), 100)}%` }}
              />
            </div>
            <span className="progress-text">{Math.round(progressPercent)}%</span>
          </div>

          {/* Info */}
          <div className="loading-info">
            <Zap size={14} />
            <span>Running inference locally</span>
          </div>
        </div>
      </div>
    </div>
  );
}
