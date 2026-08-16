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
import { pdfFileToImages } from '../services/pdfUtils';

export default function OCRPage() {
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [pdfPages, setPdfPages] = useState(null);
  
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

  const handleImageSelected = async (file) => {
    // Reset previous state
    setImageFile(null);
    setPreviewUrl(null);
    setPdfPages(null);
    setExtractedText('');
    setSampleTitle('');
    setConfidence(null);

    if (!file) return;

    if (file.type === 'application/pdf') {
      try {
        addToast('Converting PDF to images...', 'info', 3000);
        const pages = await pdfFileToImages(file, { scale: 1.5, maxPages: 50 });
        if (!pages || pages.length === 0) {
          addToast('No pages found in PDF.', 'error');
          return;
        }
        setPdfPages(pages);
        setImageFile(pages[0]); // preview first page
        addToast(`PDF uploaded — ${pages.length} page(s) converted`, 'success', 3000);
      } catch (err) {
        console.error('PDF conversion error', err);
        addToast('Failed to convert PDF to images.', 'error');
      }
    } else {
      setImageFile(file);
      addToast('Image uploaded successfully', 'success', 3000);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setPreviewUrl(null);
    setPdfPages(null);
    setExtractedText('');
    setSampleTitle('');
    setConfidence(null);
    addToast('Input cleared', 'info', 2500);
  };

  const handleRunOCR = async () => {
    if (!imageFile && !(pdfPages && pdfPages.length)) {
      addToast('Please select an image or PDF first.', 'error');
      return;
    }

    setIsProcessing(true);
    setProgressMessage('Initializing OCR service...');
    setProgressPercent(10);

    try {
      let finalText = '';
      let confidences = [];

      const pagesToProcess = pdfPages && pdfPages.length ? pdfPages : [imageFile];

      for (let i = 0; i < pagesToProcess.length; i++) {
        const pageFile = pagesToProcess[i];
        const pageIndex = i + 1;
        await recognizeText(pageFile, {
          onProgress: (stage, percent) => {
            setProgressMessage(`${stage} (page ${pageIndex}/${pagesToProcess.length})`);
            setProgressPercent(Math.round(percent * (0.9 / pagesToProcess.length) + (i * (100 / pagesToProcess.length))));
          }
        }).then((res) => {
          finalText += (finalText ? '\n\n' : '') + res.text;
          confidences.push(res.confidence || 0);
        });
      }

      const avgConfidence = confidences.length ? (confidences.reduce((a,b)=>a+b,0)/confidences.length) : 0.95;

      setExtractedText(finalText);
      setSampleTitle('');
      setConfidence(avgConfidence);
      addToast('Text recognized successfully!', 'success', 3500);
    } catch (err) {
      console.error('OCR error:', err);
      addToast(`OCR Processing failed: ${err.message || 'Unknown error'}`, 'error');
    } finally {
      setIsProcessing(false);
      setProgressMessage('');
      setProgressPercent(100);
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
