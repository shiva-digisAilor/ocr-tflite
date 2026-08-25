import { correctOrientation } from './Orientationcorrector';
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

export async function runOcrOnFile(file, lang = "cjk") {
  await initOcr(lang);

  // Convert File to Canvas first (this fixes the error)
  const rawCanvas = await fileToCanvas(file);

  // Figure out if the image is rotated 90/180/270 (or upside-down) and fix it.
  // This tries the image at each angle using the OCR engine itself, and keeps
  // whichever orientation reads the most confident text.
  const { canvas, bestAngle } = await correctOrientation(
    rawCanvas,
    (c) => currentService.recognize(c)
  );

  if (bestAngle !== 0) {
    console.log(`Image was rotated ${bestAngle}° — corrected before OCR.`);
  }

  // Now run the real, full-quality OCR pass on the corrected image
  const result = await currentService.recognize(canvas);

  const ocrResult = {
    name: file.name,
    text_extracted: result.text || "",
    location: result.lines || [],
    raw: result,
    rotationApplied: bestAngle
  };

  // Parse the raw OCR output into structured passport fields
  // (name, dateOfBirth, nationality, passportNumber, address, ...).
  // Runs entirely client-side, no extra model/network call.
  ocrResult.fields = extractPassportFields(ocrResult, lang);

  return ocrResult;
}

export async function destroyOcr() {
  if (currentService) {
    await currentService.destroy();
    currentService = null;
  }
}