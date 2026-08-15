import React from 'react';
import { FileText, Settings, CircleUser } from 'lucide-react';

export default function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Left: Logo */}
        <div className="navbar-brand">
          <div className="navbar-icon">
            <FileText size={20} />
          </div>
          <span className="navbar-title">OCR Studio</span>
        </div>

        {/* Center: Navigation */}
        <div className="navbar-center">
          <button className="nav-link">Workspace</button>
          <button className="nav-link">History</button>
        </div>

        {/* Right: Settings & Profile */}
        <div className="navbar-right">
          <button className="nav-icon-button" title="Settings">
            <Settings size={18} />
          </button>
          <button className="nav-avatar" title="Profile">
            <CircleUser size={20} />
          </button>
        </div>
      </div>
    </nav>
  );
}
