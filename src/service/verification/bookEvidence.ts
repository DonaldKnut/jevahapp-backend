import logger from "../../utils/logger";
import { getEvidenceProfile } from "../moderation/evidenceProfile";

export async function processBookContent(
  fileBuffer: Buffer,
  fileMimeType: string,
  uploadId: string,
  reportProgress: (progress: number, stage: string, message: string) => void,
  onComplete: (text: string) => void
): Promise<void> {
  reportProgress(20, "validating", "Validating book format...");

  let text = "";

  try {
    const profile = getEvidenceProfile("books", fileMimeType);
    let fullText = "";
    if (fileMimeType === "application/pdf") {
      reportProgress(30, "analyzing", "Extracting text from PDF...");
      fullText = await extractTextFromPDF(fileBuffer);
    } else if (fileMimeType === "application/epub+zip") {
      reportProgress(30, "analyzing", "Extracting text from EPUB...");
      fullText = await extractTextFromEPUB(fileBuffer);
    } else {
      logger.warn("Unsupported book file type", { fileMimeType, uploadId });
    }

    // Distributed windows across the whole book — not only the opening pages
    text = sampleDistributedText(fullText, profile.maxTextChars, profile.textWindows);
    logger.info("Book text sampling completed", {
      textLength: text.length,
      fullLength: fullText.length,
      uploadId,
    });
  } catch (error: any) {
    logger.warn("Book text extraction failed:", error);
  }

  reportProgress(70, "analyzing", "Processing complete!");

  onComplete(text);
}

export function sampleDistributedText(
  fullText: string,
  maxChars: number,
  windows: number
): string {
  const cleaned = (fullText || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  if (cleaned.length <= maxChars) return cleaned;
  const n = Math.max(1, windows);
  const per = Math.floor(maxChars / n);
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const start = Math.floor((i / Math.max(1, n - 1)) * Math.max(0, cleaned.length - per));
    parts.push(cleaned.slice(start, start + per));
  }
  return parts.join(" … ");
}

export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  try {
    // Dynamic import for pdf-parse
    const pdfParseModule = await new Function('return import("pdf-parse")')();
    const { PDFParse } = pdfParseModule;

    const pdfParser = new PDFParse({ data: pdfBuffer });
    const textResult = await pdfParser.getText();
    await pdfParser.destroy();

    let fullText = "";
    if (textResult.pages && textResult.pages.length > 0) {
      fullText = textResult.pages
        .map((pageData: any) => pageData.text || "")
        .join("\n");
    } else if (textResult.text) {
      fullText = textResult.text;
    }

    fullText = fullText.replace(/\s+/g, " ").trim();
    return fullText.substring(0, 10000);
  } catch (error: any) {
    logger.error("Failed to extract text from PDF", { error: error.message });
    return "";
  }
}

export async function extractTextFromEPUB(epubBuffer: Buffer): Promise<string> {
  try {
    const JSZip = await import("jszip" as any).catch(() => null);
    if (!JSZip) {
      logger.warn("JSZip not available, EPUB text extraction will be limited");
      return "";
    }

    const zip = new JSZip.default();
    const zipData = await zip.loadAsync(epubBuffer);

    let fullText = "";
    const contentFiles: string[] = [];

    zipData.forEach((relativePath: string, file: any) => {
      if (
        !file.dir &&
        (relativePath.endsWith(".html") ||
          relativePath.endsWith(".xhtml") ||
          relativePath.endsWith(".htm")) &&
        !relativePath.includes("META-INF") &&
        !relativePath.includes("mimetype")
      ) {
        contentFiles.push(relativePath);
      }
    });

    // Limit to first 5 files for speed
    for (const filePath of contentFiles.slice(0, 5)) {
      try {
        const fileContent = await zipData.file(filePath)?.async("string");
        if (fileContent) {
          const textContent = fileContent
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();

          if (textContent) {
            fullText += textContent + "\n";
          }
        }
      } catch (error) {
        logger.warn(`Failed to extract text from EPUB file: ${filePath}`, error);
      }
    }

    fullText = fullText.trim();
    return fullText ? fullText.substring(0, 10000) : "";
  } catch (error: any) {
    logger.error("Failed to extract text from EPUB", { error: error.message });
    return "";
  }
}
