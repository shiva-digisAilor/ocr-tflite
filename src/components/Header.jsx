import React from 'react';
import { ScanText, Sparkles } from 'lucide-react';

export default function Header() {
  return (
    <header className="header-wrapper">
      <div className="header-container">
        <div className="brand-section">
          <div className="brand-logo-icon">
            <ScanText size={24} />
          </div>
          <div className="brand-info">
            <h1 className="brand-title">
              OCR Scanner
              <span className="brand-badge">
                <Sparkles size={10} style={{ display: 'inline', marginRight: '3px' }} />
                Browser AI
              </span>
            </h1>
            <p className="brand-subtitle">Extract text directly from your image</p>
          </div>
        </div>
      </div>
    </header>
  );
}
