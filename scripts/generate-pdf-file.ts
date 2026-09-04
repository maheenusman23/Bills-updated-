// Renders a GeneratedDocument to an actual .pdf file on disk using the exact same jsPDF layout
// logic as src/lib/pdfGenerator.ts's downloadAsPDF() (which is browser-only, uses pdf.save()).
// This is a one-off script to hand a real generated document to the user as a file — not part
// of the app itself.
import { jsPDF } from "jspdf";
import fs from "fs";

const doc = JSON.parse(fs.readFileSync("scripts/.walkthrough-screenshots/generated-document-v2.json", "utf-8"));

const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
const pageWidth = pdf.internal.pageSize.getWidth();
const pageHeight = pdf.internal.pageSize.getHeight();
const margin = 20;
const maxLineWidth = pageWidth - 2 * margin;
let currentY = 45;

pdf.setFillColor(248, 250, 252);
pdf.rect(0, 0, pageWidth, 35, "F");
pdf.setDrawColor(226, 232, 240);
pdf.setLineWidth(0.4);
pdf.line(0, 35, pageWidth, 35);

pdf.setFillColor(16, 185, 129);
pdf.roundedRect(margin + 2, 13.5, 8, 6, 1, 1, "F");
pdf.triangle(margin + 2, 19.5, margin + 10, 19.5, margin + 6, 23.5, "F");
pdf.setDrawColor(255, 255, 255);
pdf.setLineWidth(0.8);
pdf.line(margin + 4.5, 17.5, margin + 6, 19.5);
pdf.line(margin + 6, 19.5, margin + 8.5, 16.0);
pdf.setFillColor(0, 120, 212);
pdf.circle(margin + 11.0, 12.0, 1.5, "F");

pdf.setFont("helvetica", "bold");
pdf.setFontSize(21);
pdf.setTextColor(30, 41, 59);
pdf.text("bill", margin + 16, 18);
pdf.setTextColor(16, 185, 129);
pdf.text("slayer", margin + 26.5, 18);
pdf.setFontSize(10);
pdf.setTextColor(156, 163, 175);
pdf.text("AI", margin + 49.5, 14.5);

pdf.setFont("helvetica", "normal");
pdf.setFontSize(8.5);
pdf.setTextColor(100, 116, 139);
pdf.text("VERIFIED LEGAL-MEDICAL DISPUTE & AUDIT SYSTEM", margin + 16, 24);

pdf.setTextColor(100, 116, 139);
pdf.setFontSize(8);
pdf.setFont("helvetica", "bold");
pdf.text(`REF: DOC-${doc.id.toUpperCase()}`, pageWidth - margin - 55, 15);
pdf.setFont("helvetica", "normal");
pdf.text(`DATE: ${new Date(doc.createdAt).toLocaleDateString()}`, pageWidth - margin - 55, 21);

pdf.setTextColor(17, 24, 39);
pdf.setFont("helvetica", "bold");
pdf.setFontSize(13);
pdf.text(doc.title.toUpperCase(), margin, currentY);
currentY += 8;

pdf.setDrawColor(0, 120, 212);
pdf.setLineWidth(0.8);
pdf.line(margin, currentY, pageWidth - margin, currentY);
currentY += 12;

function pageBreakHeader() {
  pdf.setFont("helvetica", "italic");
  pdf.setFontSize(8);
  pdf.setTextColor(156, 163, 175);
  pdf.setFillColor(16, 185, 129);
  pdf.roundedRect(margin + 1, 9.0, 2.5, 1.8, 0.4, 0.4, "F");
  pdf.triangle(margin + 1, 10.8, margin + 3.5, 10.8, margin + 2.25, 12.2, "F");
  pdf.setFillColor(0, 120, 212);
  pdf.circle(margin + 3.8, 8.8, 0.5, "F");
  pdf.text("BillSlayer AI - Premium Medical-Legal Dispute Chronology", margin + 6, 11);
  pdf.setDrawColor(229, 231, 235);
  pdf.setLineWidth(0.2);
  pdf.line(margin, 15, pageWidth - margin, 15);
}

const lines: string[] = doc.content.split("\n");
for (let i = 0; i < lines.length; i++) {
  const rawLine = lines[i].trim();
  if (rawLine === "") { currentY += 5; continue; }

  if (currentY > pageHeight - margin - 15) {
    pdf.addPage();
    currentY = 25;
    pageBreakHeader();
    currentY = 25;
  }

  const isMainHeader = rawLine.startsWith("=================") || rawLine.startsWith("-----------------");
  if (isMainHeader) {
    pdf.setDrawColor(209, 213, 219);
    pdf.setLineWidth(0.4);
    pdf.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 5;
    continue;
  }

  const isNumberedHeading = /^[0-9]+\.\s+[A-Z\s]/.test(rawLine);
  const isAllCapsHeading = rawLine.toUpperCase() === rawLine && rawLine.length > 4 && rawLine.length < 80;

  if (isNumberedHeading || isAllCapsHeading) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10.5);
    pdf.setTextColor(15, 23, 42);
    currentY += 2;
  } else {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9.5);
    pdf.setTextColor(55, 65, 81);
  }

  const wrappedLines = pdf.splitTextToSize(rawLine, maxLineWidth);
  for (let j = 0; j < wrappedLines.length; j++) {
    if (currentY > pageHeight - margin - 15) {
      pdf.addPage();
      currentY = 25;
      pageBreakHeader();
      currentY = 25;
      if (isNumberedHeading || isAllCapsHeading) {
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(10.5); pdf.setTextColor(15, 23, 42);
      } else {
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(9.5); pdf.setTextColor(55, 65, 81);
      }
    }
    pdf.text(wrappedLines[j], margin, currentY);
    currentY += 5.5;
  }
}

const totalPages = pdf.getNumberOfPages();
for (let p = 1; p <= totalPages; p++) {
  pdf.setPage(p);
  pdf.setDrawColor(229, 231, 235);
  pdf.setLineWidth(0.3);
  pdf.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(156, 163, 175);
  pdf.text(`CONFIDENTIAL SECURITY POLICY • GENERATED VIA SECURE BILLSLAYER AI WORKSPACE`, margin, pageHeight - 10);
  pdf.text(`Page ${p} of ${totalPages}`, pageWidth - margin - 18, pageHeight - 10);
}

const outPath = "scripts/.walkthrough-screenshots/BillSlayer-Medical-Billing-Audit-Sarah-Connor.pdf";
fs.writeFileSync(outPath, Buffer.from(pdf.output("arraybuffer")));
console.log("PDF written to", outPath);
