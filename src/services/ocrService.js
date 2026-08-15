/**
 * OCR Service Module
 * 
 * ============================================================================
 * TFLITE OCR INTEGRATION BOUNDARY
 * ============================================================================
 * 
 * This service exposes a clean contract `recognizeText(imageSource, options)`
 * for the UI components to invoke OCR operations without knowing how the
 * model is loaded or executed under the hood.
 * 
 * TO INTEGRATE ACTUAL TFLITE MODEL LATER:
 * 1. Install TensorFlow.js / TFLite runtime:
 *    npm install @tensorflow/tfjs @tensorflow/tfjs-tflite
 * 
 * 2. Load your model (e.g., in a Web Worker or singleton module):
 *    import * as tflite from '@tensorflow/tfjs-tflite';
 *    const tfliteModel = await tflite.loadTFLiteModel('/models/ocr_model.tflite');
 * 
 * 3. Replace the implementation inside `recognizeText()` below with:
 *    - Image element / canvas tensor preprocessing (resizing, grayscale, normalization)
 *    - Running `tfliteModel.predict(tensor)`
 *    - Decoding output tokens / CTC decoding / bounding boxes to text string
 * 
 * ============================================================================
 */

// Preset realistic mock responses for testing UI states
const MOCK_TEXT_SAMPLES = [
  {
    title: "Document Sample",
    text: `OCR SCANNER DEMO DOCUMENT
Date: August 13, 2026
Document ID: DOC-98421

INSTRUCTIONS FOR INTEGRATION:
1. Upload an image file or use the live camera stream.
2. Click "Recognize Text" to trigger the OCR engine.
3. Extracted text will appear in the result panel ready for editing or copying.

This text is simulated by the ocrService mock implementation. Replace this with your TFLite model inference logic in src/services/ocrService.js.`
  },
  {
    title: "Store Receipt",
    text: `SUPERMARKET EXPRESS
123 MAIN STREET, SUITE 400
TEL: (555) 019-2834

ITEMS PURCHASED:
- Organic Coffee Beans 500g      $14.50
- Almond Milk 1L                 $3.99
- Whole Grain Bread              $4.25
- Fresh Blueberries              $5.50

SUBTOTAL:                        $28.24
TAX (8%):                        $2.26
TOTAL:                           $30.50

THANK YOU FOR SHOPPING WITH US!`
  },
  {
    title: "Technical Code Snippet",
    text: `async function processImageWithTFLite(imageElement) {
  // Load TFLite Model
  const model = await tflite.loadTFLiteModel('./ocr_model.tflite');
  
  // Preprocess Image to Tensor
  const inputTensor = tf.browser.fromPixels(imageElement)
    .resizeNearestNeighbor([224, 224])
    .toFloat()
    .div(127.5)
    .sub(1.0)
    .expandDims(0);

  // Run Inference
  const output = model.predict(inputTensor);
  return decodeCTC(output);
}`
  },
  {
    title: "Business Card",
    text: `ALEX R. MORGAN
Senior AI Engineer & Systems Architect

Email: alex.morgan@example-tech.com
Phone: +1 (415) 555-8921
GitHub: github.com/alexmorgan-ai
Office: Tech Hub Tower, San Francisco, CA`
  }
];

let lastSampleIndex = -1;

/**
 * Recognize text from an image source.
 * 
 * @param {File | Blob | HTMLImageElement | string} imageSource - The image input (File, Blob, Image element or Data URL)
 * @param {Object} [options] - Optional configurations
 * @param {Function} [options.onProgress] - Callback for reporting progress status: (stage, percent) => void
 * @returns {Promise<{ text: string, confidence: number, timingMs: number, wordCount: number, characterCount: number }>}
 */
export async function recognizeText(imageSource, options = {}) {
  const { onProgress } = options;

  // 1. Stage: Initialization
  if (onProgress) onProgress('Initializing OCR engine...', 15);
  await delay(400);

  // 2. Stage: Image Preprocessing
  if (onProgress) onProgress('Preprocessing image & building tensor...', 45);
  await delay(600);

  // 3. Stage: Model Inference
  if (onProgress) onProgress('Running TFLite inference model...', 75);
  await delay(700);

  // 4. Stage: Text Decoding
  if (onProgress) onProgress('Decoding text tokens...', 95);
  await delay(300);

  // Cycle through sample texts so consecutive clicks display interesting varied text
  lastSampleIndex = (lastSampleIndex + 1) % MOCK_TEXT_SAMPLES.length;
  const sample = MOCK_TEXT_SAMPLES[lastSampleIndex];
  
  const extractedText = sample.text;
  const wordCount = extractedText.trim() ? extractedText.trim().split(/\s+/).length : 0;
  const characterCount = extractedText.length;

  return {
    text: extractedText,
    confidence: 0.96, // 96% confidence sample
    timingMs: 2000,
    wordCount,
    characterCount,
    sampleTitle: sample.title
  };
}

/**
 * Helper utility to simulate asynchronous delay
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
