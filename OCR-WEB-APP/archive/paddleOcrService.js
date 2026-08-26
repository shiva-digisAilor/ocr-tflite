import { correctOrientation } from './Orientationcorrector';
import { pdfFileToCanvases } from './pdfToCanvases';
import { 
  PaddleOcrService, 
  V5_TAMIL_MOBILE_MODEL, 
  V5_DEVANAGARI_MOBILE_MODEL,
  V6_SMALL_MODEL 
} from "ppu-paddle-ocr/web";
import { extractPassportFields } from "./passportParser";

let currentService = null;

export async function initOcr(lang = "cjk") {
  if (currentService) {
    await currentService.destroy();
    currentService = null;
  }

  let model;
  if (lang === "tamil") {
    model = V5_TAMIL_MOBILE_MODEL;
  } else if (lang === "hindi") {
    model = V5_DEVANAGARI_MOBILE_MODEL;
  } else {
    model = V6_SMALL_MODEL;
  }

  currentService = new PaddleOcrService({ model });
  await currentService.initialize();
  return currentService;
}

/**
 * Convert File → HTMLCanvasElement (safest way)
 */
async function fileToCanvas(file) {
  const img = new Image();
  img.src = URL.createObjectURL(file);

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  URL.revokeObjectURL(img.src);
  return canvas;
}

function isPdfFile(file) {
  return file.type === "application/pdf" || file.name?.toLowerCase().endsWith(".pdf");
}

/**
 * Runs the full pipeline (orientation fix -> OCR -> field extraction) on a
 * single canvas. This is the same logic that used to live directly inside
 * runOcrOnFile — pulled out so both the single-image path and the
 * multi-page PDF path can share it.
 */
async function runOcrOnCanvas(rawCanvas, lang) {
  const { canvas, bestAngle } = await correctOrientation(
    rawCanvas,
    (c) => currentService.recognize(c)
  );

  if (bestAngle !== 0) {
    console.log(`Image was rotated ${bestAngle}° — corrected before OCR.`);
  }

  const result = await currentService.recognize(canvas);

  const ocrResult = {
    text_extracted: result.text || "",
    location: result.lines || [],
    raw: result,
    rotationApplied: bestAngle
  };

  ocrResult.fields = extractPassportFields(ocrResult, lang);
  return ocrResult;
}

/**
 * Combines the extracted fields from multiple pages into one object.
 * For each field, the first page that actually found a value wins — so a
 * 2-page passport PDF (front page with MRZ, back page with address/family
 * details) ends up as a single complete record instead of two partial ones.
 */
function mergeFieldsAcrossPages(fieldsList) {
  const valid = fieldsList.filter(Boolean);
  if (valid.length === 0) return null;

  const keys = new Set();
  valid.forEach((f) => Object.keys(f).forEach((k) => { if (k !== "_meta") keys.add(k); }));

  const merged = {};
  for (const key of keys) {
    merged[key] = null;
    for (const f of valid) {
      const value = f[key];
      if (value !== null && value !== undefined && value !== "") {
        merged[key] = value;
        break;
      }
    }
  }

  merged._meta = {
    mrzDetected: valid.some((f) => f._meta?.mrzDetected),
    mrzValid: valid.some((f) => f._meta?.mrzValid),
    perPage: valid.map((f) => f._meta || null)
  };

  return merged;
}

async function runOcrOnPdf(file, lang) {
  const canvases = await pdfFileToCanvases(file);

  const pages = [];
  for (let i = 0; i < canvases.length; i++) {
    const pageResult = await runOcrOnCanvas(canvases[i], lang);
    pageResult.page = i + 1;
    pages.push(pageResult);
  }

  return {
    name: file.name,
    isPdf: true,
    pageCount: pages.length,
    pages, // each page's own text/fields, in case you want to show them individually
    text_extracted: pages.map((p) => p.text_extracted).join("\n\n--- next page ---\n\n"),
    fields: mergeFieldsAcrossPages(pages.map((p) => p.fields))
  };
}

export async function runOcrOnFile(file, lang = "cjk") {
  await initOcr(lang);

  if (isPdfFile(file)) {
    return runOcrOnPdf(file, lang);
  }

  const rawCanvas = await fileToCanvas(file);
  const ocrResult = await runOcrOnCanvas(rawCanvas, lang);
  ocrResult.name = file.name;
  return ocrResult;
}

export async function destroyOcr() {
  if (currentService) {
    await currentService.destroy();
    currentService = null;
  }
}