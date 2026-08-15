import { DETECTION_BINARY_THRESHOLD, MIN_BOX_SIZE } from "./constants";

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
export function postprocessDetections({ probabilityMap, mapWidth, mapHeight, scaleX, scaleY }) {
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

      // Scale from detector-map coordinates back to the original image.
      boxes.push({
        x: Math.round(minX * scaleX),
        y: Math.round(minY * scaleY),
        width: Math.round(width * scaleX),
        height: Math.round(height * scaleY),
      });
    }
  }

  // Reading order: top-to-bottom, then left-to-right.
  boxes.sort((a, b) => a.y - b.y || a.x - b.x);

  return boxes;
}
