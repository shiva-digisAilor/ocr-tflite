import React from 'react';
import { Sparkles, Loader2 } from 'lucide-react';

export default function OCRButton({ hasImage, isProcessing, onClick }) {
  return (
    <div className="ocr-button-wrapper">
      <button
        type="button"
        className={`btn-recognize ${!hasImage ? 'disabled' : ''} ${isProcessing ? 'processing' : ''}`}
        disabled={!hasImage || isProcessing}
        onClick={onClick}
      >
        {isProcessing ? (
          <>
            <Loader2 size={20} className="icon-spin" />
            <span>Processing...</span>
          </>
        ) : (
          <>
            <Sparkles size={20} />
            <span>Recognize Text</span>
          </>
        )}
      </button>
    </div>
  );
}

