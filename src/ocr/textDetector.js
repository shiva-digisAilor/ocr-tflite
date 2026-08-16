import { getDetectorModel } from "./modelLoader";
import { preprocessToTensorLetterboxed } from "./preprocess";
import { DETECTOR_INPUT_SIZE } from "./constants";

// Runs the detection model on the full image and returns the raw
// probability map (one value per pixel — "how likely is this text?"),
// plus the scale/offset needed to map boxes back to the original
// image's coordinate space (accounting for letterbox padding).
export async function runTextDetector(sourceImage) {
  const model = await getDetectorModel();

  const { tensor: inputTensor, scale, offsetX, offsetY } = preprocessToTensorLetterboxed(
    sourceImage,
    DETECTOR_INPUT_SIZE
  );

  const results = await model.run(inputTensor);
  const probabilityMap = await results[0].data(); // Float32Array

  // LiteRT.js tensors live off-heap (GPU/Wasm memory) and must be
  // freed manually — they're not garbage collected like normal JS objects.
  inputTensor.delete();
  results.forEach((tensor) => tensor.delete());

  return {
    probabilityMap,
    mapWidth: DETECTOR_INPUT_SIZE,
    mapHeight: DETECTOR_INPUT_SIZE,
    scale,
    offsetX,
    offsetY,
  };
}