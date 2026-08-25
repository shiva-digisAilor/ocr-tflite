import { useRef } from 'react';

// A file counts as uploadable if it's an image OR a PDF.
function isAcceptedFile(file) {
  if (!file) return false;
  return file.type.startsWith('image/') || file.type === 'application/pdf';
}

export default function ImageUploader({ onFileSelected, disabled }) {
  const inputRef = useRef(null);

  function handleChange(e) {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelected(file);
    }
    // Reset so the same file can be selected again
    e.target.value = '';
  }

  function handleDrop(e) {
    e.preventDefault();
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (isAcceptedFile(file)) {
      onFileSelected(file);
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
  }

  return (
    <div
      className={`uploader ${disabled ? 'uploader--disabled' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={() => !disabled && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        onChange={handleChange}
        disabled={disabled}
        hidden
      />
      <div className="uploader__content">
        <div className="uploader__icon">📷</div>
        <p className="uploader__text">
          {disabled ? 'Please wait…' : 'Click or drop an image or PDF here'}
        </p>
        <p className="uploader__hint">Supports JPG, PNG, WebP, PDF, etc.</p>
      </div>
    </div>
  );
}