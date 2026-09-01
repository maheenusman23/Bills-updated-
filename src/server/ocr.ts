import Tesseract from "tesseract.js";

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/tiff"]);
const PDF_MIME_TYPE = "application/pdf";

export function ocrSupportedMimeType(mimeType: string): boolean {
  return IMAGE_MIME_TYPES.has(mimeType) || mimeType === PDF_MIME_TYPE;
}

async function ocrImageBuffer(buffer: Buffer): Promise<string> {
  const { data } = await Tesseract.recognize(buffer, "eng");
  return data.text || "";
}

/** Rasterizes each PDF page to a PNG buffer using pdfjs-dist + a Node canvas backend (no Poppler/system deps). */
async function rasterizePdfPages(buffer: Buffer): Promise<Buffer[]> {
  const { createCanvas } = await import("@napi-rs/canvas");
  const pdfjsLib: any = await import("pdfjs-dist/legacy/build/pdf.mjs");

  class NodeCanvasFactory {
    create(width: number, height: number) {
      const canvas = createCanvas(width, height);
      const context = canvas.getContext("2d");
      return { canvas, context };
    }
    reset(canvasAndContext: any, width: number, height: number) {
      canvasAndContext.canvas.width = width;
      canvasAndContext.canvas.height = height;
    }
    destroy(canvasAndContext: any) {
      canvasAndContext.canvas.width = 0;
      canvasAndContext.canvas.height = 0;
      canvasAndContext.canvas = null;
      canvasAndContext.context = null;
    }
  }

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer), disableFontFace: true });
  const pdfDoc = await loadingTask.promise;
  const canvasFactory = new NodeCanvasFactory();
  const pageBuffers: Buffer[] = [];

  try {
    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvasAndContext = canvasFactory.create(viewport.width, viewport.height);
      await page.render({
        canvasContext: canvasAndContext.context,
        viewport,
        canvasFactory,
      } as any).promise;
      pageBuffers.push(canvasAndContext.canvas.toBuffer("image/png"));
      canvasFactory.destroy(canvasAndContext);
    }
  } finally {
    await pdfDoc.destroy();
  }

  return pageBuffers;
}

/**
 * Extracts text from an uploaded file's bytes. Images go straight to Tesseract; PDFs are
 * rasterized page-by-page first (Tesseract can't read PDFs directly), then each page is OCR'd
 * and joined with page separators. Anything else is not attempted — caller should mark it
 * ocr_status='skipped'.
 */
export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === PDF_MIME_TYPE) {
    const pages = await rasterizePdfPages(buffer);
    const texts = await Promise.all(pages.map((p) => ocrImageBuffer(p)));
    return texts.map((t, i) => `--- Page ${i + 1} ---\n${t}`).join("\n\n");
  }
  if (IMAGE_MIME_TYPES.has(mimeType)) {
    return ocrImageBuffer(buffer);
  }
  throw new Error(`Unsupported mime type for OCR: ${mimeType}`);
}
