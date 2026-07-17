import React, { useState } from "react";
import { motion } from "motion/react";
import { 
  ShieldCheck, FileText, Sparkles, ChevronRight, Percent, 
  FileCheck, Landmark as CourtIcon, Activity, AlertTriangle, Shield
} from "lucide-react";

export default function LearningHub() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  return (
    <div className="bg-[#FAFBFD] py-16 border-b border-slate-200/50 scroll-mt-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Emerald Card Banner (Resource Hub) */}
        <div className="bg-emerald-950 text-white rounded-3xl p-8 sm:p-12 shadow-xl relative overflow-hidden select-none">
          {/* Soft decorative blur */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 space-y-4 max-w-3xl text-left">
            <span className="inline-block bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-widest px-3.5 py-1 rounded-full border border-emerald-400/20">
              EDUCATION CENTER
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight font-display">
              Billing Audit & Claim Recovery Resource Hub
            </h2>
            <p className="text-slate-350 text-xs sm:text-sm leading-relaxed max-w-2xl font-sans">
              Understanding medical denial appeals, CPT audits, and injury chronologies is complex. Learn from industry-standard metrics, guides, and fair-billing policies.
            </p>
          </div>
        </div>

        {/* Metrics Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-2.5 text-emerald-950 border-b border-slate-200/80 pb-3 text-left">
            <Activity className="w-5 h-5 text-emerald-600 animate-pulse" strokeWidth={3} />
            <h3 className="text-lg sm:text-xl font-black uppercase tracking-wider text-black">
              MEDICAL BILLING & INSURANCE RECOVERY METRICS
            </h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-xs hover:shadow-md transition duration-200 text-left">
              <div>
                <div className="bg-rose-50 border border-rose-100 p-2 rounded-2xl w-11 h-11 flex items-center justify-center mb-5 shrink-0">
                  <AlertTriangle className="w-5 h-5 text-rose-500" />
                </div>
                <h4 className="text-3xl font-black text-slate-900 tracking-tight font-display mb-1">
                  10% - 12%
                </h4>
                <p className="text-xs font-extrabold text-emerald-950 uppercase tracking-wider mb-3">
                  Average Revenue Loss
                </p>
                <p className="text-[11px] text-black leading-relaxed">
                  Most clinical facilities lose 10% or more of annual billing due to clerical coding errors and arbitrary insurance claims denials.
                </p>
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-xs hover:shadow-md transition duration-200 text-left">
              <div>
                <div className="bg-emerald-50 border border-emerald-100 p-2 rounded-2xl w-11 h-11 flex items-center justify-center mb-5 shrink-0">
                  <Percent className="w-5 h-5 text-emerald-500" />
                </div>
                <h4 className="text-3xl font-black text-slate-900 tracking-tight font-display mb-1">
                  $31.2 Billion
                </h4>
                <p className="text-xs font-extrabold text-emerald-950 uppercase tracking-wider mb-3">
                  Annual Claim Disputes
                </p>
                <p className="text-[11px] text-black leading-relaxed">
                  Over $31.2 billion in clinical billing claims are rejected by medical insurance groups annually, requiring administrative appeal processing.
                </p>
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-xs hover:shadow-md transition duration-200 text-left">
              <div>
                <div className="bg-emerald-50 border border-emerald-100 p-2 rounded-2xl w-11 h-11 flex items-center justify-center mb-5 shrink-0">
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                </div>
                <h4 className="text-3xl font-black text-slate-900 tracking-tight font-display mb-1">
                  67% Reclaim Rate
                </h4>
                <p className="text-xs font-extrabold text-emerald-950 uppercase tracking-wider mb-3">
                  Appeal Success Metric
                </p>
                <p className="text-[11px] text-black leading-relaxed">
                  Up to 67% of denied medical claims are successfully recovered when supported by professional, CPT-validated dispute appeals letters.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Learning Portions */}
        <div className="space-y-6">
          <div className="flex items-center gap-2.5 text-emerald-950 border-b border-slate-200/80 pb-3 text-left">
            <FileText className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg sm:text-xl font-black uppercase tracking-wider text-black">
              PLATFORM LEARNING PORTIONS
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Module 1 */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-xs hover:shadow-md transition duration-200 text-left space-y-6">
              <div>
                <h4 className="text-base sm:text-lg font-extrabold text-emerald-600 flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-emerald-500" />
                  Module 1: How Medical Billing Audits Work
                </h4>
                <p className="text-[11px] text-black leading-relaxed mt-2.5">
                  Medical billing processes require mapping patient services into standardized CPT (Current Procedural Terminology) and ICD-10 (International Classification of Diseases) billing codes. Inconsistencies occur when:
                </p>
                <ul className="space-y-3 mt-4 text-[11px] text-black">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <div>
                      <strong className="text-black font-extrabold">Upcoding Errors:</strong> Unintentionally charging for complex treatments that exceed the actual procedure logged.
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <div>
                      <strong className="text-black font-extrabold">Unbundling Coding:</strong> Separating and billing individual CPT components of a single integrated service to increase claim amount falsely.
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <div>
                      <strong className="text-black font-extrabold">Duplicate Items:</strong> Charging multiple times for disposable supplies or physician hours on a single claim ledger.
                    </div>
                  </li>
                </ul>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-[11px] text-emerald-950 leading-relaxed">
                <strong className="font-extrabold text-emerald-900 block uppercase tracking-wider text-[9px] mb-1">Key Takeaway</strong>
                BillSlayer AI performs an automated audit to cross-reference CPT billing against standard national procedures, allowing clients to reclaim money and challenge errors directly.
              </div>
            </div>

            {/* Module 2 */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-xs hover:shadow-md transition duration-200 text-left space-y-6">
              <div>
                <h4 className="text-base sm:text-lg font-extrabold text-emerald-600 flex items-center gap-2">
                  <CourtIcon className="w-5 h-5 text-emerald-500" />
                  Module 2: Formulating Legal Demand Packages
                </h4>
                <p className="text-[11px] text-black leading-relaxed mt-2.5">
                  For personal injury lawyers, a Settlement Demand Package compiles evidence of third-party negligence and links it to physical and financial damages. Writing these involves:
                </p>
                <ul className="space-y-3 mt-4 text-[11px] text-black">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <div>
                      <strong className="text-black font-extrabold">Treatment Chronology:</strong> Creating an exact timeline mapping doctor notes, emergency room visits, therapy timelines, and diagnosis records.
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <div>
                      <strong className="text-black font-extrabold">Damages Calculation:</strong> Aggregating emergency care costs, future therapeutic demands, lost wages, and pain & suffering indexes.
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <div>
                      <strong className="text-black font-extrabold">Liability Arguments:</strong> Using police reports, accident notes, and traffic citations to substantiate negligence claims.
                    </div>
                  </li>
                </ul>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-[11px] text-emerald-950 leading-relaxed">
                <strong className="font-extrabold text-emerald-900 block uppercase tracking-wider text-[9px] mb-1">Key Takeaway</strong>
                BillSlayer AI slashes legal preparation times from 15 hours to minutes, compiling structured Demand Packages and timelines that lawyers use to negotiate maximum claim valuations.
              </div>
            </div>
          </div>
        </div>

        {/* FAQs Accordion */}
        <div id="faq" className="space-y-6">
          <div className="flex items-center gap-2.5 text-emerald-950 border-b border-slate-200/80 pb-3 text-left">
            <Shield className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg sm:text-xl font-black uppercase tracking-wider text-black">
              FREQUENTLY ASKED QUESTIONS
            </h3>
          </div>

          <div className="space-y-4 max-w-4xl mx-auto">
            {[
              {
                q: "How does BillSlayer AI protect personal information?",
                a: "HIPAA compliance and data security are core requirements. We maintain strict role-based access isolation where clients, lawyers, and clinics operate in secure, independent portals. Documents generated are treated as one-time secure downloads or held securely within premium subscriber workspaces."
              },
              {
                q: "What is the difference between Pay-Per-Case and Subscription Workspaces?",
                a: "One-time users can upload single billing sheets or record packages and pay a fixed fee (e.g. $10 to $30) to generate and download their document once. High-volume clinical billers and legal groups can purchase Subscription Workspaces which provide complete case history tracking, analytics, and reusable monthly credits with zero file storage limits."
              },
              {
                q: "What is an upcoded or unbundled charge in a medical bill?",
                a: "Upcoding occurs when a healthcare provider logs a more severe CPT code than what was actually performed, artificially increasing the cost. Unbundling occurs when they bill separate fees for multiple components of a service that should have been grouped into a single standard package code."
              },
              {
                q: "Is my personal patient and diagnostic data HIPAA secure?",
                a: "Absolutely. BillSlayer AI utilizes modern de-identification algorithms to strip personal patient identification from raw medical data before checking databases. All transfers are encrypted, and we strictly comply with all HIPAA administrative and security mandates."
              },
              {
                q: "How does the pay-per-generation option work?",
                a: "Our system has zero ongoing commitments. You can sign up for a free patient account, input your case details, and the system will run an initial scan. Before creating any certified dispute letter or detailed CPT audit, you trigger a secure $15 Stripe payment. Once paid, the full document unlocks instantly."
              },
              {
                q: "Can I use BillSlayer appeal letters for court disputes?",
                a: "Yes. Our appeal letters are drafted using standard clinical and regulatory syntax, citing ERISA regulations and relevant CMS guidelines. However, you should consult with a qualified health advocate or attorney if you intend to pursue formal litigation."
              }
            ].map((item, index) => (
              <div 
                key={index} 
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden transition duration-200 hover:border-slate-300 shadow-2xs text-left"
              >
                <button
                  type="button"
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  className="w-full text-left px-6 py-5 flex justify-between items-center gap-4 cursor-pointer focus:outline-none"
                >
                  <span className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight">
                    {item.q}
                  </span>
                  <ChevronRight 
                    className={`w-4 h-4 text-emerald-600 transition duration-200 transform ${
                      expandedFaq === index ? "rotate-90 text-emerald-600" : ""
                    }`} 
                  />
                </button>

                {expandedFaq === index && (
                  <div className="px-6 pb-5 text-xs text-slate-500 leading-relaxed border-t border-slate-100 pt-3 bg-slate-50/50">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
