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
  const [view, setView] = useState('ocr');
  const [selectedHistoryEntry, setSelectedHistoryEntry] = useState(null);
  const [historyItems, setHistoryItems] = useState(() => {
    try {
      const saved = localStorage.getItem('text-extractor-history');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Failed to load history:', error);
      return [];
    }
  });

  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    try {
      localStorage.setItem('text-extractor-history', JSON.stringify(historyItems.slice(0, 8)));
    } catch (error) {
      console.error('Failed to save history:', error);
    }
  }, [historyItems]);

  const formatHistoryDate = (dateString) => {
    if (!dateString) return 'Recent extraction';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(date);
  };

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

  const saveToHistory = (text) => {
    const cleanText = (text || '').trim();
    if (!cleanText) return;

    const entry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      text: cleanText,
      createdAt: new Date().toISOString()
    };

    setHistoryItems((prev) => {
      const filtered = prev.filter((item) => item.text !== cleanText);
      return [entry, ...filtered].slice(0, 8);
    });
  };

  const handleNavigate = (nextView) => {
    setView(nextView);
    if (nextView !== 'history-detail') {
      setSelectedHistoryEntry(null);
    }
  };

  const handleHistoryOpen = (entry) => {
    setSelectedHistoryEntry(entry);
    setView('history-detail');
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
      saveToHistory(finalText);
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

  const deleteHistoryItem = (id) => {
    setHistoryItems((prev) => prev.filter((item) => item.id !== id));
    if (selectedHistoryEntry && selectedHistoryEntry.id === id) {
      setSelectedHistoryEntry(null);
      setView('history');
    }
  };

  const deleteAllHistory = () => {
    setHistoryItems([]);
    setSelectedHistoryEntry(null);
    setView('history');
  };

  const renderHistoryList = () => (
    <div className="history-page">
      <div className="history-header-row">
        <div>
          <p className="history-kicker">Saved records</p>
          <h2 className="history-title">Extraction History</h2>
        </div>
        <div className="history-header-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => handleNavigate('ocr')}
          >
            Back to workspace
          </button>
          {historyItems.length > 0 && (
            <button
              type="button"
              className="danger-button"
              onClick={deleteAllHistory}
            >
              Delete all
            </button>
          )}
        </div>
      </div>

      {historyItems.length === 0 ? (
        <div className="history-empty-state">
          <p>No saved extractions yet.</p>
          <span>Run OCR once and it will appear here.</span>
        </div>
      ) : (
        <div className="history-list">
          {historyItems.map((item) => (
            <div
              key={item.id}
              className="history-item-card"
              onClick={() => handleHistoryOpen(item)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleHistoryOpen(item);
                }
              }}
            >
              <div className="history-item-topline">
                <span>{formatHistoryDate(item.createdAt)}</span>
                <span>{(item.text || '').trim().split(/\s+/).filter(Boolean).length} words</span>
              </div>
              <p className="history-item-preview">{(item.text || '').replace(/\s+/g, ' ').trim().slice(0, 220) || 'No text available'}</p>
              <div className="history-card-actions">
                <button
                  type="button"
                  className="history-delete-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    deleteHistoryItem(item.id);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderHistoryDetail = () => {
    if (!selectedHistoryEntry) {
      return renderHistoryList();
    }

    return (
      <div className="history-detail-page">
        <div className="history-header-row">
          <div>
            <p className="history-kicker">Saved record</p>
            <h2 className="history-title">Full extracted text</h2>
          </div>
          <div className="history-header-actions">
            <button type="button" className="secondary-button" onClick={() => handleNavigate('history')}>
              Back to history
            </button>
            <button
              type="button"
              className="danger-button"
              onClick={() => deleteHistoryItem(selectedHistoryEntry.id)}
            >
              Delete
            </button>
          </div>
        </div>

        <div className="history-detail-meta">
          <span>{formatHistoryDate(selectedHistoryEntry.createdAt)}</span>
          <span>{(selectedHistoryEntry.text || '').trim().split(/\s+/).filter(Boolean).length} words</span>
        </div>

        <textarea
          className="history-detail-textarea"
          value={selectedHistoryEntry.text || ''}
          readOnly
          spellCheck="false"
        />
      </div>
    );
  };

  return (
    <div className="app-container">
      <Navbar
        activeView={view}
        historyCount={historyItems.length}
        onNavigate={handleNavigate}
      />

      {view === 'ocr' ? (
        <>
          <Hero />

          <main className="main-content">
            <div className="workspace-grid">
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
        </>
      ) : (
        <main className="main-content history-main-content">
          {view === 'history' ? renderHistoryList() : renderHistoryDetail()}
        </main>
      )}

      <Toast toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
