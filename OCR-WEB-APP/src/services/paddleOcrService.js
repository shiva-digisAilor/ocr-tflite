import { PaddleOcrService, V5_TAMIL_MOBILE_MODEL, V5_DEVANAGARI_MOBILE_MODEL, V6_SMALL_MODEL } from "ppu-paddle-ocr/web";
import * as ort from "onnxruntime-web";
import { extractPassportFields } from "./passportParser";
import { ingestPassportFile } from "./passportingest";

// IMPORTANT: files under /public are explicitly off-limits to Vite for
// dynamic `import()` — onnxruntime-web's loader (jsep.mjs) is loaded that
// way regardless of which execution provider you pick, so a /public copy
// can never work here. The correct pattern for bundlers is to import each
// WASM asset with the `?url` suffix straight from node_modules — Vite
// then processes it as a proper asset (works in dev AND production build,
// no manual copy step needed) instead of a bare static file.
// Correct exported subpaths confirmed from node_modules/onnxruntime-web/
// package.json's own "exports" map — no "/dist/" prefix, unlike my two
// earlier (wrong) attempts.
import ortWasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.wasm?url";
import ortWasmJsepWasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm?url";
import ortWasmJsepMjsUrl from "onnxruntime-web/ort-wasm-simd-threaded.jsep.mjs?url";

ort.env.wasm.wasmPaths = {
  "ort-wasm-simd-threaded.wasm": ortWasmUrl,
  "ort-wasm-simd-threaded.jsep.wasm": ortWasmJsepWasmUrl,
  "ort-wasm-simd-threaded.jsep.mjs": ortWasmJsepMjsUrl,
};
ort.env.wasm.numThreads = 1;

let currentService = null;

export async function initOcr(lang = "cjk") {
  if (currentService) {
    await currentService.destroy();
    currentService = null;
  }

  // detection is language-agnostic (just finds text regions), safe to
  // share across all languages — recognition + dictionary are NOT and
  // must be swapped per language, which the previous version got wrong.
  const sharedDetection = "/models/paddle/PP-OCRv6_small_det.ort";

  let model;
  let recognitionPath;
  let dictionaryPath;

  if (lang === "tamil") {
    model = V5_TAMIL_MOBILE_MODEL;
    recognitionPath = "/models/paddle/ta_PP-OCRv5_mobile_rec_infer.onnx";
    dictionaryPath = "/models/paddle/ppocrv5_ta_dict.txt";
  } else if (lang === "hindi") {
    model = V5_DEVANAGARI_MOBILE_MODEL;
    recognitionPath = "/models/paddle/devanagari_PP-OCRv5_mobile_rec_infer.onnx";
    dictionaryPath = "/models/paddle/ppocrv5_devanagari_dict.txt";
  } else {
    model = V6_SMALL_MODEL;
    recognitionPath = "/models/paddle/PP-OCRv6_small_rec.ort";
    dictionaryPath = "/models/paddle/ppocrv6_dict.txt";
  }

  currentService = new PaddleOcrService({
    session: {
      executionProviders: ["wasm"], // forces plain WASM, skipping WebGPU
                                     // entirely — WebGPU's execution
                                     // provider (jsep.mjs) is the file
                                     // that was getting dynamically
                                     // import()'d, which Vite's dev
                                     // server refuses for anything in
                                     // /public. Plain WASM only needs the
                                     // .wasm binaries you already copied,
                                     // no dynamic import involved.
    },
    model: {
      ...model,
      detection: sharedDetection,
      recognition: recognitionPath,
      charactersDictionary: dictionaryPath, // was wrongly named "dictionary" —
                                             // confirmed via ModelUrls type:
                                             // { detection, recognition, charactersDictionary }
    },
  });
  await currentService.initialize();
  return currentService;
}

// NOTE: confirmed via node_modules/ppu-paddle-ocr/interface.d.ts —
// RecognizeOptions only supports { flatten, strategy }. There is no
// per-call dictionary override; the dictionary is set once, at
// construction time, via model.charactersDictionary (see initOcr above).
// So plain currentService.recognize(canvas) is correct — no wrapper needed.

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