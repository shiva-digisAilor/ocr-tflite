/**
 * cropSplit.js
 * Save this into: src/services/cropSplit.js
 *
 * Pulled out of the old pdfToCanvases.js unchanged (same algorithm, same
 * thresholds) — the fix wasn't to this logic, it was to WHEN it runs.
 * See passportIngest.js for the call order that now guarantees the canvas
 * passed in here is already upright.
 */

/**
 * Crop a canvas down to just its non-white content (within the given x
 * range) and upscale it so the text is sharp enough for OCR, regardless of
 * how much blank margin the original had.
 */
export function cropAndUpscale(canvas, xStart, xEnd, { targetWidth = 1600, whiteThreshold = 245, padding = 12, step = 2, yStart = 0, yEnd = null } = {}) {
  const ctx = canvas.getContext('2d');
  const height = yEnd == null ? canvas.height : yEnd;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  let minX = xEnd, minY = height, maxX = xStart, maxY = yStart;

  for (let y = yStart; y < height; y += step) {
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
 * Scanned passport pages are sometimes a two-page spread (the bio-data
 * page plus the facing page) captured as ONE image. Bounding-boxing the
 * whole page as a single crop merges both pages — plus any stamps/
 * watermarks — into one region, which can dilute the actual passport text
 * enough that the OCR text detector fails to find it at all.
 *
 * This looks for the blank vertical "gutter" between two pages and splits
 * on it — but ONLY when there's strong evidence it's really a page
 * gutter, not just an ordinary internal gap (e.g. the margin between a
 * photo box and the start of the text fields, which a single normal bio
 * page has plenty of).
 *
 * IMPORTANT PRECONDITION: this function assumes `canvas` is already
 * right-side-up. It has no way to tell "sideways" from "upright" itself —
 * it just looks for a blank vertical run, which is only meaningful once
 * the real page spine is guaranteed to be running vertically. Call this
 * AFTER orientation correction, never before. (This used to run before,
 * which is what broke two-page-spread scans that started out rotated.)
 */
export function splitPageIntoBlocks(canvas, {
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
 * Same idea as splitPageIntoBlocks, but for a horizontal (row) gutter
 * instead of a vertical (column) one — needed for scans like a 4-up grid
 * (bio page / stamp page on top, address page / blank page on bottom, all
 * captured as one image). Mirrors the x-axis logic exactly, just on y.
 */
function splitRegionHorizontally(canvas, xStart, xEnd, {
  whiteThreshold = 245,
  colStep = 4,
  minGutterFrac = 0.045,
  minGutterPx = 70,
  centerZoneFrac = 0.18,
  minSideInkFrac = 0.06
} = {}) {
  const ctx = canvas.getContext('2d');
  const { height } = canvas;
  const regionWidth = xEnd - xStart;
  const { data } = ctx.getImageData(xStart, 0, regionWidth, height);

  const hasInk = new Array(height).fill(false);
  let totalInkRows = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < regionWidth; x += colStep) {
      const i = (y * regionWidth + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r < whiteThreshold || g < whiteThreshold || b < whiteThreshold) {
        hasInk[y] = true;
        totalInkRows++;
        break;
      }
    }
  }

  if (totalInkRows === 0) return [{ yStart: 0, yEnd: height }];

  const minGutterHeight = Math.max(minGutterPx, Math.round(height * minGutterFrac));
  const centerMin = height * (0.5 - centerZoneFrac);
  const centerMax = height * (0.5 + centerZoneFrac);

  let bestStart = -1, bestEnd = -1, bestLen = 0;
  let runStart = -1;
  for (let y = 0; y <= height; y++) {
    const blank = y < height ? !hasInk[y] : false;
    if (blank && runStart === -1) {
      runStart = y;
    } else if (!blank && runStart !== -1) {
      const runLen = y - runStart;
      const runMid = runStart + runLen / 2;
      const isCentered = runMid >= centerMin && runMid <= centerMax;
      if (runLen >= minGutterHeight && isCentered && runLen > bestLen) {
        bestLen = runLen;
        bestStart = runStart;
        bestEnd = y;
      }
      runStart = -1;
    }
  }

  if (bestStart === -1) return [{ yStart: 0, yEnd: height }];

  let topInk = 0;
  for (let y = 0; y < bestStart; y++) if (hasInk[y]) topInk++;
  let bottomInk = 0;
  for (let y = bestEnd; y < height; y++) if (hasInk[y]) bottomInk++;

  const minSideInk = totalInkRows * minSideInkFrac;
  if (topInk < minSideInk || bottomInk < minSideInk) return [{ yStart: 0, yEnd: height }];

  return [
    { yStart: 0, yEnd: bestStart },
    { yStart: bestEnd, yEnd: height }
  ];
}

/**
 * Grid-aware version of splitPageIntoBlocks. Handles the common passport-
 * scan layouts:
 *   - 1 page (no gutters found)          -> 1 block
 *   - 2 pages side by side                -> 2 blocks (left/right)
 *   - 4 pages as a 2x2 grid (bio + stamp
 *     page on top, address + blank on
 *     bottom, all in one image)           -> up to 4 blocks
 *
 * Same precondition as splitPageIntoBlocks: only call this on an already
 * upright canvas.
 */
export function splitPageIntoGrid(canvas, options = {}) {
  const columns = splitPageIntoBlocks(canvas, options);

  const blocks = [];
  for (const col of columns) {
    const rows = splitRegionHorizontally(canvas, col.xStart, col.xEnd, options);
    for (const row of rows) {
      blocks.push({ xStart: col.xStart, xEnd: col.xEnd, yStart: row.yStart, yEnd: row.yEnd });
    }
  }
  return blocks;
}