import { cropRegion } from "./imageUtils";

// Adds a small margin around each already-unclipped box before
// cropping. Kept intentionally asymmetric, for the same reason the
// unclip step in postprocessDetector.js is asymmetric: horizontal
// margin is cheap (worst case, touches the next word), vertical
// margin is risky (pulls in the adjacent line with normal line
// spacing). Since unclip already did most of the size-recovery work,
// this only needs to add a thin buffer for anti-aliased edges.
export function cropTextRegions(sourceImage, boxes, marginRatioX = 0.25, marginRatioY = 0.04) {
  return boxes.map((box) => {
    const marginX = Math.max(4, Math.round(box.height * marginRatioX));
    const marginY = Math.max(1, Math.round(box.height * marginRatioY));
    const x = Math.max(0, box.x - marginX);
    const y = Math.max(0, box.y - marginY);
    const width = Math.min(sourceImage.width - x, box.width + marginX * 2);
    const height = Math.min(sourceImage.height - y, box.height + marginY * 2);

    return {
      box,
      canvas: cropRegion(sourceImage, { x, y, width, height }),
    };
  });
}