import { useState } from 'react';
import { runOcrOnFile } from './services/paddleOcrService';
import ImageUploader from './components/ImageUploader/ImageUploader';
import ResultViewer from './components/ResultViewer/ResultViewer';
import Loader from './components/Loader/Loader.jsx';
import './styles/global.css';

export default function App() {
  const [imageUrl, setImageUrl] = useState(null);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState(null);
  const [lang, setLang] = useState('english');
  const [activeTab, setActiveTab] = useState('workspace');
  const [history, setHistory] = useState([]);

  function addToHistory(item) {
    setHistory((prev) => [item, ...prev].slice(0, 12));
  }

  async function handleFile(file) {
    setRunError(null);
    setResult(null);
    setImageUrl(URL.createObjectURL(file));
    setRunning(true);

    try {
      const ocrResult = await runOcrOnFile(file, lang);
      setResult(ocrResult);
      addToHistory({
        id: Date.now() + Math.random(),
        fileName: file.name,
        text: ocrResult.text_extracted || '(no text found)',
        createdAt: new Date().toLocaleString()
      });
    } catch (err) {
      console.error(err);
      setRunError(err.message || String(err));
    } finally {
      setRunning(false);
      setActiveTab('workspace');
    }
  }

  return (
    <div className="app-shell">
      <header className="app__header">
        <div className="brand" aria-label="ImgExtract Pro logo">
          <span className="brand__icon">⬢</span>
          <span className="brand__text">ImgExtract Pro</span>
        </div>

        <nav className="app__nav" aria-label="Main navigation">
          <button
            type="button"
            className={`nav__tab ${activeTab === 'workspace' ? 'nav__tab--active' : ''}`}
            onClick={() => setActiveTab('workspace')}
          >
            Workplace
          </button>
          <button
            type="button"
            className={`nav__tab ${activeTab === 'history' ? 'nav__tab--active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            History ({history.length})
          </button>
        </nav>
      </header>

      {activeTab === 'workspace' ? (
        <main className="workspace-view">
          <div className="app__controls">
            <label htmlFor="lang-select">
              Language:&nbsp;
              <select
                id="lang-select"
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                disabled={running}
              >
                <option value="english">English (Best)</option>
                <option value="tamil">Tamil (Best)</option>
                <option value="hindi">Hindi</option>
                <option value="cjk">Chinese / Japanese</option>
              </select>
            </label>
          </div>

          <ImageUploader onFileSelected={handleFile} disabled={running} />

          {running && <Loader label="Running OCR… First run may take longer while models download." />}

          {runError && (
            <div className="app__error">
              OCR failed: {runError}
            </div>
          )}

          <ResultViewer imageUrl={imageUrl} result={result} />
        </main>
      ) : (
        <main className="history-view">
          <div className="history__header">
            <h2>Recent Extraction History</h2>
            <p>Items reset when the page refreshes.</p>
          </div>

          {history.length === 0 ? (
            <div className="history__empty">
              No recent uploads yet.
            </div>
          ) : (
            <div className="history__list">
              {history.map((item) => (
                <article key={item.id} className="history__card">
                  <div className="history__meta">
                    <span className="history__file">{item.fileName}</span>
                    <span className="history__time">{item.createdAt}</span>
                  </div>
                  <p className="history__text">{item.text}</p>
                </article>
              ))}
            </div>
          )}
        </main>
      )}
    </div>
  );
}
