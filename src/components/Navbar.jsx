import React from 'react';
import { FileText } from 'lucide-react';

export default function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Left: Logo */}
          <div className="navbar-brand">
          <div className="navbar-icon">
            <FileText size={20} />
          </div>
          <span className="navbar-title">Img to Txt</span>
        </div>

        {/* Center: Navigation */}
        <div className="navbar-center">
          <button className="nav-link">Workspace</button>
          <button className="nav-link">History</button>
        </div>

        {/* Right: (removed Settings & Profile buttons) */}
        <div className="navbar-right" />
      </div>
    </nav>
  );
}
