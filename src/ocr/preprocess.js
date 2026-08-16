import { Tensor } from "@litertjs/core";
import { NORMALIZE_MEAN, NORMALIZE_STD, SWAP_RB_CHANNELS } from "./constants";
import { canvasToImageData } from "./imageUtils";

// Converts an image into a normalized [1, 3, size, size] Float32 tensor,
// using LETTERBOXING: the image is scaled down to fit inside size×size
// while keeping its original aspect ratio, then centered on a padded
// canvas — instead of stretching it to fill a square, which distorts
// non-square photos and confuses the detector (it wasn't trained on
// squished images).
//
// Returns the scale and offsets used, so detected box coordinates can
// be mapped back to the ORIGINAL image correctly afterward.
export function preprocessToTensorLetterboxed(source, size) {
  const originalWidth = source.width;
  const originalHeight = source.height;

  const scale = Math.min(size / originalWidth, size / originalHeight);
  const scaledWidth = Math.round(originalWidth * scale);
  const scaledHeight = Math.round(originalHeight * scale);
  const offsetX = Math.floor((size - scaledWidth) / 2);
  const offsetY = Math.floor((size - scaledHeight) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "black"; // padding color
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(source, 0, 0, originalWidth, originalHeight, offsetX, offsetY, scaledWidth, scaledHeight);

  const { data } = canvasToImageData(canvas); // RGBA, 0-255, row-major
  const channelSize = size * size;
  const floatData = new Float32Array(3 * channelSize);

  for (let pixel = 0; pixel < channelSize; pixel++) {
    let r = data[pixel * 4] / 255;
    let g = data[pixel * 4 + 1] / 255;
    let b = data[pixel * 4 + 2] / 255;

    // TEST TOGGLE: PaddleOCR's original training pipeline (OpenCV-based)
    // reads images as BGR, not RGB. If whoever converted these .tflite
    // files preserved that assumption, a browser's canvas (which is
    // always RGB) would silently feed red and blue swapped — a
    // structured, non-random corruption that could plausibly explain
    // the repeated garbage pattern. Flip SWAP_RB_CHANNELS in
    // constants.js to test this directly.
    if (SWAP_RB_CHANNELS) {
      [r, b] = [b, r];
    }

    // NCHW layout: all red values first, then all green, then all blue.
    floatData[pixel] = (r - NORMALIZE_MEAN[0]) / NORMALIZE_STD[0];
    floatData[channelSize + pixel] = (g - NORMALIZE_MEAN[1]) / NORMALIZE_STD[1];
    floatData[2 * channelSize + pixel] = (b - NORMALIZE_MEAN[2]) / NORMALIZE_STD[2];
  }

  return {
    tensor: new Tensor(floatData, [1, 3, size, size]),
    scale,
    offsetX,
    offsetY,
  };
}