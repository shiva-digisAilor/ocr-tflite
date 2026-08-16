import Tesseract from "tesseract.js";

/**
 * OCR Service Module — Tesseract.js backend, with image preprocessing.
 *
 * Public contract unchanged: recognizeText(imageSource, { onProgress })
 * => Promise<{ text, confidence, timingMs, wordCount, characterCount }>
 */

/**
 * Preprocesses an image before OCR to improve accuracy across varied
 * fonts/photo quality. Three things that consistently help Tesseract:
 *  1. Grayscale — color information is noise for text recognition.
 *  2. Contrast boost — faint/low-contrast text (photos, screenshots
 *     of low-quality scans) is the #1 cause of missed characters.
 *  3. Upscaling small images — Tesseract's model was trained on
 *     reasonably sized text; tiny source images lose detail before
 *     recognition even starts.
 * This does NOT fix decorative/cursive/script fonts — that's a
 * genuine model limitation, not an image-quality problem (see note
 * below).
 */
async function preprocessImage(imageSource) {
  const img = await loadImage(imageSource);

  // Upscale if the image is small — recognition quality drops fast
  // below ~1000px on the longer side.
  const scale = img.width < 1000 ? 1000 / img.width : 1;
  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Convert to grayscale, then stretch contrast so faint text becomes
  // solidly dark and the background becomes solidly light.
  let min = 255, max = 0;
  const grayValues = new Uint8ClampedArray(width * height);
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    grayValues[i / 4] = gray;
    if (gray < min) min = gray;
    if (gray > max) max = gray;
  }

  const range = Math.max(1, max - min); // avoid divide-by-zero on blank images
  for (let i = 0; i < data.length; i += 4) {
    const stretched = ((grayValues[i / 4] - min) / range) * 255;
    data[i] = data[i + 1] = data[i + 2] = stretched;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = typeof source === "string" ? source : URL.createObjectURL(source);
  });
}

export async function recognizeText(imageSource, options = {}) {
  const { onProgress } = options;
  const startTime = performance.now();

  onProgress?.("Preparing image...", 3);
  const preprocessedCanvas = await preprocessImage(imageSource);

  const result = await Tesseract.recognize(preprocessedCanvas, "eng", {
    logger: (info) => {
      if (info.status === "loading tesseract core" || info.status === "loading language traineddata") {
        onProgress?.("Loading OCR engine...", 8);
      } else if (info.status === "initializing tesseract") {
        onProgress?.("Initializing...", 12);
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
    confidence: (result.data.confidence || 0) / 100,
    timingMs,
    wordCount,
    characterCount,
  };
}