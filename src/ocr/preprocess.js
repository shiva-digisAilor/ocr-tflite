import { Tensor } from "@litertjs/core";
import { NORMALIZE_MEAN, NORMALIZE_STD } from "./constants";
import { imageToCanvas, canvasToImageData } from "./imageUtils";

// Converts an image/canvas into a normalized [1, 3, height, width]
// Float32 tensor — NCHW / channels-first. Confirmed correct directly
// from the model's own runtime error message (it reports its expected
// shape when given the wrong one) — the most reliable source we have,
// more reliable than any outside reference.
export function preprocessToTensor(source, width, height) {
  const canvas = imageToCanvas(source, width, height);
  const { data } = canvasToImageData(canvas); // RGBA, 0-255, row-major

  const channelSize = width * height;
  const floatData = new Float32Array(3 * channelSize);

  for (let pixel = 0; pixel < channelSize; pixel++) {
    const r = data[pixel * 4] / 255;
    const g = data[pixel * 4 + 1] / 255;
    const b = data[pixel * 4 + 2] / 255;

    // NCHW layout: all red values first, then all green, then all blue.
    floatData[pixel] = (r - NORMALIZE_MEAN[0]) / NORMALIZE_STD[0];
    floatData[channelSize + pixel] = (g - NORMALIZE_MEAN[1]) / NORMALIZE_STD[1];
    floatData[2 * channelSize + pixel] = (b - NORMALIZE_MEAN[2]) / NORMALIZE_STD[2];
  }

  return new Tensor(floatData, [1, 3, height, width]);
}
