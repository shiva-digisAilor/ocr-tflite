import React from 'react';

export default function Hero() {
  return (
    <section className="hero-section">
      <div className="hero-container">
        <div className="hero-eyebrow">IMAGE → TEXT</div>
        
        <h1 className="hero-title">
          Turn your images into<span className="hero-accent"> text</span>.
        </h1>
        
        <p className="hero-subtitle">
          Fast, simple, and ready for browser-based OCR.
        </p>

        {/* Decorative animated accent */}
        <div className="hero-accent-decoration" />
      </div>
    </section>
  );
}
