import Tesseract from "tesseract.js";

/**
 * OCR Service Module — Tesseract.js backend, with adaptive-threshold
 * preprocessing (a step up from plain contrast stretching).
 *
 * Public contract unchanged: recognizeText(imageSource, { onProgress })
 * => Promise<{ text, confidence, timingMs, wordCount, characterCount }>
 */

async function preprocessImage(imageSource) {
  const img = await loadImage(imageSource);

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
  const pixelCount = width * height;

  // Step 1: grayscale
  const gray = new Uint8ClampedArray(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    gray[i] = r * 0.299 + g * 0.587 + b * 0.114;
  }

  // Step 2: Otsu's method — finds the statistically optimal threshold
  // to split pixels into "text" vs "background", rather than a fixed
  // guess. Meaningfully more robust than plain contrast stretching for
  // uneven lighting, low-contrast photos, or bold/heavy fonts, since it
  // adapts to each image's actual pixel distribution instead of
  // assuming one fixed cutoff works for every image.
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < pixelCount; i++) histogram[gray[i]]++;

  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * histogram[t];

  let sumBackground = 0, weightBackground = 0, maxVariance = 0, threshold = 0;
  for (let t = 0; t < 256; t++) {
    weightBackground += histogram[t];
    if (weightBackground === 0) continue;
    const weightForeground = pixelCount - weightBackground;
    if (weightForeground === 0) break;

    sumBackground += t * histogram[t];
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sum - sumBackground) / weightForeground;
    const variance = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;

    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = t;
    }
  }

  // Step 3: apply the threshold — pure black text, pure white background.
  for (let i = 0; i < pixelCount; i++) {
    const value = gray[i] > threshold ? 255 : 0;
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = value;
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