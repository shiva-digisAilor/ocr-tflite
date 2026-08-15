# OCR Scanner - Browser-Based Text Recognition UI

[![React](https://img.shields.io/badge/React-19.2-blue)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8.2-purple)](https://vitejs.dev)
[![License](https://img.shields.io/badge/License-MIT-green)]()

A modern, professional browser-based application for extracting text from images using OCR. Built with React + Vite with a clean architecture ready for TensorFlow Lite integration.

## 🎯 Key Features

- 📤 **Drag-and-drop image upload** with validation
- 📷 **Live camera capture** with device camera
- 🖼️ **Image preview** with metadata (dimensions, file size)
- ✂️ **Editable text area** for extracted results
- 📋 **Copy to clipboard** with visual feedback
- 💾 **Export to .txt file**
- ⏳ **Loading states** with progress tracking
- 🎨 **Professional UI** with responsive design
- 📱 **Mobile-friendly** layout (2-column desktop, stacked mobile)
- ⚠️ **Error handling** with toast notifications
- 🔌 **Clean OCR service boundary** (ready for TFLite integration)

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
# Open http://localhost:5173/

# Build for production
npm run build

# Run linter
npm run lint
```

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Header.jsx      # App header with branding
│   ├── ImageUploader.jsx   # File upload interface
│   ├── ImagePreview.jsx    # Image display
│   ├── OCRButton.jsx       # Main action button
│   ├── OCRResult.jsx       # Text result panel
│   ├── LoadingState.jsx    # Progress indicator
│   ├── CameraModal.jsx     # Camera capture
│   └── Toast.jsx           # Notifications
├── pages/
│   └── OCRPage.jsx     # Main application page
├── services/
│   └── ocrService.js   # OCR service (TFLite boundary)
├── App.jsx
├── main.jsx
└── index.css           # Global styles
```

## 🔌 OCR Integration

The OCR functionality is isolated in **`src/services/ocrService.js`** with a clean service contract:

```javascript
export async function recognizeText(imageSource, options = {})
```

### Current State: Mock Implementation ✓
Returns sample text for testing the UI.

### Ready for: TFLite Integration
Replace the mock implementation with your TensorFlow Lite model without changing any UI code.

### Integration Template

```javascript
import * as tflite from '@tensorflow/tfjs-tflite';

export async function recognizeText(imageSource, options = {}) {
  const { onProgress } = options;
  
  // 1. Load TFLite model
  onProgress?.('Loading model...', 10);
  const model = await tflite.loadTFLiteModel('path/to/model.tflite');
  
  // 2. Preprocess image
  onProgress?.('Preprocessing image...', 30);
  const inputTensor = preprocessImage(imageSource);
  
  // 3. Run inference
  onProgress?.('Running inference...', 60);
  const output = model.predict(inputTensor);
  
  // 4. Decode text
  onProgress?.('Decoding text...', 90);
  const text = decodeOutput(output);
  
  return {
    text,
    confidence: 0.95,
    timingMs: 2000,
    wordCount: text.split(/\s+/).length,
    characterCount: text.length
  };
}
```

## 📖 Documentation

- **[QUICKSTART.md](./QUICKSTART.md)** - 5-minute setup guide
- **[PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md)** - Complete documentation

## 🛠️ Available Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run code quality checks |

## 💻 Browser Support

- Chrome/Chromium 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers (iOS Safari, Chrome Mobile)

**Requirements:**
- FileReader API
- Canvas API
- MediaDevices API (for camera)
- CSS Grid & Flexbox

## 🎨 Design Features

- **Color Scheme:** Modern light theme with indigo accents
- **Typography:** Inter font family with system fallbacks
- **Layout:** Responsive grid (2-column desktop, stacked mobile)
- **Components:** Rounded cards with subtle shadows
- **Accessibility:** ARIA labels, keyboard navigation, focus states

## 📦 Dependencies

```json
{
  "react": "^19.2.8",
  "react-dom": "^19.2.8",
  "lucide-react": "^1.31.0"
}
```

**Why minimal dependencies?**
- Lightweight (optimized for browser-based ML models)
- Fast build times
- Easy to maintain and extend
- Ready for large TFLite models

## 🚀 Deployment

### Build for Production
```bash
npm run build
# Output: dist/ folder
```

### Deploy To

- **Vercel:** Connect repository, auto-deploy on push
- **Netlify:** Drag & drop `dist/` folder or connect repo
- **GitHub Pages:** Commit `dist/` folder to `gh-pages` branch
- **AWS S3 + CloudFront:** Upload `dist/` contents
- **Docker:** Create containerized deployment

### Environment Setup
- ✅ No backend required
- ✅ No API keys needed
- ✅ All processing happens in browser
- ⏳ Optional: Serve TFLite model from CDN

## 🧪 Testing

### Test Upload Flow
1. Drag an image onto the upload area
2. Click "Recognize Text"
3. Watch progress bar update
4. View mock OCR results

### Test Camera
1. Click "Use Camera"
2. Grant camera permission
3. Click "Take Photo"
4. Image is processed

### Test Error States
- Upload unsupported file → Error toast
- Upload 20MB file → Size limit error
- Deny camera → Permission error message

## 🎓 For Developers Integrating TFLite

### Step 1: Install TensorFlow.js
```bash
npm install @tensorflow/tfjs @tensorflow/tfjs-tflite
```

### Step 2: Implement OCR Model
Replace the function in `src/services/ocrService.js` with your implementation.

### Step 3: Test with Real Data
Upload actual images and verify OCR results.

### Step 4: Optimize Performance
- Consider model quantization
- Use WebWorkers for inference
- Implement caching strategies

### Step 5: Deploy
```bash
npm run build && npm run preview
# Test locally, then deploy to production
```

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Camera not working | Check browser permissions in system settings |
| Build errors | `rm node_modules && npm install` |
| Styles not loading | Clear browser cache, restart dev server |
| Large files slow | Max size is 10MB (edit ImageUploader.jsx) |
| Port 5173 in use | `npm run dev -- --port 3000` |

## 📄 License

MIT - Feel free to use in your projects

## 🤝 Contributing

Contributions welcome! This project is optimized for:
- UI/UX improvements
- Accessibility enhancements
- New features
- Bug fixes
- Documentation

## 📞 Support

Check the documentation files:
1. **[QUICKSTART.md](./QUICKSTART.md)** - Quick setup & integration
2. **[PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md)** - Full documentation
3. **Component JSDoc comments** - Detailed component info

---

**Built with ❤️ for modern, browser-based OCR applications**

Ready to integrate your TFLite model? Start with [QUICKSTART.md](./QUICKSTART.md) 🚀
