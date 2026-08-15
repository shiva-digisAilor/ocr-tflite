import React, { useState, useEffect } from 'react';
import { Trash2, RotateCcw } from 'lucide-react';

export default function ImagePreview({ imageFile, previewUrl, onRemove, onSelectAnother }) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!previewUrl) return;

    const img = new Image();
    img.onload = () => {
      setDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = previewUrl;
  }, [previewUrl]);

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="workspace-panel">
      <div className="image-preview-container">
        {/* Image Display */}
        <div className="preview-display">
          <img
            src={previewUrl}
            alt="Preview"
            className="preview-image"
          />
          
          {/* Overlay gradient */}
          <div className="preview-overlay" />
        </div>

        {/* Image Info Card */}
        <div className="preview-info">
          <div className="info-item">
            <span className="info-label">File</span>
            <span className="info-value">{imageFile?.name || 'Image'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Size</span>
            <span className="info-value">{formatFileSize(imageFile?.size)}</span>
          </div>
          {dimensions.width > 0 && (
            <div className="info-item">
              <span className="info-label">Dimensions</span>
              <span className="info-value">{dimensions.width}×{dimensions.height}px</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="preview-actions">
          <button
            type="button"
            className="btn-action"
            onClick={onSelectAnother}
            title="Replace image"
          >
            <RotateCcw size={16} />
            Replace
          </button>
          <button
            type="button"
            className="btn-action btn-action-danger"
            onClick={onRemove}
            title="Remove image"
          >
            <Trash2 size={16} />
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

