import { DETECTION_BINARY_THRESHOLD, MIN_BOX_SIZE, UNCLIP_PAD_X_RATIO, UNCLIP_PAD_Y_RATIO } from "./constants";

// Turns the detector's raw probability map into a list of axis-aligned
// text boxes, in ORIGINAL image coordinates.
//
// Simplification note: PaddleOCR's real postprocessing finds rotated
// minimum-area rectangles around each text blob (usually via OpenCV).
// Reimplementing that from scratch in pure JS is a much bigger task.
// This version finds connected regions and returns their axis-aligned
// bounding box instead — works well for normal horizontal text, less
// well for heavily rotated/skewed text. Reasonable trade-off to get a
// working pipeline quickly; can be upgraded later.
export function postprocessDetections({ probabilityMap, mapWidth, mapHeight, scale, offsetX, offsetY }) {
  const visited = new Uint8Array(mapWidth * mapHeight);
  const boxes = [];

  for (let y = 0; y < mapHeight; y++) {
    for (let x = 0; x < mapWidth; x++) {
      const index = y * mapWidth + x;
      if (visited[index]) continue;
      if (probabilityMap[index] < DETECTION_BINARY_THRESHOLD) continue;

      // Flood-fill this connected blob of "is text" pixels (iterative,
      // not recursive, so it won't blow the call stack on large blobs).
      const stack = [[x, y]];
      let minX = x, maxX = x, minY = y, maxY = y;
      visited[index] = 1;

      while (stack.length > 0) {
        const [cx, cy] = stack.pop();
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);

        const neighbors = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || nx >= mapWidth || ny < 0 || ny >= mapHeight) continue;
          const nIndex = ny * mapWidth + nx;
          if (visited[nIndex]) continue;
          if (probabilityMap[nIndex] < DETECTION_BINARY_THRESHOLD) continue;
          visited[nIndex] = 1;
          stack.push([nx, ny]);
        }
      }

      const width = maxX - minX;
      const height = maxY - minY;
      if (width < MIN_BOX_SIZE || height < MIN_BOX_SIZE) continue;

      // UNCLIP STEP: DB-style detectors are trained to predict a
      // deliberately SHRUNK region around each text blob, not its true
      // size. Official postprocessing expands each box afterward to
      // recover the real size — otherwise text gets clipped at the edges.
      //
      // Both paddings are scaled off HEIGHT (a stable proxy for font
      // size), not each box's own width — width varies enormously
      // between a 1-character box and a 5-word box, so padding
      // relative to width either over- or under-pads inconsistently.
      //
      // X can be generous (recovers shrunk glyph width; slightly
      // touching the next word on the same line is harmless — see
      // joinRegionsByLine in runOcr.js). Y must stay tight: with normal
      // line spacing, over-expanding vertically pulls in pixels from
      // the line above/below and corrupts recognition from the very
      // first character.
      const padX = height * UNCLIP_PAD_X_RATIO;
      const padY = height * UNCLIP_PAD_Y_RATIO;
      const unclippedMinX = Math.max(0, minX - padX);
      const unclippedMinY = Math.max(0, minY - padY);
      const unclippedMaxX = Math.min(mapWidth, maxX + padX);
      const unclippedMaxY = Math.min(mapHeight, maxY + padY);

      // Map from detector-map (letterboxed, padded) coordinates back to
      // the ORIGINAL image: subtract the padding offset first, then
      // undo the uniform scale factor.
      boxes.push({
        x: Math.round((unclippedMinX - offsetX) / scale),
        y: Math.round((unclippedMinY - offsetY) / scale),
        width: Math.round((unclippedMaxX - unclippedMinX) / scale),
        height: Math.round((unclippedMaxY - unclippedMinY) / scale),
      });
    }
  }

  // Reading order: top-to-bottom, then left-to-right.
  boxes.sort((a, b) => a.y - b.y || a.x - b.x);

  return boxes;
}