# Browser-Based OCR UI - Project Documentation

## 🎯 Project Overview

**OCR Scanner** is a modern, professional browser-based application built with React + Vite for extracting text from images using OCR technology. This project provides a polished frontend UI designed for seamless integration with a TensorFlow Lite (TFLite) OCR model.

**Important:** This project focuses **exclusively on the UI/Frontend**. The OCR model integration point is isolated and documented for future implementation.

## 📁 Project Structure

```
src/
├── components/                    # Reusable React components
│   ├── Header.jsx                # Application header with branding
│   ├── ImageUploader.jsx          # Drag-and-drop file upload
│   ├── ImagePreview.jsx           # Image preview with metadata
│   ├── OCRButton.jsx              # Recognize Text button (main action)
│   ├── OCRResult.jsx              # Text result panel (editable textarea)
│   ├── LoadingState.jsx           # Loading spinner & progress bar
│   ├── CameraModal.jsx            # Camera capture modal
│   └── Toast.jsx                  # Toast notification system
│
├── pages/
│   └── OCRPage.jsx                # Main application page (container)
│
├── services/
│   └── ocrService.js              # OCR mock service (TFLite boundary)
│
├── App.jsx                        # Root component
├── main.jsx                       # React entry point
├── index.css                      # Global styling
└── App.css                        # Legacy styles (can be removed)

public/                           # Static assets

package.json                      # Dependencies & scripts
vite.config.js                    # Vite configuration
```

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ and npm

### Installation & Running

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev
# Opens at: http://localhost:5173/

# 3. Build for production
npm run build

# 4. Preview production build
npm run preview

# 5. Run linter
npm run lint
```

## ✨ Features & UI Components

### 1. **Header Component**
- Application branding: "OCR Scanner"
- Subtitle: "Extract text directly from your image"
- Professional gradient logo icon
- Sticky navigation bar with blur effect

### 2. **Image Input Area (ImageUploader)**
- **Drag & drop support** - Users can drag images onto the dropzone
- **Upload button** - Click to select images from filesystem
- **Camera button** - Opens camera capture modal
- **Supported formats:** JPG, JPEG, PNG, WEBP
- **Max file size:** 10MB
- **Visual feedback:** Hover and active states
- **Format/size information bar**

### 3. **Image Preview (ImagePreview)**
- Large preview container with dark background
- Image metadata display (filename, file size, dimensions)
- Remove/Change buttons
- Responsive sizing (max-height: 380px)
- Clean visual design

### 4. **OCR Action Button (OCRButton)**
- Large, prominent "Recognize Text" button
- **Disabled state:** When no image is selected
- **Loading state:** Shows spinner and "Processing OCR..." message
- **Prevents multiple clicks:** During processing
- Gradient styling for visual prominence

### 5. **Loading State (LoadingState)**
- Professional spinner animation
- Dynamic progress bar (0-100%)
- Progress message updates (e.g., "Preprocessing image...", "Running TFLite inference...")
- CPU inference indicator

### 6. **OCR Result Panel (OCRResult)**
- **Editable textarea** - Users can modify extracted text
- **Statistics badges:** Character count, word count, line count, confidence
- **Copy Text button** - Copy to clipboard with feedback ("Copied!")
- **Export TXT button** - Download extracted text as .txt file
- **Clear Result button** - Reset extracted text
- **Empty state** - Clean message when no text is extracted

### 7. **Camera Capture Modal (CameraModal)**
- Full-screen modal overlay
- Live camera stream feed
- Take Photo button
- Error handling for camera permissions
- Retry mechanism if camera fails
- Cancel button
- Responsive design

### 8. **Toast Notification System (Toast)**
- Bottom-right corner positioning
- Auto-dismiss (5s default, customizable)
- Types: success (green), error (red), info (blue)
- Slide-up animation
- Manual close button

## 🎨 Design System

### Color Palette
- **Primary Accent:** `#4f46e5` (Indigo)
- **Background:** `#f8fafc` (Light blue-gray)
- **Card Background:** `#ffffff` (White)
- **Text Primary:** `#0f172a` (Dark blue-gray)
- **Text Muted:** `#64748b` (Gray)
- **Success:** `#10b981` (Green)
- **Error:** `#ef4444` (Red)
- **Warning:** `#f59e0b` (Amber)

### Typography
- **Font Family:** Inter (system fallback)
- **Heading:** 600-700 font-weight
- **Body:** 400 font-weight
- **Monospace:** JetBrains Mono (for code/data)

### Spacing & Sizing
- **Radius:** 8px (sm), 12px (md), 16px (lg), 9999px (full)
- **Shadows:** Three levels (sm, md, lg)
- **Gap:** 0.75rem - 1.5rem
- **Padding:** 1-1.5rem (cards), 0.5-1rem (buttons)

### Responsive Breakpoints
- **Desktop:** Grid layout (2 columns, left/right)
- **Tablet (< 900px):** Transition to stacked layout
- **Mobile:** Full-width, vertically stacked

## 🔌 OCR Integration Boundary

### CRITICAL: Where to Connect the TFLite Model

The entire OCR inference logic is **isolated and replaceable** in a single file:

**File:** `src/services/ocrService.js`

**Current Implementation:**
```javascript
export async function recognizeText(imageSource, options = {}) {
  // MOCK IMPLEMENTATION - Replace this function
  // Currently returns sample text from MOCK_TEXT_SAMPLES array
  
  // Steps:
  // 1. Receives image (File, Blob, or Data URL)
  // 2. Reports progress via options.onProgress callback
  // 3. Returns object: { text, confidence, timingMs, wordCount, characterCount }
}
```

### How to Integrate Your TFLite Model

**Step 1:** Install TensorFlow.js with TFLite support
```bash
npm install @tensorflow/tfjs @tensorflow/tfjs-tflite
```

**Step 2:** Replace the `recognizeText()` function with your implementation:

```javascript
import * as tflite from '@tensorflow/tfjs-tflite';

let tfliteModel = null;

async function loadModel() {
  if (!tfliteModel) {
    tfliteModel = await tflite.loadTFLiteModel('/models/ocr_model.tflite');
  }
  return tfliteModel;
}

export async function recognizeText(imageSource, options = {}) {
  const { onProgress } = options;

  // 1. Load model
  if (onProgress) onProgress('Loading TFLite model...', 10);
  const model = await loadModel();

  // 2. Preprocess image
  if (onProgress) onProgress('Preprocessing image...', 30);
  const imageTensor = preprocessImage(imageSource); // Your preprocessing logic

  // 3. Run inference
  if (onProgress) onProgress('Running inference...', 60);
  const output = model.predict(imageTensor);

  // 4. Decode output
  if (onProgress) onProgress('Decoding text...', 90);
  const text = decodeOutput(output); // Your decoding logic (CTC decode, etc.)

  // 5. Return results
  return {
    text,
    confidence: 0.95,
    timingMs: 2000,
    wordCount: text.split(/\s+/).length,
    characterCount: text.length
  };
}
```

**Step 3:** The UI will **automatically work** with your new implementation without any changes needed!

### Service Contract

The UI components only call this function:

```javascript
await recognizeText(imageFile, { 
  onProgress: (statusMessage, percentComplete) => { ... }
})
```

Returns:
```javascript
{
  text: string,              // The extracted text
  confidence: number,        // 0.0 to 1.0 confidence score
  timingMs: number,          // Inference time in milliseconds
  wordCount: number,         // Word count
  characterCount: number     // Character count
}
```

## 🎯 UI States & Workflows

### Workflow 1: Upload & OCR
1. User drags image or clicks "Upload Image"
2. Validation checks (format, size)
3. Image previewed on left
4. "Recognize Text" button becomes enabled
5. Click button → Loading state appears
6. Progress updates shown
7. Result displayed in textarea
8. User can copy, edit, or export

### Workflow 2: Camera Capture
1. User clicks "Use Camera"
2. Camera modal opens, stream starts
3. User clicks "Take Photo"
4. Modal closes, photo appears as preview
5. Same as "Upload & OCR" from step 4

### Error States Handled
- Unsupported file format → Toast error
- File too large (>10MB) → Toast error
- Camera permission denied → Modal error message + Retry button
- Camera unavailable → Clear error message
- OCR processing failed → Toast error

### Empty States
- No image selected → Upload area with instructions
- OCR completed, result displayed → Stats badges, textarea, action buttons
- No text extracted yet → "No text extracted yet" message in result panel

## 🏗️ Technical Details

### Technologies Used
- **React 19.2** - UI framework
- **Vite 8.2** - Build tool & dev server
- **Lucide React 1.31** - Icon library
- **CSS Variables** - Theming & consistency

### Performance Optimizations
- Component code-splitting ready (Vite)
- Minimal dependencies (only lucide-react)
- Efficient re-rendering (proper dependency arrays, useCallback)
- Large file warning before upload
- Progress reporting during inference

### Browser Compatibility
- Modern browsers with:
  - FileReader API
  - Canvas API
  - MediaDevices API (camera)
  - CSS Grid & Flexbox
  - CSS Custom Properties

### Accessibility Features
- Semantic HTML
- ARIA labels on buttons
- Keyboard navigation support
- Focus visible states on buttons
- Proper color contrast
- Alt text on images

## 📦 Dependencies

```json
{
  "dependencies": {
    "react": "^19.2.8",
    "react-dom": "^19.2.8",
    "lucide-react": "^1.31.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^6.0.4",
    "vite": "^8.2.0",
    "oxlint": "^1.75.0"
  }
}
```

**Why these dependencies?**
- React: Core UI framework (minimal bundle impact)
- Lucide React: Beautiful, consistent icons (SVG-based, tree-shakeable)
- Vite: Lightning-fast dev experience and production builds
- No heavy dependencies: No axios, lodash, etc. (keep it light for browser-based ML)

## 🧪 Testing & Development

### Development Workflow
```bash
npm run dev          # Start dev server with HMR
npm run build        # Production build
npm run lint         # Check code quality
npm run preview      # Test production build locally
```

### Mock Data Testing
The app includes 4 sample mock responses to test different UI states:
1. Document sample
2. Store receipt
3. Technical code snippet
4. Business card

Click "Recognize Text" multiple times to cycle through samples.

## 📱 Responsive Design Behavior

### Desktop (≥900px)
- **Layout:** 2-column grid
- **Left column:** Image upload/preview + OCR button
- **Right column:** OCR result panel

### Tablet (600-900px)
- **Layout:** 1-column, stacked
- **Full-width cards**
- **Adjusted padding for touch**

### Mobile (<600px)
- **Layout:** Single column, full width
- **Optimized touch targets (min 44px)**
- **Simplified modals**
- **Full-screen camera modal**

## 🔐 Security Considerations

- All image processing happens **locally in the browser**
- No data sent to external servers
- File type validation before processing
- Canvas-based image manipulation (no raw blob uploads)
- Safe DOM rendering (React automatic XSS prevention)

## 🚀 Deployment

### Building for Production
```bash
npm run build
# Output: dist/ folder with optimized build
```

### Deployment Options
- **Vercel:** `npm run build` → Deploy `dist/` folder
- **Netlify:** Connect repository, auto-deploy on push
- **GitHub Pages:** `npm run build` → Commit `dist/` folder
- **Docker:** Create Dockerfile for containerized deployment
- **Static hosting:** Upload `dist/` to any static host (AWS S3, Cloudflare Pages, etc.)

### Environment Setup
- No backend required
- No API keys needed (local inference)
- Optional: Serve TFLite model from CDN or `/public` folder

## 📝 Development Notes

### Code Quality
- ESLint configured (via oxlint)
- All warnings resolved
- Proper React hooks usage
- No unused imports or variables

### Component Organization
- Single responsibility principle
- Props-based configuration
- Callback-based communication
- Clean separation of concerns

### Styling Approach
- CSS Custom Properties for theming
- BEM-like naming convention
- Mobile-first responsive design
- No CSS-in-JS (pure CSS for performance)

## 🎓 Learning Resources

### For UI Developers
- React Hooks documentation
- Vite plugin system
- CSS Grid & Flexbox
- Web APIs (FileReader, Canvas, MediaDevices)

### For ML/OCR Integration
- TensorFlow.js documentation
- TFLite for Web guide
- Image preprocessing techniques
- CTC decoding (for sequence-to-sequence models)

## 🐛 Troubleshooting

### Build Issues
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Camera Permission Issues
- Chrome/Edge: Check browser camera settings
- Firefox: Grant camera permission in about:config
- Safari: Check system Settings → Privacy → Camera

### Large File Uploads Slow
- File size limit is 10MB (configurable in ImageUploader.jsx)
- Consider image compression before upload
- Adjust MAX_FILE_SIZE_BYTES constant if needed

## 📄 License & Contribution

This project is ready for GitHub and open-source contribution. Contributions welcome for:
- UI improvements
- Accessibility enhancements
- New image filters/effects
- Browser compatibility fixes
- Documentation improvements

## ✅ Project Status

- ✅ Frontend UI Complete
- ✅ All components implemented
- ✅ Responsive design tested
- ✅ Mock OCR service ready for integration
- ✅ Production build verified
- ✅ Linting passed
- ⏳ TFLite model integration (future)
- ⏳ Backend API (if needed, future)
- ⏳ Database (if needed, future)

## 🔄 Next Steps for Integration

### To add TFLite OCR:
1. Install TF.js packages
2. Load your OCR model
3. Replace `recognizeText()` in `src/services/ocrService.js`
4. Test with actual images
5. Optimize model performance (quantization, etc.)

### To deploy:
1. `npm run build`
2. Deploy `dist/` folder to hosting platform
3. Serve TFLite model from appropriate location
4. Test in production environment

---

**Built with ❤️ for modern browser-based OCR applications**
