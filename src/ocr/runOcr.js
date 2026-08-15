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

    const { outputData, outputShape } = await runTextRecognizer(crops[i].canvas);
    const { text, confidence } = decodeCtcOutput(outputData, outputShape, dictionary);

    regions.push({ box: crops[i].box, text, confidence });
  }

  onProgress?.("Done.", 100);

  // Regions are already sorted top-to-bottom/left-to-right by
  // postprocessDetections, so joining them in order reconstructs
  // reading order reasonably well.
  const fullText = regions.map((r) => r.text).join("\n");
  const avgConfidence =
    regions.reduce((sum, r) => sum + r.confidence, 0) / regions.length;

  return { text: fullText, regions, confidence: avgConfidence };
}
