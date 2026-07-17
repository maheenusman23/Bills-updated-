import React, { useRef } from "react";
import { Download, AlertCircle, FileText, Lock } from "lucide-react";
import { GeneratedDocument } from "../types";

interface PDFPreviewProps {
  document: GeneratedDocument;
  onDownload: (format: "pdf" | "docx") => void;
  onUnlock?: () => void;
}

export default function PDFPreview({ document, onDownload, onUnlock }: PDFPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const preventCopy = (e: React.ClipboardEvent) => {
    e.preventDefault();
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  return (
    <div className="w-full bg-white border border-slate-200 rounded-xl p-6 shadow-xl relative overflow-hidden">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 font-display">
            <FileText className="w-5 h-5 text-[#0078d4]" />
            {document.title}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Generated on {new Date(document.createdAt).toLocaleDateString()}
          </p>
        </div>

        {document.isLocked ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-amber-800 flex items-center gap-1 bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-200 font-semibold shadow-sm">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              One-time Access Exhausted
            </span>
            {onUnlock && (
              <button
                onClick={onUnlock}
                className="bg-[#0078d4] hover:bg-[#005a9e] text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition duration-200 cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <Lock className="w-3.5 h-3.5" />
                Unlock Re-access (50% Off)
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onDownload("pdf")}
              className="bg-[#0078d4] hover:bg-[#005a9e] text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition duration-200 cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Download PDF
            </button>
           
          </div>
        )}
      </div>

      {/* Copy protection warning banner */}
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-3.5 mb-2 text-xs text-slate-700 flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
        <span>
          <strong>Anti-Copy Protection Active:</strong> To maintain authenticity, document selection is restricted. Please use the download buttons above to obtain editable versions.
        </span>
      </div>
      <div className="text-[11px] font-extrabold text-amber-600 text-left mb-6 pl-1 font-sans flex items-center gap-1.5 uppercase tracking-wide">
        <span>⚠️</span> This is a preview only. Please download the document for official legal submissions.
      </div>

      {/* Document Area */}
      <div className="relative bg-slate-50 border border-slate-200 rounded-xl p-2 md:p-6 overflow-hidden max-h-[600px] overflow-y-auto">
        {document.isLocked ? (
          <div className="py-24 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-white border border-slate-200 rounded-full flex items-center justify-center mb-4 shadow-sm">
              <Lock className="w-8 h-8 text-[#0078d4]" />
            </div>
            <h4 className="text-slate-900 font-bold text-lg font-display">Document Download Limit Reached</h4>
            <p className="text-slate-500 text-sm max-w-md mt-2 px-4">
              Since AI processing incurs high compute costs, document downloads are limited to one-time checkout. Please purchase a re-access unlock or generate with a subscription credit to reopen.
            </p>
          </div>
        ) : (
          <div
            ref={containerRef}
            onContextMenu={handleContextMenu}
            onCopy={preventCopy}
            className="select-none select-text-none relative bg-white text-slate-900 p-8 sm:p-12 min-h-[700px] font-sans shadow-md border border-slate-200 text-sm leading-relaxed"
            style={{
              userSelect: "none",
              msUserSelect: "none",
              WebkitUserSelect: "none",
              MozUserSelect: "none"
            }}
          >
            {/* Watermark Logo */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none">
              <span className="text-7xl font-extrabold tracking-widest uppercase rotate-45 text-slate-900 select-none">
                BILLSLAYER AI
              </span>
            </div>

            {/* Premium Header */}
            <div className="flex items-center justify-between border-b-2 border-[#0078d4] pb-4 mb-8 select-none">
              <div className="flex items-center gap-2">
                {/* SVG BillSlayer Logo Icon */}
                <div className="w-8 h-8 bg-gradient-to-br from-[#0078d4] to-indigo-500 rounded flex items-center justify-center text-white font-extrabold text-sm tracking-tight select-none shadow-sm">
                  B
                </div>
                <div>
                  <span className="font-extrabold text-base tracking-tight text-slate-900 block select-none">
                    BILLSLAYER AI
                  </span>
                  <span className="text-[9px] text-slate-500 font-semibold tracking-wider uppercase block select-none">
                    Medical & Legal Dispute Engine
                  </span>
                </div>
              </div>
              <div className="text-right select-none">
                <span className="text-[10px] text-[#0078d4] font-bold uppercase tracking-wider block select-none">
                  VERIFIED AI COMPILATION
                </span>
                <span className="text-[9px] text-slate-500 block select-none font-mono">
                  Ref: Doc-{document.id.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Document Content - Clean Typography */}
            <div className="whitespace-pre-wrap font-sans text-slate-800 text-sm tracking-wide select-none leading-relaxed">
              {document.content}
            </div>

            {/* Professional Footer */}
            <div className="mt-12 pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-400 select-none">
              <span className="select-none font-medium">Generated securely via BillSlayer AI Full-Stack Platform</span>
              <span className="select-none font-medium">Page 1 of 1 • System Certified</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
