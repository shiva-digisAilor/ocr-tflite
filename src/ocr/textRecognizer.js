import { Tensor } from "@litertjs/core";
import { getRecognizerModel } from "./modelLoader";
import {
  RECOGNIZER_INPUT_HEIGHT,
  RECOGNIZER_INPUT_MAX_WIDTH,
  REC_NORMALIZE_MEAN,
  REC_NORMALIZE_STD,
  SWAP_RB_CHANNELS,
} from "./constants";
import { imageToCanvas, canvasToImageData } from "./imageUtils";

// Resizes a cropped text-line image to the recognizer's fixed height
// (keeping aspect ratio), then pads the width out to a fixed max —
// PaddleOCR-style recognizers expect a consistent input width.
//
// Padding is BLACK, not white: PaddleOCR's recognizers are trained
// with zero-value padding. Feeding white (a pixel pattern the model
// never saw in training) causes it to hallucinate garbage characters
// in the padded region instead of correctly staying silent there.
function preprocessCrop(cropCanvas) {
  const aspectRatio = cropCanvas.width / cropCanvas.height;
  let targetWidth = Math.round(RECOGNIZER_INPUT_HEIGHT * aspectRatio);
  targetWidth = Math.min(targetWidth, RECOGNIZER_INPUT_MAX_WIDTH);

  const resizedCanvas = imageToCanvas(cropCanvas, targetWidth, RECOGNIZER_INPUT_HEIGHT);

  const paddedCanvas = document.createElement("canvas");
  paddedCanvas.width = RECOGNIZER_INPUT_MAX_WIDTH;
  paddedCanvas.height = RECOGNIZER_INPUT_HEIGHT;
  const ctx = paddedCanvas.getContext("2d");
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, RECOGNIZER_INPUT_MAX_WIDTH, RECOGNIZER_INPUT_HEIGHT);
  ctx.drawImage(resizedCanvas, 0, 0);

  const { data } = canvasToImageData(paddedCanvas);
  const channelSize = RECOGNIZER_INPUT_MAX_WIDTH * RECOGNIZER_INPUT_HEIGHT;
  const floatData = new Float32Array(3 * channelSize);

  for (let pixel = 0; pixel < channelSize; pixel++) {
    let r = data[pixel * 4] / 255;
    let g = data[pixel * 4 + 1] / 255;
    let b = data[pixel * 4 + 2] / 255;
    if (SWAP_RB_CHANNELS) {
      [r, b] = [b, r];
    }
    floatData[pixel] = (r - REC_NORMALIZE_MEAN[0]) / REC_NORMALIZE_STD[0];
    floatData[channelSize + pixel] = (g - REC_NORMALIZE_MEAN[1]) / REC_NORMALIZE_STD[1];
    floatData[2 * channelSize + pixel] = (b - REC_NORMALIZE_MEAN[2]) / REC_NORMALIZE_STD[2];
  }

  return {
    tensor: new Tensor(floatData, [1, 3, RECOGNIZER_INPUT_HEIGHT, RECOGNIZER_INPUT_MAX_WIDTH]),
    // Fraction of the padded canvas that is REAL content vs padding —
    // used below to ignore whatever the model outputs for the padded
    // portion. A second layer of protection beyond the color fix above.
    contentRatio: targetWidth / RECOGNIZER_INPUT_MAX_WIDTH,
  };
}

// Runs the recognizer on one cropped text-line image and returns the
// raw per-timestep class scores, TRUNCATED to only the timesteps that
// correspond to real (non-padded) content. CTC decoding into actual
// characters happens separately, in ctcDecoder.js.
export async function runTextRecognizer(cropCanvas) {
  const model = await getRecognizerModel();
  const { tensor: inputTensor, contentRatio } = preprocessCrop(cropCanvas);

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
    const outputDetails = model.getOutputDetails();
    outputShape = outputDetails?.[0]?.shape;
  }

  if (!outputShape) {
    console.error("Could not determine output shape. Raw result tensor:", results[0]);
    console.error("Model output details:", model.getOutputDetails?.());
    throw new Error(
      "Recognizer output shape unavailable — check the browser console for the raw tensor object, and share what it logged."
    );
  }

  outputShape = Array.from(outputShape);

  inputTensor.delete();
  results.forEach((tensor) => tensor.delete());

  return { outputData, outputShape, contentRatio };
}