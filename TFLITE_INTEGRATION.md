# 🔌 TFLite Integration Guide

## Overview

This guide is for the developer who will integrate the TensorFlow Lite OCR model into the frontend.

**Good news:** The frontend is completely ready. You just need to replace one function.

---

## 📍 Where to Make Changes

**Only ONE file needs to be modified:**

```
src/services/ocrService.js
```

That's it! No UI components need to change.

---

## 🔄 Current State (Mock Implementation)

```javascript
// FILE: src/services/ocrService.js

/**
 * MOCK IMPLEMENTATION - Returns sample text for testing
 * 
 * Currently cycles through 4 sample texts:
 * 1. "Document Sample"
 * 2. "Store Receipt"
 * 3. "Technical Code Snippet"
 * 4. "Business Card"
 * 
 * REPLACE THIS FUNCTION with your TFLite implementation
 */

export async function recognizeText(imageSource, options = {}) {
  const { onProgress } = options;

  // Simulate processing stages
  if (onProgress) onProgress('Initializing OCR engine...', 15);
  await delay(400);

  if (onProgress) onProgress('Preprocessing image & building tensor...', 45);
  await delay(600);

  if (onProgress) onProgress('Running TFLite inference model...', 75);
  await delay(700);

  if (onProgress) onProgress('Decoding text tokens...', 95);
  await delay(300);

  // Return mock data
  lastSampleIndex = (lastSampleIndex + 1) % MOCK_TEXT_SAMPLES.length;
  const sample = MOCK_TEXT_SAMPLES[lastSampleIndex];

  return {
    text: sample.text,
    confidence: 0.96,
    timingMs: 2000,
    wordCount: extractedText.trim().split(/\s+/).length,
    characterCount: extractedText.length,
    sampleTitle: sample.title
  };
}
```

---

## 🎯 Integration Requirements

### Function Signature (Must Match)

```javascript
/**
 * Recognize text from an image using TFLite model
 * 
 * @param {File | Blob | HTMLImageElement | string} imageSource 
 *        The input image (File object, Blob, Image element, or Data URL)
 * 
 * @param {Object} [options={}]
 *        Configuration options
 * 
 * @param {Function} [options.onProgress]
 *        Callback: (statusMessage: string, percentComplete: number) => void
 *        Called to update progress (0-100%)
 * 
 * @returns {Promise<Object>}
 *         {
 *           text: string,              // Extracted text
 *           confidence: number,        // 0.0 to 1.0 confidence score
 *           timingMs: number,          // Inference time in milliseconds
 *           wordCount: number,         // Word count
 *           characterCount: number     // Character count
 *         }
 * 
 * @throws {Error} On processing failure (will be caught by UI)
 */
export async function recognizeText(imageSource, options = {}) {
  // Your implementation
}
```

### Return Value Requirements

The UI expects this object:

```javascript
{
  text: string,              // ✅ REQUIRED - The extracted text
  confidence: number,        // ✅ REQUIRED - Score 0.0-1.0 (for badge)
  timingMs: number,          // ✅ OPTIONAL - Processing time (nice to have)
  wordCount: number,         // ✅ OPTIONAL - Will be calculated if not provided
  characterCount: number     // ✅ OPTIONAL - Will be calculated if not provided
}
```

---

## 📋 Step-by-Step Integration

### Step 1: Install TensorFlow.js

```bash
npm install @tensorflow/tfjs @tensorflow/tfjs-tflite
```

### Step 2: Prepare Your Model File

Place your model in the public folder:

```
public/
└── models/
    └── ocr_model.tflite  # Your model file
```

Or use a CDN URL.

### Step 3: Replace the Function

Replace the entire `recognizeText()` function in `src/services/ocrService.js`:

```javascript
import * as tflite from '@tensorflow/tfjs-tflite';
import * as tf from '@tensorflow/tfjs';

let tfliteModel = null;

/**
 * Load TFLite model (lazy loading, cached)
 */
async function loadModel() {
  if (!tfliteModel) {
    tfliteModel = await tflite.loadTFLiteModel('models/ocr_model.tflite');
  }
  return tfliteModel;
}

/**
 * Preprocess image into tensor
 * Adjust based on your model's input requirements
 */
function preprocessImage(imageSource) {
  // Convert image to tensor
  let imageTensor = tf.browser.fromPixels(imageSource);

  // Resize to model input size (example: 224x224)
  imageTensor = tf.image.resizeBilinear(imageTensor, [224, 224]);

  // Normalize to [-1, 1] or [0, 1] depending on your model
  imageTensor = tf.cast(imageTensor, 'float32').div(tf.scalar(127.5)).sub(tf.scalar(1.0));

  // Add batch dimension
  imageTensor = imageTensor.expandDims(0);

  return imageTensor;
}

/**
 * Decode model output to text
 * This depends on your model's output format
 */
function decodeOutput(output) {
  // Example: If your model outputs CTC logits, use CTC decode
  // If it outputs tokens, convert token IDs to characters
  
  let decodedText = '';

  // CASE 1: CTC Logits (sequence-to-sequence models)
  if (output.shape[output.shape.length - 1] > 26) {
    // Likely CTC output - implement CTC decoding
    // You'll need a CTC decoder or use TensorFlow.js utilities
    decodedText = performCTCDecode(output.dataSync());
  }

  // CASE 2: Token output (token-based models)
  else {
    // Convert token IDs to characters
    const tokenIds = Array.from(output.dataSync());
    decodedText = tokenIds
      .map(id => tokenToChar(id))
      .join('')
      .trim();
  }

  return decodedText;
}

/**
 * Convert a token ID to character
 */
function tokenToChar(tokenId) {
  // Implement based on your model's vocabulary
  // Example mapping:
  const charMap = {
    0: ' ',
    1: 'a', 2: 'b', 3: 'c', // ... etc
  };
  return charMap[tokenId] || '?';
}

/**
 * Main recognition function - YOUR IMPLEMENTATION
 */
export async function recognizeText(imageSource, options = {}) {
  const { onProgress } = options;
  const startTime = Date.now();

  try {
    // STAGE 1: Load model
    if (onProgress) onProgress('Loading OCR model...', 10);
    const model = await loadModel();

    // STAGE 2: Preprocess image
    if (onProgress) onProgress('Preprocessing image...', 30);
    const inputTensor = preprocessImage(imageSource);

    // STAGE 3: Run inference
    if (onProgress) onProgress('Running inference...', 60);
    const output = model.predict(inputTensor);

    // STAGE 4: Decode output
    if (onProgress) onProgress('Decoding text...', 90);
    const text = decodeOutput(output);

    // STAGE 5: Calculate metrics
    if (onProgress) onProgress('Finalizing...', 99);
    const timingMs = Date.now() - startTime;
    const wordCount = text.trim().split(/\s+/).length;
    const characterCount = text.length;

    // Cleanup tensors
    inputTensor.dispose();
    output.dispose();

    return {
      text,
      confidence: 0.92, // Adjust based on your model's confidence output
      timingMs,
      wordCount,
      characterCount
    };
  } catch (error) {
    console.error('TFLite OCR Error:', error);
    throw new Error(`OCR processing failed: ${error.message}`);
  }
}
```

### Step 4: Test

```bash
npm run dev
# Upload an image and click "Recognize Text"
```

---

## 🔧 Common Model Formats

### Option 1: CTC-based Sequence-to-Sequence

Common format for text recognition models. Outputs:
- Shape: `[batch, sequence_length, num_chars]`
- Contains logits for each character at each position
- Requires CTC decode to convert to text

```javascript
function decodeOutput(output) {
  // Use CTC decoder
  // You can implement or use a library
  const decoded = performCTCGreedyDecode(output.dataSync());
  return decoded;
}
```

### Option 2: Token-based Sequence Models

Models that output token IDs directly:
- Shape: `[batch, sequence_length]`
- Each value is a token ID
- Requires vocabulary mapping

```javascript
function decodeOutput(output) {
  const tokenIds = Array.from(output.dataSync());
  return tokenIds.map(id => getCharFromToken(id)).join('');
}
```

### Option 3: Attention-based Models

More complex models with attention mechanisms:
- Requires multiple forward passes
- Output decoding more involved
- Usually best done with native TensorFlow

---

## 🖼️ Image Preprocessing Template

### For Different Model Requirements

```javascript
// For models expecting [224, 224] RGB:
function preprocessImage(imageSource) {
  let tensor = tf.browser.fromPixels(imageSource);
  tensor = tf.image.resizeBilinear(tensor, [224, 224]);
  tensor = tf.cast(tensor, 'float32').div(255.0);
  return tensor.expandDims(0);
}

// For models expecting grayscale:
function preprocessImage(imageSource) {
  let tensor = tf.browser.fromPixels(imageSource);
  tensor = tf.image.resizeBilinear(tensor, [128, 32]);
  tensor = tf.image.rgbToGrayscale(tensor);
  tensor = tf.cast(tensor, 'float32').div(255.0);
  return tensor.expandDims(0);
}

// For models with custom normalization:
function preprocessImage(imageSource) {
  let tensor = tf.browser.fromPixels(imageSource);
  tensor = tf.image.resizeBilinear(tensor, [384, 384]);
  tensor = tf.cast(tensor, 'float32');
  
  // Normalize with mean and std
  const mean = tf.tensor1d([0.485, 0.456, 0.406]);
  const std = tf.tensor1d([0.229, 0.224, 0.225]);
  
  tensor = tensor.div(255.0);
  tensor = tf.stack([
    tensor.slice([0, 0, 0], [384, 384, 1]).sub(mean.slice([0], [1])).div(std.slice([0], [1])),
    tensor.slice([0, 0, 1], [384, 384, 1]).sub(mean.slice([1], [1])).div(std.slice([1], [1])),
    tensor.slice([0, 0, 2], [384, 384, 1]).sub(mean.slice([2], [1])).div(std.slice([2], [1]))
  ], 2);
  
  return tensor.expandDims(0);
}
```

---

## 🧠 Memory Management

Important for browser-based inference:

```javascript
export async function recognizeText(imageSource, options = {}) {
  const { onProgress } = options;

  // IMPORTANT: Tensors consume memory
  // Keep track of what you create
  
  let inputTensor = null;
  let outputTensor = null;

  try {
    // Create tensors
    inputTensor = preprocessImage(imageSource);
    outputTensor = model.predict(inputTensor);
    
    // Use the data
    const text = decodeOutput(outputTensor);
    
    return { text, /* ... */ };
  } finally {
    // CLEANUP: Always dispose of tensors!
    if (inputTensor) inputTensor.dispose();
    if (outputTensor) outputTensor.dispose();
  }
}
```

---

## 🚀 Performance Optimization

### Use Web Workers for Inference

For large models, inference can block the UI thread:

```javascript
// Create a Web Worker for inference
// This keeps UI responsive

export async function recognizeText(imageSource, options = {}) {
  const { onProgress } = options;
  
  if (onProgress) onProgress('Preprocessing...', 30);
  const tensor = preprocessImage(imageSource);
  
  if (onProgress) onProgress('Running inference...', 50);
  
  // Post to worker
  return new Promise((resolve, reject) => {
    worker.postMessage({
      type: 'predict',
      tensorData: tensor.dataSync()
    });
    
    worker.onmessage = (e) => {
      const text = decodeOutput(e.data.output);
      resolve({ text, /* ... */ });
    };
  });
}
```

### Model Quantization

Use quantized models for faster inference:
- UINT8 quantization: ~4x faster, small quality loss
- INT8 quantization: Good balance
- Keep FP32 for high accuracy requirements

---

## 🧪 Testing Your Integration

### Test with Sample Images

```javascript
// Test 1: Document
fetch('path/to/document.jpg')
  .then(r => r.blob())
  .then(blob => recognizeText(blob))
  .then(result => console.log(result.text));

// Test 2: Handwriting
fetch('path/to/handwriting.jpg')
  .then(r => r.blob())
  .then(blob => recognizeText(blob))
  .then(result => console.log(result.text));
```

### Monitor Performance

```javascript
export async function recognizeText(imageSource, options = {}) {
  const { onProgress } = options;
  const timings = {};

  // Time each stage
  timings.start = performance.now();
  
  const model = await loadModel();
  timings.modelLoad = performance.now();
  onProgress?.('Model loaded', 20);

  const tensor = preprocessImage(imageSource);
  timings.preprocess = performance.now();
  onProgress?.('Image preprocessed', 40);

  const output = model.predict(tensor);
  timings.inference = performance.now();
  onProgress?.('Inference complete', 80);

  const text = decodeOutput(output);
  timings.decode = performance.now();

  // Log performance
  console.log('Performance metrics:', {
    modelLoad: timings.modelLoad - timings.start,
    preprocess: timings.preprocess - timings.modelLoad,
    inference: timings.inference - timings.preprocess,
    decode: timings.decode - timings.inference,
    total: timings.decode - timings.start
  });

  return { text, /* ... */ };
}
```

---

## ❌ Common Pitfalls to Avoid

1. **Forgetting to dispose tensors**
   ```javascript
   // ❌ BAD - Memory leak
   const tensor = tf.tensor(...);
   
   // ✅ GOOD - Clean up
   const tensor = tf.tensor(...);
   tensor.dispose();
   ```

2. **Not handling image source types**
   ```javascript
   // ✅ GOOD - Handle all types
   function convertToImage(imageSource) {
     if (imageSource instanceof Blob || imageSource instanceof File) {
       return imageToCanvas(imageSource);
     } else if (typeof imageSource === 'string') {
       return stringToImage(imageSource);
     } else {
       return imageSource;
     }
   }
   ```

3. **Wrong preprocessing**
   ```javascript
   // ❌ BAD - Assuming 224x224 for all models
   tensor = tf.image.resizeBilinear(tensor, [224, 224]);
   
   // ✅ GOOD - Use model-specific dimensions
   tensor = tf.image.resizeBilinear(tensor, MODEL_INPUT_SHAPE);
   ```

4. **Not catching errors**
   ```javascript
   // ❌ BAD - Errors crash the app
   const output = model.predict(tensor);
   
   // ✅ GOOD - Proper error handling
   try {
     const output = model.predict(tensor);
   } catch (error) {
     console.error('Inference failed:', error);
     throw new Error('OCR processing failed');
   }
   ```

5. **Blocking the UI thread**
   ```javascript
   // ❌ BAD - UI freezes during inference
   const output = model.predict(tensor);
   
   // ✅ GOOD - Use async/await
   onProgress?.('Running inference...', 60);
   const output = await model.predict(tensor);
   ```

---

## 📞 Debugging Tips

### Enable TensorFlow.js Logging

```javascript
import * as tf from '@tensorflow/tfjs';

tf.ENV.set('DEBUG', true);

export async function recognizeText(imageSource, options = {}) {
  // Now TF.js will log detailed information
  const model = await loadModel();
  // ... rest of code
}
```

### Check Model Input/Output Shapes

```javascript
async function loadModel() {
  const model = await tflite.loadTFLiteModel('models/ocr_model.tflite');
  
  console.log('Model details:');
  console.log('Inputs:', model.inputs);
  console.log('Outputs:', model.outputs);
  
  return model;
}
```

### Visualize Intermediate Results

```javascript
function preprocessImage(imageSource) {
  let tensor = tf.browser.fromPixels(imageSource);
  console.log('Original shape:', tensor.shape);
  
  tensor = tf.image.resizeBilinear(tensor, [224, 224]);
  console.log('Resized shape:', tensor.shape);
  
  tensor = tf.cast(tensor, 'float32').div(255.0);
  console.log('Normalized shape:', tensor.shape);
  
  return tensor.expandDims(0);
}
```

---

## 🎯 Confidence Scoring

Different ways to estimate confidence:

```javascript
// OPTION 1: CTC confidence (from logits)
function getCTCConfidence(logits) {
  // Average the max probability across sequence
  const maxProbs = [];
  for (let i = 0; i < logits.length; i += numClasses) {
    const probs = softmax(logits.slice(i, i + numClasses));
    maxProbs.push(Math.max(...probs));
  }
  return maxProbs.reduce((a, b) => a + b) / maxProbs.length;
}

// OPTION 2: Model ensemble confidence
function getEnsembleConfidence(predictions) {
  // Average predictions from multiple models
  return predictions.reduce((a, b) => a + b) / predictions.length;
}

// OPTION 3: Output entropy confidence
function getEntropyConfidence(output) {
  // Lower entropy = higher confidence
  const probs = softmax(output);
  const entropy = -probs.reduce((sum, p) => sum + p * Math.log(p), 0);
  return 1 - (entropy / Math.log(probs.length));
}
```

---

## ✅ Checklist Before Going to Production

- ✅ Model loads correctly
- ✅ Preprocessing matches model expectations
- ✅ Output decoding produces readable text
- ✅ Confidence scores are meaningful
- ✅ No memory leaks (monitor in DevTools)
- ✅ Reasonable inference speed (< 5 seconds for typical images)
- ✅ Error handling works (bad images, permissions, etc.)
- ✅ Works on different device types (desktop, mobile, camera)
- ✅ Progress messages are informative
- ✅ Text can be copied and exported correctly

---

## 🚀 Final Integration Steps

1. Replace `recognizeText()` function
2. Test locally: `npm run dev`
3. Upload test images
4. Verify accuracy
5. Optimize performance if needed
6. Build: `npm run build`
7. Deploy: Upload `dist/` folder
8. Test in production

---

## 📖 Reference

- [TensorFlow.js Docs](https://www.tensorflow.org/js/guide)
- [TFLite Documentation](https://www.tensorflow.org/lite)
- [TFLite Web Guide](https://www.tensorflow.org/lite/guide/web)
- [CTC Decoding](https://github.com/keunwoochoi/ctc_visualizer)

---

**Ready to integrate? Start with Step 1 above! 🚀**
