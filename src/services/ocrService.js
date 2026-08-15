/**
 * OCR Service Module
 *
 * ============================================================================
 * TFLITE OCR INTEGRATION BOUNDARY
 * ============================================================================
 *
 * This service exposes the same contract `recognizeText(imageSource, options)`
 * the UI already calls — but it's now backed by the real TFLite pipeline in
 * src/ocr/ (PP-OCRv5 detection + recognition models) instead of mock data.
 * ============================================================================
 */

import { runOcr } from "../ocr/runOcr";

/**
 * Recognize text from an image source.
 *
 * @param {File | Blob | string} imageSource - a File/Blob, or an image URL string
 * @param {Object} [options]
 * @param {(stage: string, percent: number) => void} [options.onProgress]
 * @returns {Promise<{ text: string, confidence: number, timingMs: number, wordCount: number, characterCount: number }>}
 */
export async function recognizeText(imageSource, options = {}) {
  const { onProgress } = options;
  const startTime = performance.now();

  const result = await runOcr(imageSource, onProgress);

  const extractedText = result.text || "";
  const wordCount = extractedText.trim() ? extractedText.trim().split(/\s+/).length : 0;
  const characterCount = extractedText.length;
  const timingMs = Math.round(performance.now() - startTime);

  return {
    text: extractedText,
    confidence: result.confidence || 0,
    timingMs,
    wordCount,
    characterCount,
  };
}
