import { fileToImage } from "./imageUtils";
import { runTextDetector } from "./textDetector";
import { postprocessDetections } from "./postprocessDetector";
import { cropTextRegions } from "./cropTextRegions";
import { runTextRecognizer } from "./textRecognizer";
import { decodeCtcOutput } from "./ctcDecoder";
import { getDictionary } from "./modelLoader";

// The single entry point that ties every OCR step together:
// image -> detect text regions -> crop each region -> recognize each
// crop -> CTC-decode into characters -> join into a final string.
//
// onProgress(stage, percent) matches the contract OCRPage.jsx already
// calls with — so ocrService.js can pass it straight through.
export async function runOcr(imageSource, onProgress) {
  onProgress?.("Loading model & dictionary...", 5);
  const dictionary = await getDictionary();
  const image = await fileToImage(imageSource);

  onProgress?.("Detecting text regions...", 20);
  const detection = await runTextDetector(image);

  onProgress?.("Locating text boxes...", 35);
  const boxes = postprocessDetections(detection);

  if (boxes.length === 0) {
    onProgress?.("No text found.", 100);
    return { text: "", regions: [], confidence: 0 };
  }

  const crops = cropTextRegions(image, boxes);
  const regions = [];

  for (let i = 0; i < crops.length; i++) {
    onProgress?.(
      `Reading text region ${i + 1} of ${crops.length}...`,
      35 + Math.round((i / crops.length) * 60)
    );

    // DEBUG: logs each crop as an actual viewable image, plus its box
    // coordinates and the text we decoded from it. Open the browser
    // console (F12), click each logged image to expand it, and
    // compare it against the recognized text next to it. This tells
    // us definitively whether a bad result comes from a bad crop
    // (wrong/overlapping pixels — a detection bug) or a good crop
    // that the recognizer still misreads (a recognition/decoding
    // bug) — instead of guessing further.
    const debugImage = new Image();
    debugImage.src = crops[i].canvas.toDataURL();
    console.log(
      `Region ${i}: box=`,
      crops[i].box,
      debugImage
    );

    const { outputData, outputShape, contentRatio } = await runTextRecognizer(crops[i].canvas);
    const { text, confidence } = decodeCtcOutput(outputData, outputShape, dictionary, contentRatio);

    console.log(`Region ${i} decoded as: "${text}" (confidence ${(confidence * 100).toFixed(1)}%)`);

    regions.push({ box: crops[i].box, text, confidence });
  }

  onProgress?.("Done.", 100);

  const fullText = joinRegionsByLine(regions);
  const avgConfidence =
    regions.reduce((sum, r) => sum + r.confidence, 0) / regions.length;

  return { text: fullText, regions, confidence: avgConfidence };
}

// The detector finds one box per connected blob of pixels — which is
// usually one box per WORD, since whitespace breaks pixel connectivity.
// Simply joining every box with "\n" would put every word on its own
// line, losing spaces entirely. Instead: group boxes whose vertical
// centers overlap (they're on the same line), sort each group left to
// right, join words within a line with spaces, and join lines with "\n".
function joinRegionsByLine(regions) {
  const withCenters = regions.map((r) => ({
    ...r,
    centerY: r.box.y + r.box.height / 2,
  }));

  const lines = [];
  for (const region of withCenters) {
    // Find an existing line whose vertical center is close enough to
    // belong to the same row of text.
    const line = lines.find(
      (l) => Math.abs(l.centerY - region.centerY) < region.box.height * 0.6
    );
    if (line) {
      line.regions.push(region);
      // Keep the line's reference center as the average of its members.
      line.centerY =
        line.regions.reduce((sum, r) => sum + r.centerY, 0) / line.regions.length;
    } else {
      lines.push({ centerY: region.centerY, regions: [region] });
    }
  }

  // Lines themselves go top to bottom; words within a line go left to right.
  lines.sort((a, b) => a.centerY - b.centerY);

  return lines
    .map((line) =>
      line.regions
        .sort((a, b) => a.box.x - b.box.x)
        .map((r) => r.text)
        .join(" ")
    )
    .join("\n");
}