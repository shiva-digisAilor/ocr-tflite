/**
 * orientationCorrector.js
 * Save this into: src/services/orientationCorrector.js
 *
 * Fixes images that are rotated 0°, 90°, 180°, 270° (including upside-down),
 * and also nudges out small tilts (a few degrees off).
 *
 * Works by trying the image at each rotation, running it through your
 * existing OCR recognize() call on a small/fast version, and keeping
 * whichever rotation produced the most confident, most text.
 *
 * You don't need to change how your OCR model works — you just pass it
 * the function that already does OCR (currentService.recognize).
 */

// ---------- rotate a canvas/image by any angle, in degrees ----------
export function rotateCanvas(source, angleDeg, scale = 1) {
  const rad = (angleDeg * Math.PI) / 180;
  const srcW = source.width * scale;
  const srcH = source.height * scale;

  const swap = Math.abs(angleDeg % 180) === 90;
  const outW = swap ? srcH : srcW;
  const outH = swap ? srcW : srcH;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(outW);
  canvas.height = Math.round(outH);
  const ctx = canvas.getContext('2d');

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rad);
  ctx.drawImage(source, -srcW / 2, -srcH / 2, srcW, srcH);

  return canvas;
}

// ---------- DEBUG: cheap fingerprint to confirm probes are actually distinct ----------
// Sums a sparse sample of red-channel bytes. Doesn't need to be a "good"
// hash — it only needs to catch the specific failure mode we're chasing:
// multiple probe canvases that are supposed to be different rotations but
// come out with identical (or suspiciously similar) pixel content. If the
// checksums differ across angles, the bug is downstream in recognize()
// (caching/dedup). If they're identical, the bug is in this rotation step.
function quickPixelChecksum(canvas) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  if (width === 0 || height === 0) return 0;
  const { data } = ctx.getImageData(0, 0, width, height);
  let sum = 0;
  for (let i = 0; i < data.length; i += 4003) sum += data[i]; // sparse, prime-ish stride
  return sum;
}

// ---------- is this line MRZ-shaped? ----------
// Same heuristic mrzParser.findMrzLines uses to locate candidate lines:
// long, dense with '<' filler characters. Kept lightweight/duplicated here
// (rather than importing findMrzLines) so this module doesn't need to know
// anything about full MRZ parsing/check digits — it only needs to know
// "does this look like an MRZ line at all".
function isMrzShapedLine(raw) {
  const s = String(raw || '').toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9<]/g, '');
  return s.length >= 30 && s.length <= 48 && (s.match(/</g) || []).length >= 3;
}

// ---------- score an OCR result: how "good" is this reading? ----------
// We count actual letters found (not just any characters). Garbled/wrong-
// orientation text tends to come back as symbols, single stray characters,
// or near-empty strings — real readable text has lots of letters in it.
// This covers Latin script plus Devanagari and Tamil ranges since this app
// supports Hindi/Tamil too.
//
// IMPORTANT: this used to be pure letter-count over the whole page, which
// backfires on real-world scans/photos of passport spreads — a visa stamp,
// immigration mark, or facing page can sit upright and OCR-read just fine
// even while the actual bio-data/MRZ is still sideways. That upright noise
// can out-score the real (denser, smaller-font) MRZ text, so the "best"
// angle picked was sometimes the one where the passport data was still
// rotated. To fix this we heavily prioritize whichever angle actually
// contains an MRZ-shaped line — that's a much stronger, much more specific
// signal than "some letters were found somewhere on the page".
function scoreOcrResult(result) {
  if (!result) return 0;
  const text = (result.text || '').trim();
  if (!text) return 0;

  const letters = text.match(/[a-zA-Z\u0900-\u097F\u0B80-\u0BFF]/g);
  const letterScore = letters ? letters.length : 0;

  const lineTexts = (result.lines || []).map((l) => (typeof l === 'string' ? l : l.text));
  const mrzLineCount = lineTexts.filter(isMrzShapedLine).length;

  // A single MRZ-shaped line is worth far more than any amount of ordinary
  // text elsewhere on the page. Two MRZ-shaped lines (the normal TD3 case)
  // scores even higher, so the angle with a *complete* MRZ always wins
  // outright over an angle with only a partial/garbled one.
  return letterScore + mrzLineCount * 5000;
}

// ---------- try to read a tilt angle out of line boxes, if present ----------
function estimateSkewAngle(result) {
  const lines = result?.lines || [];
  const angles = [];

  for (const line of lines) {
    const pts = line.points || line.box || line.polygon;
    if (!pts || pts.length < 2) continue;
    const p1 = pts[0];
    const p2 = pts[1];
    if (
      typeof p1?.x !== 'number' ||
      typeof p2?.x !== 'number' ||
      typeof p1?.y !== 'number' ||
      typeof p2?.y !== 'number'
    ) {
      continue;
    }
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
    angles.push(angle);
  }

  if (angles.length === 0) return 0;
  angles.sort((a, b) => a - b);
  const mid = Math.floor(angles.length / 2);
  const median =
    angles.length % 2 !== 0 ? angles[mid] : (angles[mid - 1] + angles[mid]) / 2;

  // cap correction so we never "fix" something that isn't actually skewed
  return Math.max(-20, Math.min(20, median));
}

/**
 * Main function: figures out the right orientation and returns a
 * corrected canvas, ready for your real OCR pass.
 *
 * @param {HTMLCanvasElement} canvas - the raw uploaded image as a canvas
 * @param {Function} recognizeFn - your OCR call, e.g. (c) => currentService.recognize(c)
 * @returns {Promise<{ canvas: HTMLCanvasElement, bestAngle: number, probeResult: object }>}
 */
export async function correctOrientation(canvas, recognizeFn) {
  const candidateAngles = [0, 90, 180, 270];
  let bestAngle = 0;
  let bestScore = -1;
  let bestProbeResult = null;
  const debugScores = [];

  for (const angle of candidateAngles) {
    // NOTE: no downscaling here anymore. Passport MRZ text is small/dense —
    // shrinking it further made it unreadable at every angle equally,
    // which meant the comparison below could never tell angles apart.
    // This is slower but actually works. If it's too slow later, we can
    // optimize (e.g. crop to a smaller region) without breaking accuracy.
    const probe = rotateCanvas(canvas, angle, 1);
    const probeChecksum = quickPixelChecksum(probe); // DEBUG

    let result;
    try {
      result = await recognizeFn(probe);
    } catch (e) {
      console.error(`orientationCorrector: recognize failed at ${angle}°`, e);
      result = null;
    }

    const score = scoreOcrResult(result);
    debugScores.push({
      angle,
      score,
      probeWidth: probe.width,   // DEBUG
      probeHeight: probe.height, // DEBUG
      probeChecksum,             // DEBUG
      textFound: result?.text?.slice(0, 80)
    });

    if (score > bestScore) {
      bestScore = score;
      bestAngle = angle;
      bestProbeResult = result;
    }
  }

  // Log this so you can check devtools console if something still looks wrong —
  // you should see one angle with a clearly higher score than the other three.
  console.log('orientationCorrector: angle scores ' + JSON.stringify(debugScores, null, 2));
  console.log('orientationCorrector: chosen angle = ' + bestAngle);

  // rotate the FULL-resolution image to the winning angle
  let corrected = bestAngle === 0 ? canvas : rotateCanvas(canvas, bestAngle, 1);

  // small residual tilt correction, using box angles from the best probe (if available)
  const skew = estimateSkewAngle(bestProbeResult);
  if (Math.abs(skew) > 0.5) {
    corrected = rotateCanvas(corrected, -skew, 1);
  }

  return { canvas: corrected, bestAngle, probeResult: bestProbeResult };
}