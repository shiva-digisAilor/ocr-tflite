# OCR Scanner - Quick Start Guide

## 🚀 5-Minute Setup

### 1. Install & Run
```bash
npm install
npm run dev
```
Open http://localhost:5173/ in your browser.

## 📋 What You Can Do Right Now

✅ **Upload Images** - Drag & drop or click to upload JPG, PNG, WEBP (max 10MB)
✅ **Capture with Camera** - Use your device's camera to take photos
✅ **See Results** - Click "Recognize Text" to get mock OCR results
✅ **Edit & Copy** - Edit extracted text and copy to clipboard
✅ **Download** - Export extracted text as .txt file
✅ **Test All States** - Loading spinner, error handling, empty states

## 🔌 Connect Your OCR Model

### File to modify: `src/services/ocrService.js`

Current mock function:
```javascript
export async function recognizeText(imageSource, options = {}) {
  // Currently returns sample text - REPLACE THIS
}
```

**Replace it with your TFLite implementation.** The UI will work unchanged!

### Integration Template
```javascript
import * as tflite from '@tensorflow/tfjs-tflite';

export async function recognizeText(imageSource, options = {}) {
  const { onProgress } = options;

  // Load model
  onProgress?.('Loading model...', 10);
  const model = await loadTFLiteModel('path/to/model.tflite');

  // Preprocess image
  onProgress?.('Processing image...', 30);
  const tensor = preprocessImage(imageSource);

  // Run inference
  onProgress?.('Running OCR...', 60);
  const result = model.predict(tensor);

  // Decode output
  onProgress?.('Decoding...', 90);
  const text = decodeResult(result);

  return {
    text,
    confidence: 0.95,
    timingMs: 2000,
    wordCount: text.split(/\s+/).length,
    characterCount: text.length
  };
}
```

## 📱 UI Layout

**Desktop (2-column):**
- Left: Image upload/preview + OCR button
- Right: Text result panel

**Mobile (stacked):**
- Full-width components, scrollable

## 🎯 Key Components

| Component | Purpose |
|-----------|---------|
| `ImageUploader.jsx` | File upload with drag-and-drop |
| `ImagePreview.jsx` | Display selected image + metadata |
| `OCRButton.jsx` | Main action button (recognizes text) |
| `LoadingState.jsx` | Shows progress during OCR |
| `OCRResult.jsx` | Displays and edits extracted text |
| `CameraModal.jsx` | Capture images with device camera |

## 🔧 Available Commands

```bash
npm run dev      # Start development server (hot reload)
npm run build    # Build for production
npm run lint     # Check code quality
npm run preview  # Preview production build
```

## 💡 Testing Tips

### Test Upload Flow
1. Drag an image onto the upload area
2. See image preview
3. Click "Recognize Text"
4. Watch the progress bar
5. See mock results

### Test Camera
1. Click "Use Camera"
2. Allow camera permission
3. Click "Take Photo"
4. Image appears as preview

### Test Error Handling
- Try uploading a non-image file → Error toast
- Try uploading a 20MB file → Size error
- Deny camera permission → Permission error

## 📦 Install TFLite (When Ready)

```bash
npm install @tensorflow/tfjs @tensorflow/tfjs-tflite
```

Then replace `recognizeText()` function in `src/services/ocrService.js` with your model code.

## 🚀 Deploy to Production

```bash
npm run build
# Upload dist/ folder to:
# - Vercel
# - Netlify
# - GitHub Pages
# - AWS S3 + CloudFront
# - Any static hosting
```

## 📖 Full Documentation

See `PROJECT_DOCUMENTATION.md` for detailed information about:
- Project structure
- Design system
- Component details
- Responsive design
- Accessibility features
- Troubleshooting

## ✨ Features Included

- ✅ Drag-and-drop image upload
- ✅ Camera capture
- ✅ Image preview with metadata
- ✅ Editable text results
- ✅ Copy to clipboard
- ✅ Download as .txt
- ✅ Loading states with progress
- ✅ Error handling & toasts
- ✅ Responsive design
- ✅ Professional styling
- ✅ Mock OCR service (ready for TFLite)

## 🎨 Customize

### Change Colors
Edit `src/index.css` CSS variables:
```css
:root {
  --accent-primary: #4f46e5;  /* Primary blue */
  --success-color: #10b981;   /* Success green */
  --error-color: #ef4444;     /* Error red */
  /* ... more colors ... */
}
```

### Change Max File Size
Edit `src/components/ImageUploader.jsx`:
```javascript
const MAX_FILE_SIZE_MB = 10;  // Change this value
```

### Add Supported Formats
Edit `src/components/ImageUploader.jsx`:
```javascript
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff'  // Add more formats here
];
```

## 🐛 Common Issues

**Q: Camera not working?**
A: Check browser permissions (Chrome/Edge/Safari settings)

**Q: Build errors?**
A: Run `npm install` again or delete `node_modules` and reinstall

**Q: Styles not applying?**
A: Clear browser cache and restart dev server

## 📞 Need Help?

1. Check `PROJECT_DOCUMENTATION.md` for detailed info
2. Review component JSDoc comments
3. Check `src/services/ocrService.js` for integration guide
4. Inspect browser console for errors

---

**Ready to integrate your TFLite model? Edit `src/services/ocrService.js` and you're done! 🚀**
