import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';

// Use a CDN worker as fallback; this works in the browser environment used by Vite.
// You can replace this with an imported worker if you prefer bundling the worker.
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

export async function pdfFileToImages(file, { scale = 1.5, maxPages = 20 } = {}) {
  if (!file) return [];

  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const pageCount = Math.min(pdf.numPages, maxPages);
    const images = [];

    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);

      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) {
        throw new Error('Unable to generate image from PDF page.');
      }

      const imageFile = new File(
        [blob],
        `${file.name.replace(/\.pdf$/i, '')}_page_${i}.png`,
        { type: 'image/png' }
      );
      images.push(imageFile);
    }

    return images;
  } catch (error) {
    console.error('PDF conversion failed:', error);
    throw error;
  }
}
