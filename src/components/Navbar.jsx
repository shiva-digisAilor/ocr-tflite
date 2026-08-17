import React from 'react';
import { FileText } from 'lucide-react';

export default function Navbar({ activeView = 'ocr', onNavigate, historyCount = 0 }) {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Left: Logo */}
        <div className="navbar-brand">
          <div className="navbar-icon">
            <FileText size={20} />
          </div>
          <span className="navbar-title">Text Extractor Pro</span>
        </div>

        {/* Center: Navigation */}
        <div className="navbar-center">
          <button
            type="button"
            className={`nav-link ${activeView === 'ocr' ? 'active' : ''}`}
            onClick={() => onNavigate('ocr')}
          >
            Workspace
          </button>
          <button
            type="button"
            className={`nav-link ${activeView === 'history' || activeView === 'history-detail' ? 'active' : ''}`}
            onClick={() => onNavigate('history')}
          >
            History {historyCount > 0 ? `(${historyCount})` : ''}
          </button>
        </div>

        {/* Right: (removed Settings & Profile buttons) */}
        <div className="navbar-right" />
      </div>
    </nav>
  );
}
