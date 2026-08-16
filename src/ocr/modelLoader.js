import { loadLiteRt, loadAndCompile } from "@litertjs/core";
import { MODEL_PATHS } from "./constants";

// Module-level cache so each model and the dictionary only ever get
// loaded/compiled once, no matter how many times runOcr() is called.
let detectorModel = null;
let recognizerModel = null;
let dictionary = null;
let liteRtInitialized = false;

async function ensureLiteRtInitialized() {
  if (liteRtInitialized) return;
  // Loading the runtime's Wasm files from a CDN avoids needing to copy
  // anything out of node_modules into your public/ folder manually.
  await loadLiteRt("https://cdn.jsdelivr.net/npm/@litertjs/core/wasm/");
  liteRtInitialized = true;
}

export async function getDetectorModel() {
  await ensureLiteRtInitialized();
  if (!detectorModel) {
    detectorModel = await loadAndCompile(MODEL_PATHS.detector, {
      accelerator: "wasm", // once this works end-to-end, try "webgpu" for speed
    });
    // Useful the first time you run this: confirms the model's real
    // input/output shapes so you can double check constants.js.
    console.log("Detector model loaded:", detectorModel);
  }
  return detectorModel;
}

export async function getRecognizerModel() {
  await ensureLiteRtInitialized();
  if (!recognizerModel) {
    recognizerModel = await loadAndCompile(MODEL_PATHS.recognizer, {
      accelerator: "wasm",
    });
    console.log("Recognizer model loaded:", recognizerModel);
  }
  return recognizerModel;
}

export async function getDictionary() {
  if (!dictionary) {
    const response = await fetch(MODEL_PATHS.dictionary);
    const text = await response.text();
    const characters = text.split("\n").filter((line) => line.length > 0);

    // PaddleOCR's convention: index 0 = CTC blank, indices 1..N = the
    // characters listed in the dict file, and index N+1 = space —
    // added programmatically, NOT listed as a line in the dict file
    // itself. Confirmed by checking ppocrv5_dict.txt directly: it
    // contains no space entry, yet the model still predicts word
    // spacing as its own class. Skipping this line is why every word
    // ran together with no spaces.
    dictionary = ["", ...characters, " "];
  }
  return dictionary;
}