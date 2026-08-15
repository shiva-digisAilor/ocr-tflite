import { CTC_BLANK_INDEX } from "./constants";

// Greedy CTC decoding: at each timestep, pick the highest-scoring
// character class, then collapse consecutive repeats and drop blanks.
// This is the standard, simple decoding strategy — not beam search,
// but good enough for a solid first working version.
export function decodeCtcOutput(outputData, outputShape, dictionary) {
  const [, timesteps, numClasses] = outputShape;

  let previousIndex = -1;
  let text = "";
  let confidenceSum = 0;
  let confidenceCount = 0;

  for (let t = 0; t < timesteps; t++) {
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
