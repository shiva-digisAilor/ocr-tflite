import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import ImageUploader from '../components/ImageUploader';
import ImagePreview from '../components/ImagePreview';
import OCRButton from '../components/OCRButton';
import LoadingState from '../components/LoadingState';
import OCRResult from '../components/OCRResult';
import Toast from '../components/Toast';
import { recognizeText } from '../services/ocrService';

export default function OCRPage() {
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);

  const [extractedText, setExtractedText] = useState('');
  const [sampleTitle, setSampleTitle] = useState('');
  const [confidence, setConfidence] = useState(null);

  const [toasts, setToasts] = useState([]);

  // Generate object URL when image selection changes
  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [imageFile]);

  const addToast = (message, type = 'error', duration = 5000) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleImageSelected = (file) => {
    setImageFile(file);
    setExtractedText('');
    setSampleTitle('');
    setConfidence(null);
    addToast('Image uploaded successfully', 'success', 3000);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setPreviewUrl(null);
    setExtractedText('');
    setSampleTitle('');
    setConfidence(null);
    addToast('Image cleared', 'info', 2500);
  };

  const handleRunOCR = async () => {
    if (!imageFile && !previewUrl) {
      addToast('Please select an image first.', 'error');
      return;
    }

    setIsProcessing(true);
    setProgressMessage('Initializing OCR service...');
    setProgressPercent(10);

    try {
      const result = await recognizeText(imageFile || previewUrl, {
        onProgress: (stage, percent) => {
          setProgressMessage(stage);
          setProgressPercent(percent);
        }
      });

      setExtractedText(result.text);
      setSampleTitle(result.sampleTitle || '');
      setConfidence(result.confidence || 0.95);
      addToast('Text recognized successfully!', 'success', 3500);
    } catch (err) {
      console.error('OCR error:', err);
      addToast(`OCR Processing failed: ${err.message || 'Unknown error'}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearResult = () => {
    setExtractedText('');
    setSampleTitle('');
    setConfidence(null);
    addToast('Extracted text cleared', 'info', 2500);
  };

  return (
    <div className="app-container">
      <Navbar />
      <Hero />

      <main className="main-content">
        <div className="workspace-grid">
          {/* Left Column: Image Input / Preview */}
          <div className="workspace-column">
            {!previewUrl ? (
              <ImageUploader
                onImageSelected={handleImageSelected}
                onError={(err) => addToast(err, 'error')}
              />
            ) : (
              <ImagePreview
                imageFile={imageFile}
                previewUrl={previewUrl}
                onRemove={handleRemoveImage}
                onSelectAnother={() => setImageFile(null)}
              />
            )}

            <OCRButton
              hasImage={!!previewUrl}
              isProcessing={isProcessing}
              onClick={handleRunOCR}
            />
          </div>

          {/* Right Column: OCR Result / Loading state */}
          <div className="workspace-column">
            {isProcessing ? (
              <LoadingState
                progressMessage={progressMessage}
                progressPercent={progressPercent}
              />
            ) : (
              <OCRResult
                text={extractedText}
                onTextChange={setExtractedText}
                onClear={handleClearResult}
                sampleTitle={sampleTitle}
                confidence={confidence}
              />
            )}
          </div>
        </div>
      </main>

      {/* Toast Notification Container */}
      <Toast toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
