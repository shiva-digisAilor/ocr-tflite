import Tesseract from "tesseract.js";

/**
 * OCR Service Module — Tesseract.js backend.
 *
 * Swapped in after the custom TFLite (PaddleOCR-v5) pipeline hit
 * unresolved model-accuracy issues under time pressure. Tesseract.js
 * is a proven, battle-tested OCR engine that runs fully in-browser
 * (WebAssembly) — same "no server, fully offline" property the TFLite
 * approach was going for, just via a different, already-working engine.
 *
 * Public contract is UNCHANGED from the TFLite version, so nothing in
 * components/ or pages/ needs to be touched:
 *   recognizeText(imageSource, { onProgress }) => Promise<{
 *     text, confidence, timingMs, wordCount, characterCount
 *   }>
 */

/**
 * @param {File | Blob | string} imageSource - a File/Blob, or an image URL string
 * @param {Object} [options]
 * @param {(stage: string, percent: number) => void} [options.onProgress]
 */
export async function recognizeText(imageSource, options = {}) {
  const { onProgress } = options;
  const startTime = performance.now();

  const result = await Tesseract.recognize(imageSource, "eng", {
    logger: (info) => {
      if (info.status === "loading tesseract core" || info.status === "loading language traineddata") {
        onProgress?.("Loading OCR engine...", 5);
      } else if (info.status === "initializing tesseract") {
        onProgress?.("Initializing...", 10);
      } else if (info.status === "recognizing text") {
        onProgress?.("Reading text...", 15 + Math.round(info.progress * 80));
      }
    },
  });

  const extractedText = result.data.text || "";
  const wordCount = extractedText.trim() ? extractedText.trim().split(/\s+/).length : 0;
  const characterCount = extractedText.length;
  const timingMs = Math.round(performance.now() - startTime);

  onProgress?.("Done.", 100);

  return {
    text: extractedText,
    // Tesseract reports confidence 0-100; the rest of the app expects 0-1.
    confidence: (result.data.confidence || 0) / 100,
    timingMs,
    wordCount,
    characterCount,
  };
}