import { getDetectorModel } from "./modelLoader";
import { preprocessToTensor } from "./preprocess";
import { DETECTOR_INPUT_SIZE } from "./constants";

// Runs the detection model on the full image and returns the raw
// probability map (one value per pixel — "how likely is this text?"),
// plus the scale factors needed to map boxes back to the original
// image's coordinate space.
export async function runTextDetector(sourceImage) {
  const model = await getDetectorModel();

  const originalWidth = sourceImage.width;
  const originalHeight = sourceImage.height;

  const inputTensor = preprocessToTensor(
    sourceImage,
    DETECTOR_INPUT_SIZE,
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
    scaleX: originalWidth / DETECTOR_INPUT_SIZE,
    scaleY: originalHeight / DETECTOR_INPUT_SIZE,
  };
}
