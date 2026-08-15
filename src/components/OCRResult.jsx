import React, { useState } from 'react';
import { Copy, Check, Trash2, Download, FileText } from 'lucide-react';

export default function OCRResult({ text, onTextChange, onClear, sampleTitle, confidence }) {
  const [copied, setCopied] = useState(false);

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charCount = text.length;
  const lineCount = text ? text.split('\n').length : 0;

  const handleCopy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleDownload = () => {
    if (!text) return;
    const element = document.createElement('a');
    const file = new Blob([text], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `extracted_text_${Date.now()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  if (!text) {
    return (
      <div className="workspace-panel">
        <div className="empty-state">
          <div className="empty-icon">
            <FileText size={48} />
          </div>
          <h3 className="empty-title">No text yet</h3>
          <p className="empty-description">
            Upload an image and extract text to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-panel">
      <div className="result-container">
        {/* Header */}
        <div className="result-header">
          <h2 className="result-title">Extracted Text</h2>
          {sampleTitle && (
            <div className="result-badge">{sampleTitle}</div>
          )}
        </div>

        {/* Text Area */}
        <textarea
          className="result-textarea"
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="Text will appear here..."
          spellCheck="false"
        />

        {/* Stats */}
        <div className="result-stats">
          <div className="stat">
            <span className="stat-label">Words</span>
            <span className="stat-value">{wordCount}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Characters</span>
            <span className="stat-value">{charCount}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Lines</span>
            <span className="stat-value">{lineCount}</span>
          </div>
          {confidence && (
            <div className="stat">
              <span className="stat-label">Confidence</span>
              <span className="stat-value">{Math.round(confidence * 100)}%</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="result-actions">
          <button
            type="button"
            className="btn-action"
            onClick={handleCopy}
            title="Copy to clipboard"
          >
            {copied ? (
              <>
                <Check size={16} />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy size={16} />
                <span>Copy</span>
              </>
            )}
          </button>
          <button
            type="button"
            className="btn-action"
            onClick={handleDownload}
            title="Download as .txt"
          >
            <Download size={16} />
            <span>Download</span>
          </button>
          <button
            type="button"
            className="btn-action"
            onClick={onClear}
            title="Clear results"
          >
            <Trash2 size={16} />
            <span>Clear</span>
          </button>
        </div>
      </div>
    </div>
  );
}
