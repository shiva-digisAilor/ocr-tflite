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

// Index in the recognizer's dictionary reserved for the CTC "blank" token.
export const CTC_BLANK_INDEX = 0;
