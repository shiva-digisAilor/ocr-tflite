import { Tensor } from "@litertjs/core";
import { getRecognizerModel } from "./modelLoader";
import {
  RECOGNIZER_INPUT_HEIGHT,
  RECOGNIZER_INPUT_MAX_WIDTH,
  REC_NORMALIZE_MEAN,
  REC_NORMALIZE_STD,
} from "./constants";
import { imageToCanvas, canvasToImageData } from "./imageUtils";

// Resizes a cropped text-line image to the recognizer's fixed height
// (keeping aspect ratio), then pads the width out to a fixed max —
// PaddleOCR-style recognizers expect a consistent input width.
function preprocessCrop(cropCanvas) {
  const aspectRatio = cropCanvas.width / cropCanvas.height;
  let targetWidth = Math.round(RECOGNIZER_INPUT_HEIGHT * aspectRatio);
  targetWidth = Math.min(targetWidth, RECOGNIZER_INPUT_MAX_WIDTH);

  const resizedCanvas = imageToCanvas(cropCanvas, targetWidth, RECOGNIZER_INPUT_HEIGHT);

  // Pad to the full max width with white so every batch has an
  // identical tensor shape, regardless of how wide the text line was.
  const paddedCanvas = document.createElement("canvas");
  paddedCanvas.width = RECOGNIZER_INPUT_MAX_WIDTH;
  paddedCanvas.height = RECOGNIZER_INPUT_HEIGHT;
  const ctx = paddedCanvas.getContext("2d");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, RECOGNIZER_INPUT_MAX_WIDTH, RECOGNIZER_INPUT_HEIGHT);
  ctx.drawImage(resizedCanvas, 0, 0);

  const { data } = canvasToImageData(paddedCanvas);
  const channelSize = RECOGNIZER_INPUT_MAX_WIDTH * RECOGNIZER_INPUT_HEIGHT;
  const floatData = new Float32Array(3 * channelSize);

  for (let pixel = 0; pixel < channelSize; pixel++) {
    const r = data[pixel * 4] / 255;
    const g = data[pixel * 4 + 1] / 255;
    const b = data[pixel * 4 + 2] / 255;
    // NCHW layout (matches the detector — same conversion pipeline
    // produced both models, so both expect channels-first), using the
    // recognizer's own 0.5/0.5 normalization, not the detector's
    // ImageNet stats.
    floatData[pixel] = (r - REC_NORMALIZE_MEAN[0]) / REC_NORMALIZE_STD[0];
    floatData[channelSize + pixel] = (g - REC_NORMALIZE_MEAN[1]) / REC_NORMALIZE_STD[1];
    floatData[2 * channelSize + pixel] = (b - REC_NORMALIZE_MEAN[2]) / REC_NORMALIZE_STD[2];
  }

  return new Tensor(floatData, [1, 3, RECOGNIZER_INPUT_HEIGHT, RECOGNIZER_INPUT_MAX_WIDTH]);
}

// Runs the recognizer on one cropped text-line image and returns the
// raw per-timestep class scores. CTC decoding into actual characters
// happens separately, in ctcDecoder.js.
export async function runTextRecognizer(cropCanvas) {
  const model = await getRecognizerModel();
  const inputTensor = preprocessCrop(cropCanvas);

  const results = await model.run(inputTensor);
  const outputData = await results[0].data();

  // Different LiteRT.js builds expose the output shape differently.
  // Try each plausible option in order rather than assuming one.
  let outputShape;

  if (typeof results[0].shape === "function") {
    outputShape = results[0].shape();
  } else if (results[0].shape) {
    outputShape = results[0].shape;
  } else if (typeof model.getOutputDetails === "function") {
    // Documented, model-level way to get shape info per output tensor.
    const outputDetails = model.getOutputDetails();
    outputShape = outputDetails?.[0]?.shape;
  }

  if (!outputShape) {
    // We've now tried every documented approach. Dump the raw object
    // so its real shape/keys are visible in the browser console —
    // that tells us definitively what this build actually returns.
    console.error("Could not determine output shape. Raw result tensor:", results[0]);
    console.error("Model output details:", model.getOutputDetails?.());
    throw new Error(
      "Recognizer output shape unavailable — check the browser console for the raw tensor object, and share what it logged."
    );
  }

  outputShape = Array.from(outputShape);

  inputTensor.delete();
  results.forEach((tensor) => tensor.delete());

  return { outputData, outputShape };
}