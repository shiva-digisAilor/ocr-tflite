import { CTC_BLANK_INDEX, CTC_BOUNDARY_SAFETY_TIMESTEPS } from "./constants";

// Greedy CTC decoding: at each timestep, pick the highest-scoring
// character class, then collapse consecutive repeats and drop blanks.
// This is the standard, simple decoding strategy — not beam search,
// but good enough for a solid working version.
//
// contentRatio (0-1, optional): fraction of the input that was real
// content vs black padding (see textRecognizer.js). Timesteps map
// roughly proportionally to input width, so we stop decoding once we
// pass that point. We also trim a small extra safety margin beyond
// that boundary — even with correctly-colored padding, the model's
// convolutional receptive field blends a few real pixels with a few
// padding pixels right at the edge, which can produce a couple of
// straggling garbage characters right at that boundary otherwise.
export function decodeCtcOutput(outputData, outputShape, dictionary, contentRatio = 1) {
  const [, timesteps, numClasses] = outputShape;
  const rawCutoff = Math.ceil(timesteps * Math.min(contentRatio, 1));
  const usableTimesteps = Math.max(1, rawCutoff - CTC_BOUNDARY_SAFETY_TIMESTEPS);

  let previousIndex = -1;
  let text = "";
  let confidenceSum = 0;
  let confidenceCount = 0;

  for (let t = 0; t < usableTimesteps; t++) {
    let bestIndex = 0;
    let bestScore = -Infinity;

    for (let c = 0; c < numClasses; c++) {
      const score = outputData[t * numClasses + c];
      if (score > bestScore) {
        bestScore = score;
        bestIndex = c;
      }
    }

    const isBlank = bestIndex === CTC_BLANK_INDEX;
    const isRepeat = bestIndex === previousIndex;

    if (!isBlank && !isRepeat) {
      text += dictionary[bestIndex] ?? "";
      confidenceSum += bestScore;
      confidenceCount += 1;
    }

    previousIndex = bestIndex;
  }

  return {
    text,
    confidence: confidenceCount > 0 ? confidenceSum / confidenceCount : 0,
  };
}