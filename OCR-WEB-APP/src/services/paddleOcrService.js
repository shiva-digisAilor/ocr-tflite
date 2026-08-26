import { PaddleOcrService, V5_TAMIL_MOBILE_MODEL, V5_DEVANAGARI_MOBILE_MODEL, V6_SMALL_MODEL } from "ppu-paddle-ocr/web";
import { extractPassportFields } from "./passportParser";
import { ingestPassportFile } from "./passportingest"; // NOTE: matches the actual filename/casing — see bottom note

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
 * Adapts extractPassportFields (which expects the
 * {text_extracted, location, raw, rotationApplied} shape) into the plain
 * (canvas) => fields signature that passportIngest.js's parseFieldsFn
 * expects, and normalizes the MRZ flag onto `fields.mrzVerified` so
 * passportIngest's block-merge logic (which prefers MRZ-verified blocks)
 * actually has something to read.
 */
function makeParseFieldsFn(lang) {
  return (ocrResult) => {
    const shaped = {
      text_extracted: ocrResult?.text || "",
      location: ocrResult?.lines || [],
      raw: ocrResult,
      rotationApplied: 0, // passportIngest already corrected orientation upstream
    };
    const fields = extractPassportFields(shaped, lang);
    return {
      ...fields,
      mrzVerified: Boolean(fields?._meta?.mrzValid || fields?._meta?.mrzDetected),
    };
  };
}

/**
 * Single entry point for both PDFs and images. All orientation-fixing,
 * page-splitting, and cross-block field merging now happens inside
 * ingestPassportFile — this function just wires the currently-loaded OCR
 * model into it.
 */
export async function runOcrOnFile(file, lang = "cjk") {
  await initOcr(lang);

  const result = await ingestPassportFile(file, {
    recognizeFn: (canvas) => currentService.recognize(canvas),
    parseFieldsFn: makeParseFieldsFn(lang),
  });

  return {
    name: file.name,
    fields: result.fields,
    mrzVerified: result.mrzVerified,
    // per-block breakdown, handy if the UI wants to show "page 1 / page 2"
    // style detail instead of just the merged result
    blocks: result.blocks.map((b) => ({
      page: b.pageIndex + 1,
      block: b.blockIndex + 1,
      text_extracted: b.ocrResult?.text || "",
      fields: b.fields,
    })),
  };
}

export async function destroyOcr() {
  if (currentService) {
    await currentService.destroy();
    currentService = null;
  }
}