/**
 * passportIngest.js
 * Save this into: src/services/passportIngest.js
 *
 * THE FIX, explained (third and hopefully final revision):
 *
 * There are two different scan layouts to support, and each one wants a
 * DIFFERENT processing order:
 *
 *   A) A simple 2-page spread (bio page + facing page, side by side, one
 *      photo). Best handled by: orient the WHOLE page first (reliable,
 *      since there's one coherent block of readable text to score), THEN
 *      split it into left/right halves now that it's known to be upright.
 *
 *   B) A dense 4-up grid (bio page + stamp page + address page + blank
 *      page, all combined into one image). Orienting the whole page first
 *      fails here — OCR can return literally nothing at every angle
 *      because the combined image is too visually dense/noisy for the
 *      text detector to lock onto anything. This layout needs the
 *      opposite order: split FIRST (geometrically, rotation-agnostic,
 *      using both-axis gutter detection so it can't mislabel the gutter
 *      regardless of rotation), THEN orient each smaller block on its own.
 *
 * Forcing every file through only one order breaks the other layout. So
 * this file tries strategy A first (cheap — one whole-page OCR probe up
 * front), and only falls back to strategy B for a given page if strategy
 * A's orientation probe found literally nothing (bestScore <= 0) — the
 * specific signature of "this page is too dense as one block," not "this
 * page happens to be blank."
 */

import { fileToRawCanvases } from './pdfToCanvases.js';
import { cropAndUpscale, splitPageIntoGrid } from './cropsplit.js';
import { correctOrientation } from './Orientationcorrector.js';

async function ocrAndParseBlock({ canvas, pageIndex, blockIndex, recognizeFn, parseFieldsFn, debug }) {
  let ocrResult;
  try {
    ocrResult = await recognizeFn(canvas);
  } catch (e) {
    console.error(`passportIngest: OCR failed on page ${pageIndex} block ${blockIndex}`, e);
    ocrResult = null;
  }

  const fields = ocrResult ? parseFieldsFn(ocrResult) : null;
  if (debug) console.log(`passportIngest: page ${pageIndex} block ${blockIndex} fields`, fields);

  return {
    pageIndex,
    blockIndex,
    canvas,
    ocrResult,
    fields,
    mrzVerified: Boolean(fields?.mrzVerified),
  };
}

/**
 * @param {File} file - a PDF or image file containing one or more
 *   passport pages/spreads
 * @param {Object} deps
 * @param {Function} deps.recognizeFn - (canvas) => Promise<{text, lines}>
 *   your existing OCR call, e.g. (c) => currentService.recognize(c)
 * @param {Function} deps.parseFieldsFn - (ocrResult) => structuredFields,
 *   must set `.mrzVerified` (boolean) on the returned object
 * @param {Object} [options]
 * @param {boolean} [options.debug=false] - log per-page/per-block diagnostics
 * @returns {Promise<{
 *   fields: Object,          // merged structured fields, best guess
 *   mrzVerified: boolean,    // true if any block's MRZ checked out
 *   blocks: Array,           // raw per-block results, for debugging/UI
 * }>}
 */
export async function ingestPassportFile(file, { recognizeFn, parseFieldsFn }, { debug = false } = {}) {
  if (typeof recognizeFn !== 'function') throw new Error('ingestPassportFile: recognizeFn is required');
  if (typeof parseFieldsFn !== 'function') throw new Error('ingestPassportFile: parseFieldsFn is required');

  const rawPageCanvases = await fileToRawCanvases(file);
  if (rawPageCanvases.length === 0) {
    throw new Error('Could not read any pages/images from this file — it may be empty or corrupted.');
  }

  const allBlockResults = [];

  for (let pageIndex = 0; pageIndex < rawPageCanvases.length; pageIndex++) {
    const rawCanvas = rawPageCanvases[pageIndex];

    // --- Strategy A: orient the whole page first ---
    const { canvas: uprightWholePage, bestAngle, bestScore } = await correctOrientation(rawCanvas, recognizeFn);
    if (debug) console.log(`passportIngest: page ${pageIndex} whole-page probe — angle=${bestAngle}, score=${bestScore}`);

    if (bestScore > 0) {
      // Strategy A worked: this page reads fine as one coherent block.
      // Now it's safe to split, since we know it's upright.
      const blocks = splitPageIntoGrid(uprightWholePage);
      if (debug) console.log(`passportIngest: page ${pageIndex} (strategy A) split into ${blocks.length} block(s)`);

      for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
        const { xStart, xEnd, yStart, yEnd } = blocks[blockIndex];
        const cropped = cropAndUpscale(uprightWholePage, xStart, xEnd, { yStart, yEnd });
        if (!cropped) continue;
        allBlockResults.push(await ocrAndParseBlock({
          canvas: cropped, pageIndex, blockIndex, recognizeFn, parseFieldsFn, debug,
        }));
      }
      continue;
    }

    // --- Strategy B fallback: whole-page probe found nothing at all.
    // Split the RAW page geometrically first, then orient each smaller
    // block on its own — this is what a dense 4-up grid scan needs.
    if (debug) console.log(`passportIngest: page ${pageIndex} whole-page probe found nothing — falling back to split-first`);

    const geometricBlocks = splitPageIntoGrid(rawCanvas);
    if (debug) console.log(`passportIngest: page ${pageIndex} (strategy B) split into ${geometricBlocks.length} block(s)`);

    for (let blockIndex = 0; blockIndex < geometricBlocks.length; blockIndex++) {
      const { xStart, xEnd, yStart, yEnd } = geometricBlocks[blockIndex];
      const rawBlockCanvas = cropAndUpscale(rawCanvas, xStart, xEnd, { yStart, yEnd });
      if (!rawBlockCanvas) continue;

      const { canvas: uprightBlock, bestAngle: blockAngle } = await correctOrientation(rawBlockCanvas, recognizeFn);
      if (debug) console.log(`passportIngest: page ${pageIndex} block ${blockIndex} corrected by ${blockAngle}°`);

      allBlockResults.push(await ocrAndParseBlock({
        canvas: uprightBlock, pageIndex, blockIndex, recognizeFn, parseFieldsFn, debug,
      }));
    }
  }

  if (allBlockResults.length === 0) {
    throw new Error(
      'No readable content found in this file after orientation correction and splitting. ' +
      'The scan may be too low-resolution, too dark, or too heavily cropped for the MRZ/text to be legible.'
    );
  }

  // Merge: prefer fields from whichever block(s) had a verified MRZ (the
  // authoritative, checksum-validated source), then fill any remaining
  // gaps from other blocks (address, father/mother/spouse names, file
  // number, etc. usually live on a different page/block and never appear
  // in the MRZ at all).
  const mrzBlocks = allBlockResults.filter((b) => b.mrzVerified);
  const otherBlocks = allBlockResults.filter((b) => !b.mrzVerified);
  const orderedForMerge = [...mrzBlocks, ...otherBlocks];

  const merged = {};
  for (const block of orderedForMerge) {
    if (!block.fields) continue;
    for (const [key, value] of Object.entries(block.fields)) {
      const isEmpty = value === null || value === undefined || value === '';
      const alreadyFilled = merged[key] !== undefined && merged[key] !== null && merged[key] !== '';
      if (!isEmpty && !alreadyFilled) {
        merged[key] = value;
      }
    }
  }

  return {
    fields: merged,
    mrzVerified: mrzBlocks.length > 0,
    blocks: allBlockResults,
  };
}