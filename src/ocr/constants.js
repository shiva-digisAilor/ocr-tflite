// Central place for model paths, input sizes, and normalization values.
// If your model's actual input shape differs from what's here, update
// the numbers in this one file — nothing else in the pipeline should
// need to change.

export const MODEL_PATHS = {
  detector: "/models/ppocr_det_fp16.tflite",
  recognizer: "/models/ppocr_rec_fp16.tflite",
  dictionary: "/models/ppocrv5_dict.txt",
};

// Detector input: confirmed against PP-OCRv5's published preprocessing
// spec — 640x640, not the earlier 960 placeholder.
export const DETECTOR_INPUT_SIZE = 640;

// Recognizer input: PP-OCRv5 recognizer models use a fixed height and
// a variable/padded width. 48 is the standard PaddleOCR recognizer height.
export const RECOGNIZER_INPUT_HEIGHT = 48;
export const RECOGNIZER_INPUT_MAX_WIDTH = 320;

// Detector normalization (ImageNet-style — this is what PP-OCRv5's
// detector was trained with).
export const NORMALIZE_MEAN = [0.485, 0.456, 0.406];
export const NORMALIZE_STD = [0.229, 0.224, 0.225];

// Recognizer normalization is DIFFERENT from the detector's — PP-OCRv5's
// recognizer uses a simple 0.5/0.5 scheme, not ImageNet stats. Using the
// wrong one here silently produces garbage recognition results even if
// detection works fine.
export const REC_NORMALIZE_MEAN = [0.5, 0.5, 0.5];
export const REC_NORMALIZE_STD = [0.5, 0.5, 0.5];

// Probability threshold for turning the detector's heatmap into a
// binary "is this pixel text?" mask. Lower = more (noisier) boxes,
// higher = fewer (stricter) boxes.
export const DETECTION_BINARY_THRESHOLD = 0.3;

// Minimum box size (in detector-map pixels) to keep — filters out
// tiny noise regions in the probability map.
export const MIN_BOX_SIZE = 4;

// How much to expand each detected box outward to recover the real
// text size (DB-style detectors predict a deliberately shrunk region —
// see the note in postprocessDetector.js).
//
// IMPORTANT: X and Y are separate on purpose, and both are scaled off
// the box's HEIGHT (a proxy for font size) rather than its own width —
// a box's width varies hugely (one word vs five), so padding relative
// to width either over- or under-pads depending on how much text was
// in that particular box. Height is a much more stable reference.
//
// X can be generous — it only risks merging with the NEXT/PREVIOUS
// WORD on the same line, which joinRegionsByLine() in runOcr.js
// already handles gracefully via spacing.
// Y must stay tight — with normal line spacing, over-expanding
// vertically pulls in pixels from the line ABOVE/BELOW, which
// confuses the recognizer from the very first character (this was
// the "cam cYta nis" instead of "in this" bug).
export const UNCLIP_PAD_X_RATIO = 0.9; // each side gets +90% of box height
export const UNCLIP_PAD_Y_RATIO = 0.12; // each side gets +12% of box height, unchanged — this is working correctly (lines are now separating cleanly)

// Extra timesteps to trim off the end of the recognizer's output,
// beyond the real-content/padding boundary. Even with black padding
// matching training and a hard content-ratio cutoff, the model's
// convolutional receptive field blends a few real pixels with a few
// padding pixels right at that boundary, producing a couple of
// straggling garbage characters at the end of some lines. Trimming a
// small fixed margin removes that residue — kept small (1, not 2)
// because short-word crops have very few usable timesteps to begin
// with, and over-trimming was cutting into real characters.
export const CTC_BOUNDARY_SAFETY_TIMESTEPS = 1;

// Index in the recognizer's dictionary reserved for the CTC "blank" token.
export const CTC_BLANK_INDEX = 0;

// TEST TOGGLE: try both true and false. PaddleOCR's original training
// pipeline (OpenCV-based) reads images as BGR, not RGB. If the .tflite
// conversion preserved that assumption, a browser canvas (always RGB)
// would silently feed every pixel's red and blue channels swapped —
// which could plausibly explain structured (non-random) garbage output.
export const SWAP_RB_CHANNELS = false;