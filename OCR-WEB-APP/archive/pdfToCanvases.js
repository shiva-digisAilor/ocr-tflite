/**
 * pdfToCanvases.js
 * Save this into: src/services/pdfToCanvases.js
 *
 * Turns a PDF File (1 page or many) into an array of canvases — one per
 * page (or TWO per page, if that page turns out to be a genuine two-page
 * spread — see splitPageIntoBlocks below) — so each can be run through the
 * existing orientation-fix + OCR pipeline exactly like a normal uploaded
 * image.
 *
 * Requires: npm install pdfjs-dist
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Crop a canvas down to just its non-white content (within the given x
 * range) and upscale it so the text is sharp enough for OCR, regardless of
 * how much blank margin the original had.
 */
function cropAndUpscale(canvas, xStart, xEnd, { targetWidth = 1600, whiteThreshold = 245, padding = 12, step = 2 } = {}) {
  const ctx = canvas.getContext('2d');
  const { height } = canvas;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  let minX = xEnd, minY = height, maxX = xStart, maxY = 0;

  for (let y = 0; y < height; y += step) {
    for (let x = xStart; x < xEnd; x += step) {
      const i = (y * canvas.width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r < whiteThreshold || g < whiteThreshold || b < whiteThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Nothing but blank found in this range — skip it.
  if (maxX <= minX || maxY <= minY) return null;

  minX = Math.max(xStart, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(xEnd, maxX + padding);
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
 * Scanned passport PDFs are sometimes a two-page spread (the bio-data page
 * plus the facing page) captured as ONE image. Bounding-boxing the whole
 * page as a single crop merges both pages — plus any stamps/watermarks —
 * into one region, which can dilute the actual passport text enough that
 * the OCR text detector fails to find it at all.
 *
 * This looks for the blank vertical "gutter" between two pages and splits
 * on it — but ONLY when there's strong evidence it's really a page gutter,
 * not just an ordinary internal gap (e.g. the margin between a photo box
 * and the start of the text fields, which a single normal bio page has
 * plenty of). Being too eager here is worse than not splitting at all: it
 * previously caused single good pages to get sliced in half right through
 * real content. So this requires:
 *   1. A wide, roughly-centered blank run (a real spine/gutter, not a
 *      narrow internal margin).
 *   2. Both resulting halves to independently contain a meaningful amount
 *      of actual content — if one side is nearly blank, it's not a second
 *      page, and we don't split.
 * If either check fails, the whole page is treated as a single block,
 * exactly like before.
 */
function splitPageIntoBlocks(canvas, {
  whiteThreshold = 245,
  rowStep = 4,
  minGutterFrac = 0.045,   // gutter must be at least ~4.5% of page width
  minGutterPx = 70,        // ...and at least this many px, whichever is larger
  centerZoneFrac = 0.18,   // gutter's midpoint must fall within this fraction of dead-center
  minSideInkFrac = 0.06    // each side must contain at least 6% of the page's total ink columns
} = {}) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const { data } = ctx.getImageData(0, 0, width, height);

  // For each column, is there any non-white pixel anywhere down its height?
  const hasInk = new Array(width).fill(false);
  let totalInkCols = 0;
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y += rowStep) {
      const i = (y * width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r < whiteThreshold || g < whiteThreshold || b < whiteThreshold) {
        hasInk[x] = true;
        totalInkCols++;
        break;
      }
    }
  }

  if (totalInkCols === 0) return [{ xStart: 0, xEnd: width }];

  const minGutterWidth = Math.max(minGutterPx, Math.round(width * minGutterFrac));
  const centerMin = width * (0.5 - centerZoneFrac);
  const centerMax = width * (0.5 + centerZoneFrac);

  let bestGutterStart = -1;
  let bestGutterEnd = -1;
  let bestGutterLen = 0;

  let runStart = -1;
  for (let x = 0; x <= width; x++) {
    const blank = x < width ? !hasInk[x] : false;
    if (blank && runStart === -1) {
      runStart = x;
    } else if (!blank && runStart !== -1) {
      const runLen = x - runStart;
      const runMid = runStart + runLen / 2;
      const isCentered = runMid >= centerMin && runMid <= centerMax;
      if (runLen >= minGutterWidth && isCentered && runLen > bestGutterLen) {
        bestGutterLen = runLen;
        bestGutterStart = runStart;
        bestGutterEnd = x;
      }
      runStart = -1;
    }
  }

  if (bestGutterStart === -1) {
    return [{ xStart: 0, xEnd: width }];
  }

  // Sanity check: both sides must independently carry a meaningful share
  // of the page's actual content. A stray gap next to a photo box or
  // between label columns will usually leave one side with hardly any ink
  // at all if we (wrongly) treat it as the split point — that's the signal
  // we use to reject a false-positive split.
  let leftInk = 0;
  for (let x = 0; x < bestGutterStart; x++) if (hasInk[x]) leftInk++;
  let rightInk = 0;
  for (let x = bestGutterEnd; x < width; x++) if (hasInk[x]) rightInk++;

  const minSideInk = totalInkCols * minSideInkFrac;
  if (leftInk < minSideInk || rightInk < minSideInk) {
    return [{ xStart: 0, xEnd: width }];
  }

  return [
    { xStart: 0, xEnd: bestGutterStart },
    { xStart: bestGutterEnd, xEnd: width }
  ];
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

    const blocks = splitPageIntoBlocks(canvas);
    for (const block of blocks) {
      const cropped = cropAndUpscale(canvas, block.xStart, block.xEnd);
      if (cropped) canvases.push(cropped);
    }
  }

  return canvases;
}