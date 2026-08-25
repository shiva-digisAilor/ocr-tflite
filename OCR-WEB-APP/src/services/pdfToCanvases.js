/**
 * pdfToCanvases.js
 * Save this into: src/services/pdfToCanvases.js
 *
 * Turns a PDF File (1 page or many) into an array of canvases — one per
 * page — so each page can be run through the existing orientation-fix +
 * OCR pipeline exactly like a normal uploaded image.
 *
 * Requires: npm install pdfjs-dist
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Some scanned PDFs embed the actual passport photo as a small image
 * sitting inside a much larger, mostly-blank page. Rendering the whole
 * page at a fixed zoom makes the real content tiny and blurry — this
 * finds the bounding box of the actual (non-white) content, crops to
 * just that, and upscales it so text stays sharp enough for OCR
 * regardless of how much blank margin the original PDF page had.
 */
function trimAndUpscale(canvas, { targetWidth = 1600, whiteThreshold = 245, padding = 12, step = 2 } = {}) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const { data } = ctx.getImageData(0, 0, width, height);

  let minX = width, minY = height, maxX = 0, maxY = 0;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r < whiteThreshold || g < whiteThreshold || b < whiteThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Nothing but blank page found — return the original untouched.
  if (maxX <= minX || maxY <= minY) return canvas;

  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(width, maxX + padding);
  maxY = Math.min(height, maxY + padding);

  const cropW = maxX - minX;
  const cropH = maxY - minY;
  const scale = cropW < targetWidth ? targetWidth / cropW : 1;

  const out = document.createElement('canvas');
  out.width = Math.round(cropW * scale);
  out.height = Math.round(cropH * scale);
  const outCtx = out.getContext('2d');
  outCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, out.width, out.height);

  return out;
}

/**
 * @param {File} file - the uploaded PDF file
 * @param {number} scale - render resolution multiplier. Higher = sharper
 *   text = better OCR accuracy, but slower and more memory. 2.5 is a good
 *   default for reading small text like an MRZ line; bump it up if pages
 *   are coming out blurry, or down if it's too slow.
 * @returns {Promise<HTMLCanvasElement[]>}
 */
export async function pdfFileToCanvases(file, scale = 2.5) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const canvases = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    // white background first — some PDFs have transparent page backgrounds,
    // which would otherwise confuse the trim step above
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport }).promise;

    canvases.push(trimAndUpscale(canvas));
  }

  return canvases;
}