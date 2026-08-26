/**
 * pdfToCanvases.js
 * Save this into: src/services/pdfToCanvases.js
 *
 * CHANGED: this file used to render a PDF page AND decide how to split it
 * into left/right blocks, in one pass. That ordering was the bug — the
 * splitter was making an irreversible left/right cut based on an image
 * that might still be sideways, so "the gutter" it found was sometimes
 * just noise (the gap between a photo box and a text field), and it would
 * slice straight through real content like the MRZ line.
 *
 * This file now does ONE job only: turn each PDF page into a raw,
 * un-rotated, un-split canvas. Orientation-fixing and splitting both now
 * happen downstream, in passportIngest.js, AFTER the page is confirmed
 * upright. That ordering is what actually matters — see passportIngest.js
 * for the full explanation.
 *
 * Requires: npm install pdfjs-dist
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Renders every page of a PDF file to a canvas each. No cropping, no
 * splitting, no rotation-fixing — just "what does this page look like".
 *
 * @param {File} file - the uploaded PDF file
 * @param {number} scale - render resolution multiplier. Higher = sharper
 *   text = better OCR accuracy, but slower and more memory. 2.5 is a good
 *   default for reading small text like an MRZ line; bump it up if pages
 *   are coming out blurry, or down if it's too slow.
 * @returns {Promise<HTMLCanvasElement[]>} one raw canvas per PDF page
 */
export async function pdfFileToRawCanvases(file, scale = 2.5) {
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
    // which would otherwise confuse the trim step in passportIngest.js
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport }).promise;
    canvases.push(canvas);
  }

  return canvases;
}

/**
 * Same idea, but for a plain image file (jpg/png/webp/etc) instead of a
 * PDF — e.g. someone photographs their passport and uploads the photo
 * directly. Previously there was no code path for this at all; anything
 * that wasn't a PDF presumably fell through to nothing or crashed. Now
 * both file types feed the exact same downstream pipeline.
 *
 * @param {File} file - the uploaded image file
 * @returns {Promise<HTMLCanvasElement[]>} always length 1, kept as an
 *   array so callers can treat PDFs and images identically
 */
export async function imageFileToRawCanvases(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Failed to decode image file — it may be corrupted'));
    el.src = dataUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);

  return [canvas];
}

/**
 * Single entry point: PDF or image in, raw per-page canvases out.
 * Use this from passportIngest.js instead of picking a function by hand.
 *
 * @param {File} file
 * @returns {Promise<HTMLCanvasElement[]>}
 */
export async function fileToRawCanvases(file) {
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();

  if (type === 'application/pdf' || name.endsWith('.pdf')) {
    return pdfFileToRawCanvases(file);
  }
  if (type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|heic|heif)$/.test(name)) {
    return imageFileToRawCanvases(file);
  }
  throw new Error(`Unsupported file type for passport ingest: "${file.type || 'unknown'}" (${file.name || 'no filename'})`);
}