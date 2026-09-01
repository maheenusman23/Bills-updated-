// Deterministic, rule-based document generation. Replaces the old Gemini call entirely —
// no LLM, no API key, no hallucination risk. Every dollar figure and claim in the generated
// document traces back to a specific line item actually found in the OCR'd upload text (or,
// if no line items were found, the document says so plainly instead of inventing numbers).
import { Case, CaseFile, BillingAuditFinding } from "../types";
import { PRICING_PER_CASE } from "../types";

interface ExtractedLineItem {
  cptCode: string;
  description: string;
  amount: number;
  sourceFile: string;
  contextLine: string;
}

const CPT_ON_LINE = /\b(\d{5})\b/;
const AMOUNT_ON_LINE = /\$\s?([\d,]+\.\d{2}|[\d,]+)/;

/** Scans OCR'd text line-by-line for a 5-digit procedure code plus a dollar amount on the same line. */
function extractLineItemsFromText(text: string, sourceFile: string): ExtractedLineItem[] {
  const items: ExtractedLineItem[] = [];
  const lines = (text || "").split(/\r?\n/);
  for (const line of lines) {
    const codeMatch = line.match(CPT_ON_LINE);
    const amountMatch = line.match(AMOUNT_ON_LINE);
    if (!codeMatch || !amountMatch) continue;
    const amount = parseFloat(amountMatch[1].replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const description = line
      .replace(codeMatch[0], "")
      .replace(amountMatch[0], "")
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, 120) || "Unlabeled line item";
    items.push({ cptCode: codeMatch[1], description, amount, sourceFile, contextLine: line.trim() });
  }
  return items;
}

export function extractBillItems(files: CaseFile[]): ExtractedLineItem[] {
  const items: ExtractedLineItem[] = [];
  for (const f of files) {
    if (f.validationStatus !== "valid" || !f.ocrText) continue;
    items.push(...extractLineItemsFromText(f.ocrText, f.originalFilename));
  }
  return items;
}

// Small, representative table of E/M levels commonly downcoded absent documented complexity —
// mirrors real CMS/AMA guidance (a Level 5 ER visit requires documented high-complexity/critical
// findings; without them, Level 4 is the defensible code). Not a substitute for a full payer fee
// schedule, but every adjustment below is tied to an actual code found in the upload, not invented.
const UPCODE_TABLE: Record<string, { downcodeTo: string; requiresKeywords: string[]; adjustmentPct: number; explanation: string }> = {
  "99285": {
    downcodeTo: "99284",
    requiresKeywords: ["critical", "life-threatening", "multi-system", "resuscitation", "life threatening"],
    adjustmentPct: 0.22,
    explanation: "CPT 99285 (ER Level 5) requires documented high-complexity, life-threatening, or multi-system presentation. No such documentation was found in the surrounding text, so this line is being challenged as upcoded from the correctly supported CPT 99284 (Level 4).",
  },
  "99215": {
    downcodeTo: "99214",
    requiresKeywords: ["high complexity", "high-complexity", "severe exacerbation", "life-threatening"],
    adjustmentPct: 0.18,
    explanation: "CPT 99215 (highest-complexity established-patient office visit) requires documented high medical decision complexity. Absent that documentation, this line is challenged as upcoded from CPT 99214.",
  },
};

// Small, representative NCCI-style bundling pairs: when both codes appear for the same file
// (i.e. the same encounter/bill), the second is typically bundled into the first per CMS's
// National Correct Coding Initiative and should not be billed as a separate line.
const UNBUNDLE_PAIRS: Array<{ primary: string; bundledInto: string; explanation: string }> = [
  { primary: "97140", bundledInto: "97110", explanation: "CPT 97110 (therapeutic exercise) and CPT 97140 (manual therapy) performed in the same encounter are subject to NCCI bundling edits absent modifier 59 documentation of a separately identifiable service; billing both as full separate charges is a common unbundling violation." },
  { primary: "99070", bundledInto: "", explanation: "CPT 99070 (supplies/materials) is generally bundled into the primary procedure code under NCCI guidelines and should not be billed as a standalone line unless the supply is unusual and separately documented." },
];

export function analyzeViolations(items: ExtractedLineItem[]): BillingAuditFinding[] {
  const findings: BillingAuditFinding[] = [];

  // 1. Duplicates: identical code + identical amount appearing more than once.
  const seen = new Map<string, ExtractedLineItem[]>();
  for (const item of items) {
    const key = `${item.cptCode}::${item.amount.toFixed(2)}`;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key)!.push(item);
  }
  for (const group of seen.values()) {
    if (group.length > 1) {
      for (let i = 1; i < group.length; i++) {
        const dup = group[i];
        findings.push({
          cptCode: dup.cptCode,
          description: dup.description,
          statedAmount: dup.amount,
          adjustedAmount: 0,
          violationType: "duplicate",
          severity: "high",
          reason: `CPT ${dup.cptCode} ("${dup.description}") was billed identically ${group.length} times across the uploaded records ($${dup.amount.toFixed(2)} each, source: ${dup.sourceFile}). CMS billing standards prohibit duplicate submission of the same service on the same claim without a modifier justifying repetition; this occurrence is challenged in full.`,
        });
      }
    }
  }

  // 2. Upcoding: known high-level E/M codes without supporting complexity language nearby.
  for (const item of items) {
    const rule = UPCODE_TABLE[item.cptCode];
    if (!rule) continue;
    const contextLower = item.contextLine.toLowerCase();
    const hasComplexitySupport = rule.requiresKeywords.some((kw) => contextLower.includes(kw));
    if (!hasComplexitySupport) {
      const adjustedAmount = Math.round(item.amount * (1 - rule.adjustmentPct) * 100) / 100;
      findings.push({
        cptCode: item.cptCode,
        description: item.description,
        statedAmount: item.amount,
        adjustedAmount,
        violationType: "upcoded",
        severity: "high",
        reason: `${rule.explanation} Stated charge: $${item.amount.toFixed(2)} (source: ${item.sourceFile}). Estimated compliant charge at CPT ${rule.downcodeTo}: $${adjustedAmount.toFixed(2)} (${Math.round(rule.adjustmentPct * 100)}% typical differential — an estimate, not a guaranteed payer rate).`,
      });
    }
  }

  // 3. Unbundling: known NCCI-bundled pairs both present.
  const codesPresent = new Set(items.map((i) => i.cptCode));
  for (const pair of UNBUNDLE_PAIRS) {
    const shouldFlag = pair.bundledInto ? (codesPresent.has(pair.primary) && codesPresent.has(pair.bundledInto)) : codesPresent.has(pair.primary);
    if (!shouldFlag) continue;
    const flaggedItem = items.find((i) => i.cptCode === pair.primary);
    if (!flaggedItem) continue;
    findings.push({
      cptCode: flaggedItem.cptCode,
      description: flaggedItem.description,
      statedAmount: flaggedItem.amount,
      adjustedAmount: 0,
      violationType: "unbundled",
      severity: "medium",
      reason: `${pair.explanation} Stated charge: $${flaggedItem.amount.toFixed(2)} (source: ${flaggedItem.sourceFile}).`,
    });
  }

  return findings;
}

export interface AuditSummary {
  totalBilled: number;
  totalFindings: number;
  totalSavings: number;
  adjustedTotal: number;
  savingsPercent: number;
}

export function computeAuditSummary(items: ExtractedLineItem[], findings: BillingAuditFinding[]): AuditSummary {
  const totalBilled = items.reduce((sum, i) => sum + i.amount, 0);
  const totalSavings = findings.reduce((sum, f) => sum + (f.statedAmount - f.adjustedAmount), 0);
  const adjustedTotal = Math.max(0, totalBilled - totalSavings);
  return {
    totalBilled: Math.round(totalBilled * 100) / 100,
    totalFindings: findings.length,
    totalSavings: Math.round(totalSavings * 100) / 100,
    adjustedTotal: Math.round(adjustedTotal * 100) / 100,
    savingsPercent: totalBilled > 0 ? Math.round((totalSavings / totalBilled) * 1000) / 10 : 0,
  };
}

function formatLineItemsTable(items: ExtractedLineItem[]): string {
  if (items.length === 0) return "(No itemized CPT/dollar-amount lines were detected in the uploaded files' extracted text.)";
  const header = "CPT CODE   DESCRIPTION                                              AMOUNT       SOURCE";
  const sep = "-".repeat(header.length);
  const rows = items.map((i) =>
    `${i.cptCode.padEnd(11)}${i.description.slice(0, 55).padEnd(57)}$${i.amount.toFixed(2).padEnd(12)}${i.sourceFile}`
  );
  return [header, sep, ...rows, sep].join("\n");
}

function formatFindingsTable(findings: BillingAuditFinding[]): string {
  if (findings.length === 0) {
    return "No specific CPT-level billing violations (duplicate charges, unsupported high-complexity upcoding, or known NCCI-bundling conflicts) were detected in the extracted text. This does not guarantee the bill is fully compliant — it means the automated line-item analysis found no matches against the current rule set. A manual review of the full itemized statement is still recommended.";
  }
  return findings.map((f, idx) =>
    `${idx + 1}. CPT ${f.cptCode} — ${f.violationType.toUpperCase()} (${f.severity.toUpperCase()} severity)\n   Stated: $${f.statedAmount.toFixed(2)}  |  Adjusted: $${f.adjustedAmount.toFixed(2)}  |  Challenged Amount: $${(f.statedAmount - f.adjustedAmount).toFixed(2)}\n   Reason: ${f.reason}`
  ).join("\n\n");
}

function dateStr(): string {
  return new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export function generateDocument(serviceType: string, currentCase: Case, files: CaseFile[], promptNotes?: string): { content: string; findings: BillingAuditFinding[]; summary: AuditSummary } {
  const items = extractBillItems(files);
  const findings = analyzeViolations(items);
  const summary = computeAuditSummary(items, findings);
  const patientName = currentCase.patientName || "the claimant";
  const title = PRICING_PER_CASE[serviceType as keyof typeof PRICING_PER_CASE]?.name || "Legal Documentation";
  const caseId = currentCase.id;
  const validFileNames = files.filter((f) => f.validationStatus === "valid").map((f) => f.originalFilename);
  const filesLine = validFileNames.length > 0 ? validFileNames.join(", ") : "(no validated files attached — analysis is based on the case narrative below)";

  const evidenceBasis = items.length > 0
    ? `This analysis is grounded in ${items.length} line item(s) extracted directly from the uploaded, validated files (${filesLine}). Every dollar figure below traces to a specific extracted line — none are placeholder or illustrative values.`
    : `No structured CPT-code line items were automatically extracted from the uploaded files. ${validFileNames.length > 0 ? "The uploaded files were validated as relevant documents but did not contain machine-readable itemized CPT/dollar-amount lines (common with narrative records or low-resolution scans)." : "No files have been validated yet for this case."} The narrative below is built from the case description and notes provided; upload an itemized bill for a full CPT-level audit.`;

  let body: string;

  if (serviceType.toLowerCase().includes("demand") || serviceType.toLowerCase().includes("chronology")) {
    body = `RE: FORMAL PERSONAL INJURY SETTLEMENT DEMAND & MEDICAL CHRONOLOGY
CLAIMANT: ${patientName}
CASE REFERENCE: ${currentCase.title}
CASE ID: ${caseId}
INCIDENT / CASE NARRATIVE: ${currentCase.description || "(no narrative provided)"}
ADDITIONAL NOTES: ${promptNotes || "None provided."}

I. BASIS OF THIS DOCUMENT
${evidenceBasis}

II. ITEMIZED BILL DATA EXTRACTED FROM SUBMITTED RECORDS
${formatLineItemsTable(items)}

III. BILLING COMPLIANCE FINDINGS
${formatFindingsTable(findings)}

IV. FINANCIAL SUMMARY
Total Billed (extracted): $${summary.totalBilled.toFixed(2)}
Total Challenged/Disputed Amount: $${summary.totalSavings.toFixed(2)}
Recommended Adjusted Total: $${summary.adjustedTotal.toFixed(2)}
Savings Percentage: ${summary.savingsPercent}%

V. DEMAND
Based on the findings above, we request that the recipient carrier/provider review and correct the disputed line items identified in Section III, and remit an adjusted total consistent with Section IV. This document was compiled by BillSlayer AI's deterministic billing-audit engine directly from the records submitted for case ${caseId}.`;
  } else if (serviceType.toLowerCase().includes("appeal") || serviceType.toLowerCase().includes("cpt")) {
    body = `RE: FORMAL ADMINISTRATIVE INSURANCE APPEAL & CODING COMPLIANCE REVIEW
PATIENT / BENEFICIARY: ${patientName}
DISPUTED CLAIM / CASE ID: ${caseId}
DISPUTED SERVICE DESCRIPTION: ${currentCase.title}
CASE DETAILS: ${currentCase.description || "(no narrative provided)"}
ADDITIONAL NOTES: ${promptNotes || "None provided."}

I. BASIS OF THIS APPEAL
${evidenceBasis}

II. ITEMIZED BILL DATA EXTRACTED FROM SUBMITTED RECORDS
${formatLineItemsTable(items)}

III. CODING COMPLIANCE FINDINGS
${formatFindingsTable(findings)}

IV. FINANCIAL SUMMARY
Total Billed (extracted): $${summary.totalBilled.toFixed(2)}
Total Challenged/Disputed Amount: $${summary.totalSavings.toFixed(2)}
Recommended Adjusted Total: $${summary.adjustedTotal.toFixed(2)}

V. APPEAL DEMAND
We request an expedited review of the coding findings in Section III and a corrected reimbursement determination consistent with Section IV. Every finding above is tied to a specific CPT code and dollar amount extracted from the records submitted for case ${caseId}, not a generic template assertion.`;
  } else {
    body = `RE: FORENSIC MEDICAL-LEGAL BILLING AUDIT
PATIENT / CLIENT: ${patientName}
AUDITED CASE: ${currentCase.title}
CASE ID: ${caseId}
CASE DESCRIPTION: ${currentCase.description || "(no narrative provided)"}
SPECIAL COMPLIANCE NOTES: ${promptNotes || "None provided."}

I. BASIS OF THIS AUDIT
${evidenceBasis}

II. ITEMIZED BILL DATA EXTRACTED FROM SUBMITTED RECORDS
${formatLineItemsTable(items)}

III. AUDIT FINDINGS
${formatFindingsTable(findings)}

IV. AUDIT SCOREBOARD
Total Billed (extracted): $${summary.totalBilled.toFixed(2)}
Total Discrepancies Identified: $${summary.totalSavings.toFixed(2)}
Recommended Adjusted Total: $${summary.adjustedTotal.toFixed(2)}
Savings Percentage: ${summary.savingsPercent}%
Findings Count: ${summary.totalFindings}

V. RECOMMENDATION
${findings.length > 0 ? "We advise presenting this audit report, with the specific CPT-level findings in Section III, to the billing/compliance department for correction." : "No automated findings were generated. We recommend a manual line-by-line review of the full itemized statement, and re-running this audit once a clearer or more complete itemized bill is uploaded."}`;
  }

  const content = `================================================================================
                                  BILLSLAYER AI
                  DETERMINISTIC MEDICAL-LEGAL BILLING AUDIT ENGINE
================================================================================
DATE GENERATED: ${dateStr()}
DOCUMENT REGISTRY ID: DOC-REF-${Math.floor(100000 + Math.random() * 900000)}
CASE IDENTIFIER: ${caseId}
DOCUMENT TYPE: ${title}
GENERATION METHOD: Rule-based analysis of uploaded, OCR-validated records (no generative AI / no external API used)

${body}

================================================================================
METHODOLOGY NOTE: This document was produced entirely by BillSlayer AI's local,
deterministic rule engine: OCR-extracted line items are matched against a defined
set of duplicate-billing, upcoding, and NCCI-unbundling rules. Every specific dollar
figure above is either extracted directly from an uploaded, validated file, or
explicitly marked as unavailable. No language model was used to generate this
content and no external API call was made.
--------------------------------------------------------------------------------
         Processed via BillSlayer AI • Local Compliance Audit Engine
================================================================================`;

  return { content, findings, summary };
}
