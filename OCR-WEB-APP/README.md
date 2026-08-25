# Offline OCR Web App

Fully offline OCR supporting:

- **English** (best accuracy)
- **Tamil** (best accuracy)
- **Hindi**
- **Chinese**
- **Japanese**

Built with **React + Vite + ppu-paddle-ocr + ONNX Runtime Web**.

All inference runs in the browser. No cloud APIs.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

---

## Usage

1. Select the language (English / Tamil / Hindi / Chinese-Japanese).
2. Upload or drop an image.
3. Wait for the result (first run downloads the model — later runs are offline).

---

## Language Models Used

| Language              | Model                      |
|-----------------------|----------------------------|
| English               | `V5_EN_MOBILE_MODEL`       |
| Tamil                 | `V5_TAMIL_MOBILE_MODEL`    |
| Hindi                 | `V5_DEVANAGARI_MOBILE_MODEL` |
| Chinese + Japanese    | `V6_SMALL_MODEL`           |

---

## Build for Production

```bash
npm run build
```

The output will be in the `dist/` folder. You can serve it with any static host.

---

## Notes

- First time you select a language, the corresponding model is downloaded and cached by the browser.
- After that, the app works fully offline.
- For best results on Tamil and English, always select the matching language option.
