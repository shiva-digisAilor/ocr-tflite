// Small, reusable helpers for turning a File into pixel data, and for
// cropping/resizing regions using an offscreen canvas.

// Accepts either a File/Blob (from a fresh upload) or a plain URL
// string (e.g. an already-created object URL) — OCRPage passes
// `imageFile || previewUrl`, so both shapes need to work here.
export function fileToImage(source) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = typeof source === "string" ? source : URL.createObjectURL(source);
  });
}

// Draws an image (or another canvas) onto a new canvas at a given
// size — used both for resizing to a model's input dimensions.
export function imageToCanvas(image, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, width, height);
  return canvas;
}

// Crops an axis-aligned box { x, y, width, height } out of a source
// image/canvas and returns it as its own canvas.
export function cropRegion(source, box) {
  const { x, y, width, height } = box;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(source, x, y, width, height, 0, 0, width, height);
  return canvas;
}

export function canvasToImageData(canvas) {
  const ctx = canvas.getContext("2d");
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}