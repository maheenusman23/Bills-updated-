// Upload validation: (1) technical checks at upload time (type/size/corruption), and
// (2) content-relevance checks after OCR (does this actually look like a medical/billing/
// legal document?). Both are plain heuristics/regex — no model call, no API key.

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
export const ACCEPTED_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/tiff", "application/pdf"]);

const MAGIC_BYTES: Record<string, (buf: Buffer) => boolean> = {
  "image/jpeg": (b) => b.length > 2 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/jpg": (b) => b.length > 2 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) => b.length > 7 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/webp": (b) => b.length > 11 && b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP",
  "image/tiff": (b) => b.length > 3 && ((b[0] === 0x49 && b[1] === 0x49) || (b[0] === 0x4d && b[1] === 0x4d)),
  "application/pdf": (b) => b.length > 4 && b.subarray(0, 5).toString("ascii") === "%PDF-",
};

export interface TechnicalValidationResult {
  valid: boolean;
  reason?: string;
}

/** Checks file type, size, and that the bytes' magic number actually matches the declared mime type (catches corrupted/mislabeled uploads). */
export function validateFileTechnical(buffer: Buffer, mimeType: string, sizeBytes: number): TechnicalValidationResult {
  if (sizeBytes <= 0) return { valid: false, reason: "File is empty." };
  if (sizeBytes > MAX_FILE_SIZE_BYTES) return { valid: false, reason: `File exceeds the ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB size limit.` };
  if (!ACCEPTED_MIME_TYPES.has(mimeType)) {
    return { valid: false, reason: `Unsupported file type "${mimeType}". Only images (JPG/PNG/WEBP/TIFF) and PDF files are accepted.` };
  }
  const magicCheck = MAGIC_BYTES[mimeType];
  if (magicCheck && !magicCheck(buffer)) {
    return { valid: false, reason: "File content doesn't match its declared type — the file may be corrupted or mislabeled." };
  }
  return { valid: true };
}

export interface ContentValidationResult {
  valid: boolean;
  reason?: string;
  signalsFound: string[];
}

const CPT_CODE_PATTERN = /\b\d{5}\b/g;
const ICD10_PATTERN = /\b[A-TV-Z][0-9][0-9AB](?:\.[0-9A-TV-Z]{1,4})?\b/g;
const DOLLAR_AMOUNT_PATTERN = /\$\s?\d[\d,]*\.?\d{0,2}/g;
const RELEVANT_KEYWORDS = [
  "patient", "diagnosis", "provider", "invoice", "insurance", "claim", "bill", "billing",
  "medical", "treatment", "procedure", "amount due", "balance", "statement", "hospital",
  "clinic", "physician", "date of service", "cpt", "icd", "copay", "deductible", "eob",
  "explanation of benefits", "account number", "charges", "payment", "denial", "appeal",
];

/**
 * Heuristically checks OCR'd text for signals that this is genuinely a medical bill /
 * insurance / legal document, not an unrelated upload. Requires at least 2 independent
 * signal categories (code pattern, dollar amount, keyword hits) to pass — a single stray
 * match (e.g. one dollar sign) shouldn't be enough on its own.
 */
export function validateContentRelevance(ocrText: string): ContentValidationResult {
  const text = (ocrText || "").trim();
  if (text.length < 20) {
    return { valid: false, reason: "Extracted text is too short to be a valid document — the scan may be blank, unreadable, or unrelated.", signalsFound: [] };
  }

  const signalsFound: string[] = [];
  const cptMatches = text.match(CPT_CODE_PATTERN) || [];
  const icdMatches = text.match(ICD10_PATTERN) || [];
  const dollarMatches = text.match(DOLLAR_AMOUNT_PATTERN) || [];
  const lowerText = text.toLowerCase();
  const keywordHits = RELEVANT_KEYWORDS.filter((kw) => lowerText.includes(kw));

  if (cptMatches.length > 0) signalsFound.push(`${cptMatches.length} CPT-code-like number(s)`);
  if (icdMatches.length > 0) signalsFound.push(`${icdMatches.length} ICD-10-like code(s)`);
  if (dollarMatches.length > 0) signalsFound.push(`${dollarMatches.length} dollar amount(s)`);
  if (keywordHits.length > 0) signalsFound.push(`keywords: ${keywordHits.slice(0, 5).join(", ")}`);

  const categoriesHit = [cptMatches.length > 0 || icdMatches.length > 0, dollarMatches.length > 0, keywordHits.length >= 2].filter(Boolean).length;

  if (categoriesHit < 2) {
    return {
      valid: false,
      reason: "This file doesn't appear to be a medical bill, insurance document, or legal record — no billing codes, dollar amounts, or relevant terminology were detected in the extracted text.",
      signalsFound,
    };
  }

  return { valid: true, signalsFound };
}
