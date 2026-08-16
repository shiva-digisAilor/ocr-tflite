import React, { useState, useRef } from 'react';
import { Upload, Image as ImageIcon, FileText } from 'lucide-react';

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export default function ImageUploader({ onImageSelected, onError }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const validateAndProcessFile = (file) => {
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type.toLowerCase())) {
      onError(`Unsupported file format. Please upload JPG, PNG, JPEG, WEBP, or PDF.`);
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      onError(`File is too large. Maximum file size is ${MAX_FILE_SIZE_MB}MB.`);
      return;
    }

    onImageSelected(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndProcessFile(e.target.files[0]);
    }
  };

  return (
    <div className="workspace-panel">
      <div
        className={`upload-zone ${isDragOver ? 'active' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInputChange}
          accept=".jpg,.jpeg,.png,.webp,.pdf"
          style={{ display: 'none' }}
        />

        {/* Animated upload icon */}
        <div className="upload-icon-wrapper">
          <div className="upload-icon">
            <Upload size={48} />
          </div>
        </div>

        <h2 className="upload-heading">Drop your image or PDF here</h2>
        <p className="upload-description">
          Upload an image or PDF and we'll extract the text for you.
        </p>

        <button
          type="button"
          className="btn-upload"
          onClick={() => fileInputRef.current?.click()}
        >
          <ImageIcon size={20} />
          Upload File
        </button>

        <div className="upload-formats">
          <span>JPG · JPEG · PNG · WEBP · PDF</span>
          <span className="format-divider">•</span>
          <span>Max 10 MB</span>
        </div>
      </div>
    </div>
  );
}

