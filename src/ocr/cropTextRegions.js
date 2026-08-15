import { cropRegion } from "./imageUtils";

// Adds a small margin around each detected box (recognizer models
// generally read better with a little breathing room around the
// text) and crops each region out of the original image.
export function cropTextRegions(sourceImage, boxes, marginPx = 2) {
  return boxes.map((box) => {
    const x = Math.max(0, box.x - marginPx);
    const y = Math.max(0, box.y - marginPx);
    const width = Math.min(sourceImage.width - x, box.width + marginPx * 2);
    const height = Math.min(sourceImage.height - y, box.height + marginPx * 2);

    return {
      box,
      canvas: cropRegion(sourceImage, { x, y, width, height }),
    };
  });
}
