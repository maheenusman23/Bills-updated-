import { jsPDF } from "jspdf";
import { GeneratedDocument } from "../types";

export function downloadAsPDF(doc: GeneratedDocument) {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const maxLineWidth = pageWidth - 2 * margin;

  let currentY = 45;

  // Header Bar background (Light Off-white matching website header)
  pdf.setFillColor(248, 250, 252); // Slate-50 off-white background
  pdf.rect(0, 0, pageWidth, 35, "F");

  // Bottom border line for header bar
  pdf.setDrawColor(226, 232, 240); // Slate-200 border
  pdf.setLineWidth(0.4);
  pdf.line(0, 35, pageWidth, 35);

  // Draw elegant brand vector logo icon (Emerald Shield + Blue Dot matching website)
  pdf.setFillColor(16, 185, 129); // Emerald green
  pdf.roundedRect(margin + 2, 13.5, 8, 6, 1, 1, "F");
  pdf.triangle(margin + 2, 19.5, margin + 10, 19.5, margin + 6, 23.5, "F");

  // Draw white checkmark inside green shield
  pdf.setDrawColor(255, 255, 255);
  pdf.setLineWidth(0.8);
  pdf.line(margin + 4.5, 17.5, margin + 6, 19.5);
  pdf.line(margin + 6, 19.5, margin + 8.5, 16.0);

  // Draw blue dot at top right of shield
  pdf.setFillColor(0, 120, 212); // Blue-600
  pdf.circle(margin + 11.0, 12.0, 1.5, "F");

  // Draw branded typography "billslayer AI"
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(21);
  
  // "bill" in dark Slate-800
  pdf.setTextColor(30, 41, 59);
  pdf.text("bill", margin + 16, 18);

  // "slayer" in Emerald Green
  pdf.setTextColor(16, 185, 129);
  pdf.text("slayer", margin + 26.5, 18);

  // "AI" in light Gray
  pdf.setFontSize(10);
  pdf.setTextColor(156, 163, 175);
  pdf.text("AI", margin + 49.5, 14.5);

  // Subtitle/Slogan under the logo
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(100, 116, 139); // Slate-500
  pdf.text("VERIFIED LEGAL-MEDICAL DISPUTE & AUDIT SYSTEM", margin + 16, 24);

  // Document Metadata block on the right
  pdf.setTextColor(100, 116, 139); // Slate-500
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "bold");
  pdf.text(`REF: DOC-${doc.id.toUpperCase()}`, pageWidth - margin - 55, 15);
  pdf.setFont("helvetica", "normal");
  pdf.text(`DATE: ${new Date(doc.createdAt).toLocaleDateString()}`, pageWidth - margin - 55, 21);

  // Title
  pdf.setTextColor(17, 24, 39); // Gray-900
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text(doc.title.toUpperCase(), margin, currentY);
  currentY += 8;

  // Beautiful accent divider line
  pdf.setDrawColor(0, 120, 212); // #0078d4 Accent Blue
  pdf.setLineWidth(0.8);
  pdf.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 12;

  const lines = doc.content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();

    // Avoid multiple redundant empty spaces, but handle paragraph gaps
    if (rawLine === "") {
      currentY += 5;
      continue;
    }

    // Check pagination budget
    if (currentY > pageHeight - margin - 15) {
      pdf.addPage();
      currentY = 25;
      
      // Page running header
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(8);
      pdf.setTextColor(156, 163, 175);
      
      // Mini vector logo icon
      pdf.setFillColor(16, 185, 129); // Emerald green
      pdf.roundedRect(margin + 1, 9.0, 2.5, 1.8, 0.4, 0.4, "F");
      pdf.triangle(margin + 1, 10.8, margin + 3.5, 10.8, margin + 2.25, 12.2, "F");
      pdf.setFillColor(0, 120, 212); // Blue
      pdf.circle(margin + 3.8, 8.8, 0.5, "F");
      
      pdf.text("BillSlayer AI - Premium Medical-Legal Dispute Chronology", margin + 6, 11);
      pdf.setDrawColor(229, 231, 235);
      pdf.setLineWidth(0.2);
      pdf.line(margin, 15, pageWidth - margin, 15);
      currentY = 25;
    }

    // Custom stylings for headings vs paragraph lines
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
      pdf.setTextColor(15, 23, 42); // Gray-900
      currentY += 2;
    } else {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9.5);
      pdf.setTextColor(55, 65, 81); // Gray-700
    }

    // Wrapped line output
    const wrappedLines = pdf.splitTextToSize(rawLine, maxLineWidth);
    for (let j = 0; j < wrappedLines.length; j++) {
      if (currentY > pageHeight - margin - 15) {
        pdf.addPage();
        currentY = 25;
        
        pdf.setFont("helvetica", "italic");
        pdf.setFontSize(8);
        pdf.setTextColor(156, 163, 175);
        
        // Mini vector logo icon
        pdf.setFillColor(16, 185, 129); // Emerald green
        pdf.roundedRect(margin + 1, 9.0, 2.5, 1.8, 0.4, 0.4, "F");
        pdf.triangle(margin + 1, 10.8, margin + 3.5, 10.8, margin + 2.25, 12.2, "F");
        pdf.setFillColor(0, 120, 212); // Blue
        pdf.circle(margin + 3.8, 8.8, 0.5, "F");
        
        pdf.text("BillSlayer AI - Premium Medical-Legal Dispute Chronology", margin + 6, 11);
        pdf.setDrawColor(229, 231, 235);
        pdf.setLineWidth(0.2);
        pdf.line(margin, 15, pageWidth - margin, 15);
        currentY = 25;
        
        // Retain correct fonts
        if (isNumberedHeading || isAllCapsHeading) {
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(10.5);
          pdf.setTextColor(15, 23, 42);
        } else {
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(9.5);
          pdf.setTextColor(55, 65, 81);
        }
      }
      pdf.text(wrappedLines[j], margin, currentY);
      currentY += 5.5;
    }
  }

  // Draw Page numbers and professional secure borders on all pages
  let totalPages = 1;
  try {
    totalPages = typeof pdf.getNumberOfPages === "function" 
      ? pdf.getNumberOfPages() 
      : ((pdf as any).internal && typeof (pdf as any).internal.getNumberOfPages === "function"
          ? (pdf as any).internal.getNumberOfPages()
          : 1);
  } catch (err) {
    console.error("Error getting page numbers", err);
  }

  for (let p = 1; p <= totalPages; p++) {
    try {
      pdf.setPage(p);
      
      // Bottom footer line
      pdf.setDrawColor(229, 231, 235);
      pdf.setLineWidth(0.3);
      pdf.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(156, 163, 175);
      
      pdf.text(
        `CONFIDENTIAL SECURITY POLICY • GENERATED VIA SECURE BILLSLAYER AI WORKSPACE`,
        margin,
        pageHeight - 10
      );
      pdf.text(
        `Page ${p} of ${totalPages}`,
        pageWidth - margin - 18,
        pageHeight - 10
      );
    } catch (pageErr) {
      console.error("Error setting page or printing footer on page " + p, pageErr);
    }
  }

  const safeTitle = (doc.title || "Generated_Document").replace(/\s+/g, "_");
  pdf.save(`${safeTitle}.pdf`);
}

export function downloadAsWord(doc: GeneratedDocument) {
  const title = doc.title || "Generated_Document";
  const contentHtml = doc.content
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed === "") return "<p style='margin: 0; min-height: 1em;'></p>";
      if (trimmed.startsWith("===") || trimmed.startsWith("---")) {
        return "<hr style='border: none; border-top: 2px solid #0078d4; margin: 12px 0;' />";
      }
      if (/^[0-9]+\.\s+[A-Z\s]/.test(trimmed) || (trimmed.toUpperCase() === trimmed && trimmed.length > 4 && trimmed.length < 80)) {
        return `<h3 style="color: #0f172a; font-family: Arial, sans-serif; font-size: 14pt; margin-top: 16px; margin-bottom: 8px; font-weight: bold;">${trimmed}</h3>`;
      }
      return `<p style="color: #334155; font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.5; margin-bottom: 8px;">${trimmed}</p>`;
    })
    .join("");

  const html = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <title>${title}</title>
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        @page {
          size: 8.5in 11in;
          margin: 1.0in 1.0in 1.0in 1.0in;
          mso-header-margin: .5in;
          mso-footer-margin: .5in;
        }
        body {
          font-family: Arial, sans-serif;
        }
        .header-bar {
          background-color: #1e293b;
          color: #ffffff;
          padding: 18pt;
          margin-bottom: 24pt;
        }
        .header-title {
          font-size: 18pt;
          font-weight: bold;
          margin: 0;
          color: #ffffff;
        }
        .header-subtitle {
          font-size: 9pt;
          color: #f59e0b;
          margin: 4pt 0 0 0;
          font-weight: bold;
        }
        .doc-title {
          font-size: 16pt;
          font-weight: bold;
          color: #0f172a;
          margin-top: 20pt;
          margin-bottom: 6pt;
          text-transform: uppercase;
        }
        .accent-line {
          border-top: 3px solid #0078d4;
          margin-bottom: 18pt;
        }
        .footer {
          border-top: 1px solid #e2e8f0;
          padding-top: 12pt;
          margin-top: 40pt;
          font-size: 8pt;
          color: #94a3b8;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="header-bar">
        <table width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td valign="middle">
              <table cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td width="35" valign="middle">
                    <div style="background-color: #f59e0b; width: 24px; height: 24px; border-radius: 12px; text-align: center; line-height: 24px; color: #ffffff; font-weight: bold; font-family: Arial, sans-serif; font-size: 14px;">⚡</div>
                  </td>
                  <td valign="middle">
                    <div class="header-title">BILLSLAYER AI</div>
                    <div class="header-subtitle">VERIFIED LEGAL-MEDICAL DISPUTE & AUDIT SYSTEM</div>
                  </td>
                </tr>
              </table>
            </td>
            <td align="right" valign="middle" style="color: #ffffff; font-size: 8pt; font-family: Arial, sans-serif;">
              REF: DOC-${doc.id.toUpperCase()}<br/>
              DATE: ${new Date(doc.createdAt).toLocaleDateString()}
            </td>
          </tr>
        </table>
      </div>
      
      <div class="doc-title">${title}</div>
      <div class="accent-line"></div>
      
      <div class="content">
        ${contentHtml}
      </div>
      
      <div class="footer">
        CONFIDENTIAL SECURITY POLICY &bull; GENERATED VIA SECURE BILLSLAYER AI WORKSPACE &bull; SYSTEM CERTIFIED
      </div>
    </body>
    </html>
  `;

  const blob = new Blob([html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const element = document.createElement("a");
  element.href = url;
  element.download = `${title.replace(/\s+/g, "_")}.doc`;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
  URL.revokeObjectURL(url);
}
