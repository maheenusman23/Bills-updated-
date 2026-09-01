import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, animate } from "motion/react";
import {
  ShieldCheck, FileText, Sparkles, ChevronRight, ArrowRight, CheckCircle,
  Percent, Database, Landmark, Terminal, ArrowUpRight, Lock, Layers,
  Activity, FileCheck, RefreshCw, AlertTriangle, Shield, User, Landmark as CourtIcon,
  Mail, Send
} from "lucide-react";

// Reusable count-up hook: smoothly tweens a displayed number toward `target`
// whenever it changes, using motion's imperative `animate()` API.
function useCountUp(target: number, duration: number = 0.6) {
  const [display, setDisplay] = useState(target);
  const prevTarget = useRef(target);

  useEffect(() => {
    const controls = animate(prevTarget.current, target, {
      duration,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(v),
    });
    prevTarget.current = target;
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return display;
}
// @ts-ignore
import lawBg from "../assets/images/law.jpg";

interface LandingPageProps {
  onTriggerAuth: (role: "client" | "lawyer" | "clinic", isSignUp: boolean) => void;
  showSupportTipsOnly?: boolean;
  onNavigate?: (sectionId: string) => void;
  pendingScrollSection?: string | null;
}

export default function LandingPage({ 
  onTriggerAuth, 
  showSupportTipsOnly = false, 
  onNavigate,
  pendingScrollSection = null
}: LandingPageProps) {
  // Simulator State
  const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [simulationStage, setSimulationStage] = useState<"idle" | "thinking" | "connecting" | "auditing" | "appealing" | "complete">("idle");
  
  // Parallax background offset and scroll progress
  const [parallaxOffset, setParallaxOffset] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setParallaxOffset(window.scrollY * 0.35);
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (totalScroll > 0) {
        setScrollProgress(window.scrollY / totalScroll);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  
  // Dynamic balance counter for the estimator widget
  const [estimateAmount, setEstimateAmount] = useState<number>(8450);
  const [estimateErrorType, setEstimateErrorType] = useState<"unbundled" | "upcoded" | "duplicate" | "denied">("upcoded");

  // Contact Us Form state
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactSubject, setContactSubject] = useState("Dispute Help");
  const [contactMessage, setContactMessage] = useState("");
  const [contactStatus, setContactStatus] = useState<"idle" | "sending" | "success" | "error">("idle");

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName || !contactEmail || !contactMessage) {
      setContactStatus("error");
      return;
    }
    setContactStatus("sending");
    
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: contactName,
          email: contactEmail,
          subject: contactSubject,
          message: contactMessage
        })
      });
      if (res.ok) {
        setContactStatus("success");
      } else {
        setContactStatus("error");
      }
    } catch (err) {
      console.error("Failed to submit contact via API", err);
      // Attempt mailto fallback
      const subjectLine = `${contactSubject} - ${contactName}`;
      const bodyContent = `Name: ${contactName}\nEmail: ${contactEmail}\n\nMessage:\n${contactMessage}`;
      const mailtoUrl = `mailto:billslayerai@gmail.com?subject=${encodeURIComponent(subjectLine)}&body=${encodeURIComponent(bodyContent)}`;
      try {
        window.location.href = mailtoUrl;
        setContactStatus("success");
      } catch (e2) {
        setContactStatus("error");
      }
    }
  };

  // Accordion FAQ state
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // Suggestions for the interactive dispute builder
  const suggestions = [
    {
      target: "Itemized Hospital Bill",
      targetColor: "text-indigo-600 bg-indigo-50 border-indigo-100",
      rule: "ERISA 29 U.S.C. § 1133 Guidelines",
      ruleColor: "text-emerald-600 bg-emerald-50 border-emerald-100",
      output: "Certified Insurance Appeal Packet",
      outputColor: "text-amber-600 bg-amber-50 border-amber-100",
      desc: "Verify ER facility upcoding and cross-reference geographic CMS pricing limits."
    },
    {
      target: "Duplicate Medication Lines",
      targetColor: "text-rose-600 bg-rose-50 border-rose-100",
      rule: "FDA Clinical Dosage Reference Guides",
      ruleColor: "text-sky-600 bg-sky-50 border-sky-100",
      output: "Duplicate Claim Refund Request",
      outputColor: "text-indigo-600 bg-indigo-50 border-indigo-100",
      desc: "Identify redundant medication charges logged during single diagnostic sessions."
    },
    {
      target: "Unbundled Surgery Codes",
      targetColor: "text-purple-600 bg-purple-50 border-purple-100",
      rule: "CMS National Correct Coding Initiative (NCCI)",
      ruleColor: "text-teal-600 bg-teal-50 border-teal-100",
      output: "CMS Regulatory Dispute Appeal",
      outputColor: "text-pink-600 bg-pink-50 border-pink-100",
      desc: "Deconstruct unbundled surgical codes to enforce legal billing bundle limits."
    }
  ];

  // Auto-cycle suggestions every 8 seconds if not simulating
  useEffect(() => {
    if (isSimulating) return;
    const interval = setInterval(() => {
      setCurrentSuggestionIndex((prev) => (prev + 1) % suggestions.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [isSimulating]);

  // Handle manual/automatic simulation sequence
  const startSimulation = () => {
    setIsSimulating(true);
    setSimulationProgress(0);
    setSimulationStage("thinking");

    let progress = 0;
    const timer = setInterval(() => {
      progress += 2;
      setSimulationProgress(progress);

      if (progress < 25) {
        setSimulationStage("thinking");
      } else if (progress < 50) {
        setSimulationStage("connecting");
      } else if (progress < 75) {
        setSimulationStage("auditing");
      } else if (progress < 95) {
        setSimulationStage("appealing");
      } else if (progress >= 100) {
        setSimulationStage("complete");
        clearInterval(timer);
      }
    }, 50); // Complete simulation in 2.5 seconds
  };

  // Autoplay simulation on scroll/load
  useEffect(() => {
    // Start initial simulation automatically after a short delay so the user sees live movement immediately!
    const delay = setTimeout(() => {
      startSimulation();
    }, 1500);
    return () => clearTimeout(delay);
  }, []);

  const handleNextSuggestion = () => {
    if (isSimulating) return;
    setCurrentSuggestionIndex((prev) => (prev + 1) % suggestions.length);
  };

  // Savings Impact Estimator — derived figures, smoothly tweened on change via useCountUp
  const estimateErrorRate =
    estimateErrorType === "unbundled" ? 0.42 :
    estimateErrorType === "upcoded" ? 0.58 :
    estimateErrorType === "duplicate" ? 0.28 : 0.76;
  const estimateReliefAmount = Math.round(estimateAmount * estimateErrorRate);
  const estimateTargetBalance = Math.round(estimateAmount - estimateReliefAmount);
  const displayedReliefAmount = useCountUp(estimateReliefAmount);
  const displayedTargetBalance = useCountUp(estimateTargetBalance);

  return (
    <div className="w-full bg-gradient-to-b from-[#FAF8F5] via-[#F4F1EA] via-[#EDE9E0] via-[#F4F1EA] to-[#FAF8F5] text-slate-900 antialiased selection:bg-emerald-500/20 selection:text-slate-900 relative overflow-x-hidden">
      
      {!showSupportTipsOnly && <>
          {/* Elegant Ambient Mesh Glows (Premium, Subtle & Matches Emerald theme) */}
          <div className="absolute top-[680px] left-[-10%] w-[50%] h-[600px] rounded-full bg-gradient-to-tr from-[#E6E0D4]/20 to-transparent blur-[130px] pointer-events-none" />
          <div className="absolute top-[1400px] right-[-10%] w-[50%] h-[700px] rounded-full bg-gradient-to-br from-[#E1D9CD]/25 to-transparent blur-[140px] pointer-events-none" />
          <div className="absolute top-[2400px] left-[5%] w-[45%] h-[600px] rounded-full bg-gradient-to-r from-[#DFD7C9]/20 to-transparent blur-[120px] pointer-events-none" />
          <div className="absolute top-[3400px] right-[10%] w-[40%] h-[600px] rounded-full bg-gradient-to-tr from-[#E5DEC3]/25 to-transparent blur-[130px] pointer-events-none" />

          {/* MAJESTIC HIGH-CONTRAST DARK HERO BANNER (MATCHES THE BRAND SCREENSHOT PERFECTLY) */}
          <div className="relative w-full overflow-hidden flex flex-col items-center justify-start pt-12 sm:pt-16 pb-12 sm:pb-14 bg-slate-950">
        
        {/* Soft watermark-style Gavel architectural background layer - clearly visible, crisp and elegantly blended */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `url(${lawBg})`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center center",
            backgroundSize: "cover",
            filter: "brightness(1.35) contrast(1.05)",
            opacity: 0.75,
          }}
        />
        {/* Gradient overlay for perfect text contrast and visual depth */}
        <div className="absolute inset-0 bg-black/25 pointer-events-none" />

        {/* Bottom transition blend overlay to eliminate the sharp line and merge with lower part */}
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#FAF8F5] to-transparent pointer-events-none" />

        {/* Glow accents */}
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto text-center px-4 sm:px-6 flex flex-col items-center">
          
          {/* Law Firm Style Badge with clean, eye-catching dark-emerald styling */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-black/40 backdrop-blur-md border border-[#00df89]/30 shadow-2xl mb-6"
          >
            <div className="flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-[#00df89] fill-[#00df89]/10" />
              <Shield className="w-3.5 h-3.5 text-sky-400 fill-sky-400/10 -ml-1" />
            </div>
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.16em] text-[#00df89] font-mono flex items-center gap-1.5">
              <span>BILLSLAYER AI</span>
              <span className="text-white/40">•</span>
              <span className="text-white/90">SECURE COMPLIANCE PARTNER</span>
            </span>
          </motion.div>

          {/* Majestic Hero Header in clean white & emerald */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-black uppercase leading-tight tracking-tight text-white text-center drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] font-sans"
          >
            <span className="block text-white sm:whitespace-nowrap">STOP FIGHTING BILLING</span>
            <span className="block text-white sm:whitespace-nowrap">SYSTEMS</span>
            <span className="block text-[#00df89] mt-2 sm:whitespace-nowrap">RUN ONE CONNECTED</span>
            <span className="block text-[#00df89] sm:whitespace-nowrap">DEFENSE</span>
          </motion.h1>

          {/* Elegant Description with high-readability */}
          <motion.p 
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="mt-4 text-base sm:text-lg md:text-xl text-slate-200 max-w-2xl mx-auto leading-relaxed font-sans"
          >
            Your invoices, insurance plans, and diagnostic codes with audits and appeals
          </motion.p>

          {/* Elegant Reference Button Controls */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.45 }}
            className="flex flex-col sm:flex-row gap-4 items-center justify-center mt-5 w-full max-w-md mb-12"
          >
            <button
              onClick={() => onTriggerAuth("client", true)}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-extrabold px-9 py-4 rounded-full shadow-md hover:shadow-emerald-600/20 transition duration-200 cursor-pointer tracking-widest uppercase hover:scale-102 flex items-center justify-center gap-2 border border-emerald-600"
            >
              <ShieldCheck className="w-4 h-4 text-white" />
              Start For Free
            </button>
            <button
              onClick={() => {
                document.getElementById("interactive-canvas")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="w-full sm:w-auto bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-extrabold px-9 py-4 rounded-full shadow-sm border border-slate-200 transition duration-200 cursor-pointer tracking-widest uppercase hover:scale-102 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-emerald-600" />
              Watch Live Audit
            </button>
          </motion.div>

        </div>

        {/* Soft elegant gradient transition to Section 1 to prevent stark lines */}
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#FAF8F5] to-transparent pointer-events-none" />
      </div>
      
      {/* SECTION 1: HERO SECTION & DYNAMIC BUILDER */}
      <div className="relative w-full py-16 lg:py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        
        {/* Beautiful Dotted Grid Background - Tinted and Subtle */}
        <div className="absolute inset-0 bg-[radial-gradient(#10b981_0.75px,transparent_0.75px)] bg-[size:24px_24px] opacity-[0.12] pointer-events-none" />
        
        {/* Ambient background glows */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto text-center flex flex-col items-center">

          {/* Top Pill Accent (The Green Bar) - Centered right before the interactive builder green line */}
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="pointer-events-none inline-flex items-center gap-2 px-4 py-1.5 bg-slate-900 border border-emerald-500/20 rounded-full shadow-lg relative z-20 mb-2"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#00df89] animate-pulse" />
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-[#00df89] font-mono">
              Build Disputes, Not Files
            </span>
          </motion.div>

          {/* INTERACTIVE BUILDER PROMPT CONTAINER (ZARO STYLE) */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="w-full max-w-3xl mt-2 bg-white border border-slate-200 shadow-xl rounded-2xl p-6 sm:p-8 text-left relative"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-t-2xl" />

            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-4">
              INTERACTIVE DISPUTE BUILDER PROMPT
            </span>

            {/* Prompt sentence with highlight blocks */}
            <div className="text-sm sm:text-base md:text-lg font-bold text-slate-800 leading-relaxed mb-6">
              Make an audit of my{" "}
              <span className={`inline-block px-2 py-0.5 rounded-lg border font-mono text-[11px] sm:text-xs mx-1 ${suggestions[currentSuggestionIndex].targetColor} transition duration-300`}>
                {suggestions[currentSuggestionIndex].target}
              </span>{" "}
              using my{" "}
              <span className={`inline-block px-2 py-0.5 rounded-lg border font-mono text-[11px] sm:text-xs mx-1 ${suggestions[currentSuggestionIndex].ruleColor} transition duration-300`}>
                {suggestions[currentSuggestionIndex].rule}
              </span>{" "}
              and let an AI advocate draft a{" "}
              <span className={`inline-block px-2 py-0.5 rounded-lg border font-mono text-[11px] sm:text-xs mx-1 ${suggestions[currentSuggestionIndex].outputColor} transition duration-300`}>
                {suggestions[currentSuggestionIndex].output}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-4 border-t border-slate-100">
              {/* Suggestion Controls */}
              <div className="flex items-center gap-4">
                <button 
            
                  disabled
                  className="text-xs text-slate-500 flex items-center gap-1.5 font-semibold uppercase tracking-wider cursor-not-allowed opacity-50 pointer-events-none">
                  <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${isSimulating ? "animate-spin" : ""}`} />
                  New Suggestion
                </button>
                <span className="text-[10px] text-slate-400 italic leading-none hidden sm:inline border-l border-slate-200 pl-4">
                  {suggestions[currentSuggestionIndex].desc}
                </span>
              </div>

              {/* Floating App/Document Source Icons */}
              <div className="flex items-center gap-5 w-full sm:w-auto justify-end">
                <div className="flex items-center gap-2 opacity-50">
                  <div className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">P</div>
                  <div className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">W</div>
                  <div className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">S</div>
                </div>

                {/* Submit Circle Arrow Button */}
                <button
  
                  disabled
                 className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center cursor-not-allowed pointer-events-none shadow">
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Dynamic Real-time Status Log */}
            {isSimulating && (
              <div className="mt-4 p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-left font-mono text-[10px] sm:text-xs text-emerald-400 space-y-1">
                <div className="flex justify-between items-center pb-2 border-b border-slate-900 mb-2">
                  <span className="text-slate-500">DISPUTE PROTOCOL STREAM</span>
                  <span className="text-emerald-500 animate-pulse font-bold">{simulationProgress}%</span>
                </div>
                {simulationStage === "thinking" && (
                  <p className="animate-pulse">&gt; Loading billing dictionaries & CPT code lists...</p>
                )}
                {simulationStage === "connecting" && (
                  <>
                    <p className="text-slate-500">&gt; Loading dictionaries complete.</p>
                    <p className="animate-pulse">&gt; Connecting user's invoice files with hospital pricing indices...</p>
                  </>
                )}
                {simulationStage === "auditing" && (
                  <>
                    <p className="text-slate-500">&gt; Secure patient connection verified.</p>
                    <p className="animate-pulse">&gt; CRITICAL: CPT 99285 facility level 5 severity mismatch isolated!</p>
                  </>
                )}
                {simulationStage === "appealing" && (
                  <>
                    <p className="text-slate-500">&gt; Audit complete. Savings isolated.</p>
                    <p className="animate-pulse">&gt; Citing ERISA regulations & generating certified appeal demand letter...</p>
                  </>
                )}
                {simulationStage === "complete" && (
                  <>
                    <p className="text-slate-400">&gt; Appeal generated successfully.</p>
                    <p className="text-emerald-300 font-bold">&gt; COMPLETE: Certified audit letter and savings graph ready below!</p>
                  </>
                )}
              </div>
            )}
          </motion.div>

          {/* Trusted Institution Logo Ticker (Zaro Style) */}
          <div className="mt-16 w-full max-w-5xl">
            <span className="text-[10px] font-black text-slate-450 uppercase tracking-widest block mb-4">
              SUPPORTED CODES, STANDARDS & COMPLIANCE
            </span>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-center justify-center opacity-50">
              <div className="flex items-center justify-center gap-1.5 text-xs font-black uppercase text-slate-700 tracking-wider">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> HIPAA SAFE
              </div>
              <div className="flex items-center justify-center gap-1.5 text-xs font-black uppercase text-slate-700 tracking-wider">
                <Database className="w-4 h-4 text-[#0078d4]" /> CMS CODEBOOKS
              </div>
              <div className="flex items-center justify-center gap-1.5 text-xs font-black uppercase text-slate-700 tracking-wider">
                <FileText className="w-4 h-4 text-indigo-500" /> ERISA CITED
              </div>
              <div className="flex items-center justify-center gap-1.5 text-xs font-black uppercase text-slate-700 tracking-wider">
                <Lock className="w-4 h-4 text-emerald-600" /> AES-256 SECURE
              </div>
              <div className="flex items-center justify-center gap-1.5 text-xs font-black uppercase text-slate-700 tracking-wider">
                <CourtIcon className="w-4 h-4 text-amber-600" /> COURT READY
              </div>
            </div>
          </div>

        </div>
      </div>


      {/* SECTION 2: THE AUTOMATIC LOADING VISUAL (THE WORKSPACE PREVIEW) */}
      <div id="interactive-canvas" className="py-16 relative scroll-mt-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-10">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#0078d4] bg-sky-50 px-3 py-1 rounded border border-sky-100">
              LIVE SYSTEM DEMONSTRATION
            </span>
            <h2 className="text-[13px] xs:text-base sm:text-xl md:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight mt-3 font-display whitespace-nowrap overflow-hidden text-ellipsis">
              Deconstruct claims &middot; Audit bill overcharges
            </h2>
          </div>

          {/* Browser Container Card */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl overflow-hidden max-w-5xl mx-auto relative">
            
            {/* Browser Header Bar */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center z-10 relative">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-slate-200 animate-pulse" />
                <span className="w-3 h-3 rounded-full bg-slate-200" />
                <span className="w-3 h-3 rounded-full bg-slate-200" />
                <span className="text-[10px] text-slate-400 font-mono ml-4 uppercase tracking-wider bg-slate-100 px-3 py-1 rounded">
                  workspace / connected-dispute-auditor
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="hidden sm:flex text-[10px] text-emerald-500 font-mono font-black uppercase tracking-widest items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Workspace Preview
                </span>
                <button
                  onClick={() => onTriggerAuth("client", false)}
                  className="bg-[#0078d4] hover:bg-slate-900 text-white text-[10px] font-black px-4 py-2 rounded-lg uppercase tracking-widest transition shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  Open Practice App <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Main Mockup Workspace Body */}
            <div className="p-4 sm:p-8 bg-slate-50/50 grid grid-cols-1 lg:grid-cols-12 gap-6 text-left">
              
              {/* Left Column: Automated Ingestion Pipeline Logs (1:1 with video) */}
              <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
                <div>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
                    <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider font-mono">Case Pipeline</span>
                    <span className="text-[9px] bg-sky-50 text-[#0078d4] font-mono font-bold px-2 py-0.5 rounded uppercase">ACTIVE</span>
                  </div>

                  <div className="space-y-4">
                    {/* Pipeline Item 1 */}
                    <div className="flex gap-2.5 items-start">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-600 text-[10px] font-bold font-mono">1</div>
                      <div>
                        <span className="text-[10px] font-extrabold text-slate-800 uppercase block leading-none">Inpatient Invoice</span>
                        <span className="text-[9px] text-emerald-500 font-semibold block mt-1 uppercase">✓ Ingested</span>
                      </div>
                    </div>

                    {/* Pipeline Item 2 */}
                    <div className="flex gap-2.5 items-start">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-600 text-[10px] font-bold font-mono">2</div>
                      <div>
                        <span className="text-[10px] font-extrabold text-slate-800 uppercase block leading-none">ER Facility Bill</span>
                        <span className="text-[9px] text-emerald-500 font-semibold block mt-1 uppercase">✓ Ingested</span>
                      </div>
                    </div>

                    {/* Pipeline Item 3 */}
                    <div className="flex gap-2.5 items-start">
                      <div className="w-5 h-5 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-600 text-[10px] font-bold font-mono">3</div>
                      <div>
                        <span className="text-[10px] font-extrabold text-slate-800 uppercase block leading-none">CPT Audit Sweep</span>
                        <span className="text-[9px] text-amber-500 font-bold block mt-1 uppercase flex items-center gap-1 animate-pulse">
                          <AlertTriangle className="w-3 h-3" /> 1 ALERT (UPCODED)
                        </span>
                      </div>
                    </div>

                    {/* Pipeline Item 4 */}
                    <div className="flex gap-2.5 items-start">
                      <div className="w-5 h-5 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-505 text-[10px] font-bold font-mono">4</div>
                      <div>
                        <span className="text-[10px] font-extrabold text-slate-800 uppercase block leading-none">ERISA Appeal Draft</span>
                        <span className="text-[9px] text-indigo-500 font-bold block mt-1 uppercase font-mono">✓ Appeal Ready</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 mt-6 text-center">
                  <span className="text-[9px] text-slate-400 font-mono block">SECURED ENCRYPTED SHARED INTAKE</span>
                </div>
              </div>


              {/* Middle Column: The Live Table and Savings Visual (Loading Automatically) */}
              <div className="lg:col-span-6 space-y-6">
                
                {/* Audit Ledger Card */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-mono">Audit Log</span>
                      <h4 className="text-xs font-black text-slate-900 uppercase">Itemized Claim Audit Table</h4>
                    </div>
                    <span className="text-[9px] text-slate-400 font-mono">REF: SIM-8450</span>
                  </div>

                  {/* Clean Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100">
                          <th className="pb-2">CPT Code</th>
                          <th className="pb-2">Description</th>
                          <th className="pb-2 text-right">Stated</th>
                          <th className="pb-2 text-right text-emerald-600">Adjusted</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 font-medium">
                        
                        {/* Row 1 - Upcode */}
                        <tr className="hover:bg-slate-50 transition">
                          <td className="py-2.5 font-mono font-bold text-slate-700">99285</td>
                          <td className="py-2.5">
                            <span className="text-slate-800 font-bold block uppercase">ER Evaluation Lvl 5</span>
                            <span className="text-[8px] text-red-500 font-bold uppercase block mt-0.5">⚠ Upcode Alert: Hospital lacks severity indices</span>
                          </td>
                          <td className="py-2.5 text-right font-mono text-slate-400">$4,850.00</td>
                          <td className="py-2.5 text-right font-mono font-black text-emerald-500">$1,200.00</td>
                        </tr>

                        {/* Row 2 - Duplicate */}
                        <tr className="hover:bg-slate-50 transition">
                          <td className="py-2.5 font-mono font-bold text-slate-700">96374</td>
                          <td className="py-2.5">
                            <span className="text-slate-800 font-bold block uppercase">Intravenous Infusion</span>
                            <span className="text-[8px] text-orange-500 font-bold uppercase block mt-0.5">⚠ Duplicate Charge: Logged twice in single slot</span>
                          </td>
                          <td className="py-2.5 text-right font-mono text-slate-400">$450.00</td>
                          <td className="py-2.5 text-right font-mono font-black text-emerald-500">$0.00</td>
                        </tr>

                        {/* Row 3 - Dressing Kit */}
                        <tr className="hover:bg-slate-50 transition">
                          <td className="py-2.5 font-mono font-bold text-slate-700">99070</td>
                          <td className="py-2.5">
                            <span className="text-slate-800 font-bold block uppercase">Sterile Dressing Kit</span>
                            <span className="text-[8px] text-slate-400 font-semibold block mt-0.5">Included in facility stock fee limits</span>
                          </td>
                          <td className="py-2.5 text-right font-mono text-slate-400">$350.00</td>
                          <td className="py-2.5 text-right font-mono font-black text-emerald-500">$0.00</td>
                        </tr>

                      </tbody>
                    </table>
                  </div>

                </div>

                {/* Savings Summary Banner Card */}
                <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-center text-left gap-4 shadow-sm">
                  <div>
                    <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest block font-mono">CPT Database Sweep Success</span>
                    <p className="text-xs text-emerald-700 font-semibold mt-1 block leading-relaxed max-w-sm">
                      Overcharge patterns deconstructed automatically. Case meets standard ERISA appeal threshold constraints.
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-500 block uppercase font-mono">Total Saved Relief</span>
                    <span className="text-xl font-black font-mono text-emerald-600 block">-$4,450.00</span>
                    <span className="text-[9px] bg-emerald-500 text-white font-black px-2 py-0.5 rounded-full uppercase tracking-wider block mt-1">78% SAVED</span>
                  </div>
                </div>

              </div>


              {/* Right Column: The Court-Ready Certified Demand Letter */}
              <div className="lg:col-span-3 space-y-6">
                
                {/* Paper Demand Mockup */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm font-mono text-[8px] text-slate-600 space-y-3 relative overflow-hidden leading-relaxed">
                  <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[7px] font-black px-2.5 py-0.5 rounded-bl uppercase tracking-wider">
                    CERTIFIED
                  </div>
                  
                  <p className="font-extrabold text-slate-900 border-b border-slate-100 pb-2 text-[9px] uppercase">
                    RE: CERTIFIED HEALTH DISPUTE INVOICE
                  </p>

                  <div className="space-y-1.5">
                    <p>Pursuant to ERISA regulations codified under federal statute 29 U.S.C. § 1133 and CMS Overcharge Policy Guidelines, demand is hereby made for correction of medical billing charges registered under Account SIM-8450.</p>
                    <p>Clinical logs deconstruct CPT code 99285 (Emergency Dept Lvl 5). No severe life-threatening pathology or complex diagnostic procedures were documented. Records justify only standard Level-3 care (CPT 99283).</p>
                    <p>We demand immediate balance correction to $1,200.00 to satisfy fair local healthcare compliance guidelines.</p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex justify-between text-slate-400 text-[7px] uppercase">
                    <span>STAMP: VERIFIED SYSTEM COUNSEL</span>
                    <span>STATUTE: ERISA-1133</span>
                  </div>
                </div>

                {/* Matchmaking / Advocate details */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm text-left">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block font-mono mb-2">Advocate Connection</span>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 font-bold text-xs uppercase">R</div>
                    <div>
                      <span className="text-[10px] font-black text-slate-800 uppercase block">Registered Advocate</span>
                      <span className="text-[9px] text-slate-500 block">Assigned to dispute file</span>
                    </div>
                  </div>
                </div>

              </div>

            </div>

          </div>

        </div>
      </div>


      {/* SECTION 3: THE LIVE GOVERNANCE PATH FLOW (ZARO STYLE PARTICLES) */}
      <motion.div
        id="how-it-works"
        className="py-16 scroll-mt-24"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.6 }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#0078d4] bg-sky-50 px-3 py-1 rounded border border-sky-100">
              SECURITY PATH
            </span>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight mt-3 font-display">
              HIPAA Secure Compliance Governance Layer
            </h2>
            <p className="text-slate-600 text-xs sm:text-sm mt-3 max-w-xl mx-auto">
              How patient bills translate securely into compliant demand files without exposing confidential clinical indicators.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center max-w-5xl mx-auto">
            
            {/* Left Hand: Interactive SVG Diagram with flowing particles */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-md">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-6 font-mono">
                DATA TRANSMISSION PIPELINE
              </span>

              {/* Dynamic Connecting SVG */}
              <div className="relative w-full h-[220px] bg-slate-50 rounded-2xl border border-slate-100/80 p-4 flex items-center justify-between overflow-hidden">
                
                {/* Core animated SVG */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
                  {/* Definition for gradients and patterns */}
                  <defs>
                    <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="1" />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity="1" />
                    </linearGradient>
                  </defs>

                  {/* Connecting lines */}
                  <path d="M 60 70 Q 180 70 230 110" fill="none" stroke="#e2e8f0" strokeWidth="2" strokeDasharray="4 4" />
                  <path d="M 60 150 Q 180 150 230 110" fill="none" stroke="#e2e8f0" strokeWidth="2" strokeDasharray="4 4" />
                  <path d="M 230 110 Q 360 110 430 110" fill="none" stroke="url(#glowGrad)" strokeWidth="2.5" />

                  {/* Flowing particle animation */}
                  <circle r="4" fill="#10b981">
                    <animateMotion dur="3s" repeatCount="indefinite" path="M 60 70 Q 180 70 230 110" />
                  </circle>
                  <circle r="4" fill="#10b981">
                    <animateMotion dur="2.5s" repeatCount="indefinite" path="M 60 150 Q 180 150 230 110" />
                  </circle>
                  <circle r="5" fill="#6366f1">
                    <animateMotion dur="2s" repeatCount="indefinite" path="M 230 110 Q 360 110 430 110" />
                  </circle>
                </svg>

                {/* Node 1: Ingested Bill */}
                <div className="flex flex-col gap-8 z-10">
                  <div className="bg-white p-3 rounded-xl border border-slate-200 text-left shadow-sm w-[110px]">
                    <span className="text-[8px] text-slate-400 block font-mono">STEP 01</span>
                    <span className="text-[10px] font-black text-slate-800 uppercase block mt-1">Raw Bill Ingest</span>
                    <span className="text-[8px] text-emerald-500 font-bold block mt-1">✓ SSL Encrypted</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200 text-left shadow-sm w-[110px]">
                    <span className="text-[8px] text-slate-400 block font-mono">STEP 02</span>
                    <span className="text-[10px] font-black text-slate-800 uppercase block mt-1">HIPAA Scrub</span>
                    <span className="text-[8px] text-emerald-500 font-bold block mt-1">✓ De-Identified</span>
                  </div>
                </div>

                {/* Node 2: Zaro/BillSlayer Governance Box */}
                <div className="z-10 bg-slate-900 border border-slate-800 text-white p-4 rounded-2xl text-left shadow-lg w-[160px]">
                  <span className="text-[8px] text-slate-400 block font-mono uppercase tracking-wider">COMPLIANCE LAYER</span>
                  <span className="text-[10px] font-black text-white uppercase block mt-1 border-b border-slate-800 pb-1.5 mb-2">BillSlayer Core</span>
                  
                  <div className="space-y-1 text-[8px] text-slate-300">
                    <p className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-emerald-400" /> CPT Verification</p>
                    <p className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-emerald-400" /> ERISA Code check</p>
                    <p className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-indigo-400" /> Audit Trail Logging</p>
                  </div>
                </div>

                {/* Node 3: Court Ready Appeal Output */}
                <div className="z-10 bg-white p-3 rounded-xl border border-slate-200 text-left shadow-sm w-[110px]">
                  <span className="text-[8px] text-slate-400 block font-mono">OUTCOME</span>
                  <span className="text-[10px] font-black text-slate-800 uppercase block mt-1">Appeals Kit</span>
                  <span className="text-[8px] text-emerald-500 font-bold block mt-1">✓ Certified PDF</span>
                </div>

              </div>

            </div>

            {/* Right Hand: Clear narrative explanations */}
            <div className="lg:col-span-5 space-y-6 text-left">
              <div className="space-y-4">
                <div className="flex gap-3 items-start">
                  <div className="p-1.5 rounded-full bg-[#0078d4]/10 text-[#0078d4] mt-0.5">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-950">1. Instant De-identification</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                      Before auditing CPT codes, our pipeline scrubs social security tags, personal address numbers, and clinical ID references.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 items-start">
                  <div className="p-1.5 rounded-full bg-emerald-500/10 text-emerald-600 mt-0.5">
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-950">2. CMS/ERISA Database Check</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                      Our system cross-checks claim entries against official national coding guidelines and state legal pricing limits.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 items-start">
                  <div className="p-1.5 rounded-full bg-amber-500/10 text-amber-600 mt-0.5">
                    <FileCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-950">3. Verified Output Kits</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                      Receive fully compiled, certified, and compliant legal demand packets ready for transmission to health insurers.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={() => onTriggerAuth("client", true)}
                  className="bg-slate-950 hover:bg-slate-900 text-white text-[10px] font-black px-6 py-3 rounded-full uppercase tracking-widest cursor-pointer inline-flex items-center gap-1.5"
                >
                  Start Secure Audit <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

          </div>

        </div>
      </motion.div>


      {/* SECTION 4: UNIFIED DISPUTE SERVICES PORTFOLIO (Replaces Bento cards with high-performance minimalist services catalog) */}
      <div className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#0078d4] bg-sky-50 px-3 py-1 rounded border border-sky-100">
              CORE CAPABILITIES
            </span>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight mt-3 font-display">
              Clinical Auditing & Dispute Solutions <br />
              <span className="text-slate-700 font-semibold font-sans font-display text-lg sm:text-xl block mt-1">Engineered for accuracy and legally verified results</span>
            </h2>
            <p className="text-slate-600 text-xs sm:text-sm mt-3 max-w-xl mx-auto">
              Our specialized processing models target specific insurance denial codes, unfair facility fees, and case timeline compilations with precision.
            </p>
          </div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            variants={{
              hidden: { opacity: 0 },
              show: { opacity: 1, transition: { staggerChildren: 0.1 } },
            }}
          >

            {/* Capability 1 */}
            <motion.div
              variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
              className="bg-white border border-slate-200/80 rounded-2xl p-6 hover:border-[#0078d4]/40 transition-colors duration-200 shadow-xs text-left flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-sky-50 text-[#0078d4] flex items-center justify-center mb-5 border border-sky-100">
                  <Database className="w-5 h-5" />
                </div>
                <h4 className="font-extrabold text-slate-900 text-sm uppercase tracking-tight">Clinical Coding Audit</h4>
                <p className="text-[11px] text-black mt-2 leading-relaxed">
                  Identify and strip duplicate hospital line-items, unbundled facility charges, and incorrect diagnostic CPT billing codes.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[9px] font-mono text-[#0078d4] bg-sky-50 px-2 py-0.5 rounded font-bold uppercase">CPT/HCPCS</span>
                <span className="text-[10px] text-slate-400 font-medium">Auto-scanned</span>
              </div>
            </motion.div>

            {/* Capability 2 */}
            <motion.div
              variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
              className="bg-white border border-slate-200/80 rounded-2xl p-6 hover:border-[#0078d4]/40 transition-colors duration-200 shadow-xs text-left flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-5 border border-emerald-100">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h4 className="font-extrabold text-slate-900 text-sm uppercase tracking-tight">ERISA Appeal Packets</h4>
                <p className="text-[11px] text-black mt-2 leading-relaxed">
                  Generate federal-level ERISA appeals customized to respond to specific health plan denial definitions with supreme authority.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[9px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-bold uppercase">U.S. Title 29</span>
                <span className="text-[10px] text-slate-400 font-medium">Pre-compiled</span>
              </div>
            </motion.div>

            {/* Capability 3 */}
            <motion.div
              variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
              className="bg-white border border-slate-200/80 rounded-2xl p-6 hover:border-[#0078d4]/40 transition-colors duration-200 shadow-xs text-left flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-5 border border-amber-100">
                  <FileText className="w-5 h-5" />
                </div>
                <h4 className="font-extrabold text-slate-900 text-sm uppercase tracking-tight">Out-of-Network Auditing</h4>
                <p className="text-[11px] text-black mt-2 leading-relaxed">
                  Build data-backed dispute arguments utilizing regional Fair Health indices and out-of-network pricing rules.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[9px] font-mono text-amber-600 bg-amber-50 px-2 py-0.5 rounded font-bold uppercase font-mono">Fair Health</span>
                <span className="text-[10px] text-slate-400 font-medium font-mono">Geo-targeted</span>
              </div>
            </motion.div>

            {/* Capability 4 */}
            <motion.div
              variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
              className="bg-white border border-slate-200/80 rounded-2xl p-6 hover:border-[#0078d4]/40 transition-colors duration-200 shadow-xs text-left flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-5 border border-indigo-100">
                  <Activity className="w-5 h-5" />
                </div>
                <h4 className="font-extrabold text-slate-900 text-sm uppercase tracking-tight">Injury Chronologies</h4>
                <p className="text-[11px] text-black mt-2 leading-relaxed">
                  Consolidate patient treatment timelines from multiple medical providers into a single chronological narrative chronology.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[9px] font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-bold uppercase font-mono">Timeline PDF</span>
                <span className="text-[10px] text-slate-400 font-medium">Chronological</span>
              </div>
            </motion.div>

          </motion.div>

        </div>
      </div>


      {/* SECTION 5: THE CORE WORKSPACE DOTTED CONNECTION WHEEL (0:44 to 1:02) */}
      <div className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          
          <motion.div
            className="text-center max-w-3xl mx-auto mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6 }}
          >
            <span className="text-[10px] font-black uppercase tracking-widest text-[#0078d4] bg-sky-50 px-3 py-1 rounded border border-sky-100">
              ECOSYSTEM CONNECTOR
            </span>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight mt-3 font-display">
              Stop wiring up tools &middot; Run one connected system
            </h2>
            <p className="text-slate-600 text-xs sm:text-sm mt-3 max-w-xl mx-auto">
              Your patient records, clinical databases, CMS rules, and legal documents in a single automated framework.
            </p>
          </motion.div>

          {/* Dotted Connections Wheel SVG Canvas Container */}
          <div className="relative max-w-lg mx-auto h-[260px] bg-white border border-slate-200 shadow-md rounded-3xl p-6 flex items-center justify-center overflow-hidden">
            
            {/* Pulsing Central Wheel */}
            <div className="w-16 h-16 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-white z-20 shadow-xl relative animate-pulse">
              <ShieldCheck className="w-8 h-8 text-emerald-400" />
            </div>

            {/* Orbiting nodes */}
            {/* Top Node */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-sm text-[9px] font-bold text-slate-700 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-indigo-500" /> Hospital PDF
            </div>
            {/* Bottom Node */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-sm text-[9px] font-bold text-slate-700 flex items-center gap-1">
              <CourtIcon className="w-3.5 h-3.5 text-amber-500" /> Court ready
            </div>
            {/* Left Node */}
            <div className="absolute left-6 top-1/2 -translate-y-1/2 z-20 bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-sm text-[9px] font-bold text-slate-700 flex items-center gap-1">
              <Database className="w-3.5 h-3.5 text-emerald-500" /> CMS Records
            </div>
            {/* Right Node */}
            <div className="absolute right-6 top-1/2 -translate-y-1/2 z-20 bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-sm text-[9px] font-bold text-slate-700 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-pink-500" /> ERISA Statutes
            </div>

            {/* Glowing Dotted Orbit Lines */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
              {/* Core Orbits */}
              <circle cx="50%" cy="50%" r="80" fill="none" stroke="#f1f5f9" strokeWidth="1" />
              <circle cx="50%" cy="50%" r="80" fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="6 8" className="animate-[spin_40s_linear_infinite]" />
              
              {/* Pulse Lines */}
              <line x1="50%" y1="35" x2="50%" y2="90" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 3" />
              <line x1="50%" y1="170" x2="50%" y2="225" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 3" />
              <line x1="35" y1="50%" x2="190" y2="50%" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 3" />
              <line x1="270" y1="50%" x2="435" y2="50%" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 3" />
            </svg>

          </div>

          {/* Quick Sign Up CTA trigger below the wheel */}
          <div className="mt-10">
            <button
              onClick={() => onTriggerAuth("client", true)}
              className="bg-slate-950 hover:bg-slate-900 text-white text-xs font-black px-8 py-4 rounded-full shadow-md transition duration-200 uppercase tracking-widest cursor-pointer inline-flex items-center gap-2"
            >
              🔒 Claim Your Secure Account <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>


      {/* SECTION 6: THE ESTIMATOR WIDGET (SAVINGS IMPACT ESTIMATOR) */}
      <div id="estimator" className="bg-white py-16 border-b border-slate-200/50 scroll-mt-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#0078d4] bg-sky-50 px-3 py-1 rounded border border-sky-100">
              ESTIMATOR TOOL
            </span>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight mt-3 font-display">
              Dispute Savings Impact Calculator
            </h2>
            <p className="text-slate-600 text-xs sm:text-sm mt-3 max-w-xl mx-auto">
              Simulate standard adjustments based on typical CPT coding audit corrections and insurance billing error rates.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-6 sm:p-10 max-w-4xl mx-auto text-left shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-baseline gap-2 mb-8">
              <div>
                <span className="text-[9px] text-emerald-600 font-black uppercase tracking-widest font-mono block">Sub-module Estimator</span>
                <h3 className="text-base font-black text-slate-900 uppercase mt-1">Dispute Savings Calculator</h3>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Drag slider to adjust invoice balance</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
              <div className="md:col-span-7 space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Original Bill Balance</span>
                    <span className="text-base font-extrabold font-mono text-slate-900">${estimateAmount.toLocaleString()}</span>
                  </div>
                  <input
                    type="range"
                    min="500"
                    max="50000"
                    step="250"
                    value={estimateAmount}
                    onChange={(e) => setEstimateAmount(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {(["unbundled", "upcoded", "duplicate", "denied"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setEstimateErrorType(type)}
                      className={`p-3 text-left rounded-xl border text-[10px] font-bold uppercase transition cursor-pointer ${
                        estimateErrorType === type
                          ? "bg-white border-emerald-500 ring-1 ring-emerald-500 text-slate-950 shadow-sm"
                          : "bg-white/50 border-slate-200 text-slate-500 hover:border-slate-300"
                      }`}
                    >
                      {type === "unbundled" && "Unbundling"}
                      {type === "upcoded" && "Upcoding"}
                      {type === "duplicate" && "Duplicates"}
                      {type === "denied" && "Denial"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="md:col-span-5 bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 text-left">
                <span className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Estimated Audit Relief</span>
                <motion.div className="text-2xl font-black font-mono text-emerald-400 mt-2 font-mono">
                  -${Math.round(displayedReliefAmount).toLocaleString()}.00
                </motion.div>
                <div className="pt-3 border-t border-slate-800 mt-4 flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold uppercase">Target Balance:</span>
                  <motion.span className="font-extrabold font-mono text-white font-mono">
                    ${Math.round(displayedTargetBalance).toLocaleString()}.00
                  </motion.span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>


      {/* SECTION 7: PRICING PLANS */}
      <div id="pricing" className="py-16 scroll-mt-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          
          <motion.div
            className="text-center max-w-3xl mx-auto mb-14"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6 }}
          >
            <span className="text-[10px] font-black uppercase tracking-widest text-[#0078d4] bg-sky-50 px-3 py-1 rounded border border-sky-100">
              PRICING PLANS
            </span>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight mt-3 font-display">
              Transparent Pricing for every advocate
            </h2>
            <p className="text-slate-600 text-xs sm:text-sm mt-3 max-w-xl mx-auto">
              Get secure clinical audits with complete pay-per-generation clarity, or scale with professional advocate subscriptions.
            </p>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto items-stretch"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            variants={{
              hidden: { opacity: 0 },
              show: { opacity: 1, transition: { staggerChildren: 0.1 } },
            }}
          >

            {/* Plan 1 */}
            <motion.div
              variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
              className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-sm relative hover:border-indigo-500 transition-colors duration-250 text-left"
            >
              <div>
                <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Free Account</span>
                <h3 className="text-lg font-extrabold text-slate-900 uppercase mt-1">One-Time Payer</h3>
                <div className="my-6">
                  <span className="text-3xl font-black font-mono text-slate-950">$15</span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold ml-1">/ generation</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed mb-6">
                  Perfect for individual patients requiring a single dispute document or billing overcharge verification.
                </p>
                <ul className="space-y-3 text-[11px] text-slate-600 mb-8 border-t border-slate-100 pt-6">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>1 Complete Case Audit Letter</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>PDF & Word Format Exports</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>HIPAA Compliant Safe Vault</span>
                  </li>
                </ul>
              </div>
              <button
                onClick={() => onTriggerAuth("client", true)}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-black py-3.5 rounded-xl transition duration-200 uppercase tracking-wider text-center cursor-pointer"
              >
                Get Started Free
              </button>
            </motion.div>

            {/* Plan 2 */}
            <motion.div
              variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
              className="bg-white border-2 border-emerald-500 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-md relative hover:shadow-lg transition-shadow duration-250 text-left"
            >
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[8px] font-black px-4 py-1 rounded-full uppercase tracking-widest">
                Most Popular
              </div>
              <div>
                <span className="text-[9px] font-bold uppercase text-emerald-600 tracking-wider">Advocate Team</span>
                <h3 className="text-lg font-extrabold text-slate-900 uppercase mt-1">Professional Clinic</h3>
                <div className="my-6">
                  <span className="text-3xl font-black font-mono text-slate-950">$89</span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold ml-1">/ month</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed mb-6">
                  Designed for professional medical billing clinics, patient support leagues, and family health practices.
                </p>
                <ul className="space-y-3 text-[11px] text-slate-600 mb-8 border-t border-slate-100 pt-6">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span className="font-bold text-slate-800">10 Audits Included / Month</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Client Intake Matchmaking</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Advanced CPT Overlap Filters</span>
                  </li>
                </ul>
              </div>
              <button
                onClick={() => onTriggerAuth("clinic", true)}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black py-3.5 rounded-xl shadow-md transition duration-200 uppercase tracking-wider text-center cursor-pointer"
              >
                Activate Clinic Plan
              </button>
            </motion.div>

            {/* Plan 3 */}
            <motion.div
              variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
              className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-sm relative hover:border-indigo-500 transition-colors duration-250 text-left"
            >
              <div>
                <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Enterprise Legals</span>
                <h3 className="text-lg font-extrabold text-slate-900 uppercase mt-1">Elite Lawyer</h3>
                <div className="my-6">
                  <span className="text-3xl font-black font-mono text-slate-950">$199</span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold ml-1">/ month</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed mb-6">
                  Configured for legal practices, health law practices, litigation teams, and senior medical billing advisors.
                </p>
                <ul className="space-y-3 text-[11px] text-slate-600 mb-8 border-t border-slate-100 pt-6">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span className="font-bold text-slate-800">35 Audits Included / Month</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Certified Firm Logo Seal</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Direct Court-Ready Formats</span>
                  </li>
                </ul>
              </div>
              <button
                onClick={() => onTriggerAuth("lawyer", true)}
                className="w-full bg-slate-950 hover:bg-slate-900 text-white text-[10px] font-black py-3.5 rounded-xl transition duration-200 uppercase tracking-wider text-center cursor-pointer"
              >
                Activate Lawyer Plan
              </button>
            </motion.div>

          </motion.div>

        </div>
      </div>
        </>
      }


      {/* SECTION 8: SUPPORT & TIPS HUB (INCLUDING RECOVERY METRICS, LEARNING PORTIONS, AND FAQS) */}
      {showSupportTipsOnly &&
      <div id="support-tips" className="bg-[#FAFBFD] py-16 border-b border-slate-200/50 scroll-mt-24">
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
              <p className="text-slate-300 text-xs sm:text-sm leading-relaxed max-w-2xl font-sans">
                Understanding medical denial appeals, CPT audits, and injury chronologies is complex. Learn from industry-standard metrics, guides, and fair-billing policies
              </p>
            </div>
          </div>

          {/* Metrics Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-2.5 text-emerald-950 border-b border-slate-200/80 pb-3 text-left">
              <Activity className="w-5 h-5 text-emerald-600" />
              <h3 className="text-xs font-black uppercase tracking-widest font-mono text-slate-900">
                MEDICAL BILLING & INSURANCE RECOVERY METRICS
              </h3>
            </div>
            
            <motion.div
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
              variants={{
                hidden: { opacity: 0 },
                show: { opacity: 1, transition: { staggerChildren: 0.1 } },
              }}
            >
              {/* Card 1 */}
              <motion.div
                variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.98 }}
                className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-200 text-left"
              >
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
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Most clinical facilities lose 10% or more of annual billing due to clerical coding errors and arbitrary insurance claims denials
                  </p>
                </div>
              </motion.div>

              {/* Card 2 */}
              <motion.div
                variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.98 }}
                className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-200 text-left"
              >
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
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Over $31.2 billion in clinical billing claims are rejected by medical insurance groups annually, requiring administrative appeal processing
                  </p>
                </div>
              </motion.div>

              {/* Card 3 */}
              <motion.div
                variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.98 }}
                className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-200 text-left"
              >
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
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Up to 67% of denied medical claims are successfully recovered when supported by professional, CPT-validated dispute appeals letters
                  </p>
                </div>
              </motion.div>
            </motion.div>
          </div>

          {/* Learning Portions */}
          <div className="space-y-6">
            <div className="flex items-center gap-2.5 text-emerald-950 border-b border-slate-200/80 pb-3 text-left">
              <FileText className="w-5 h-5 text-emerald-600" />
              <h3 className="text-xs font-black uppercase tracking-widest font-mono text-slate-900">
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
                  <p className="text-[11px] text-slate-500 leading-relaxed mt-2.5">
                    Medical billing processes require mapping patient services into standardized CPT (Current Procedural Terminology) and ICD-10 (International Classification of Diseases) billing codes. Inconsistencies occur when:
                  </p>
                  <ul className="space-y-3 mt-4 text-[11px] text-slate-600">
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      <div>
                        <strong className="text-slate-800 font-extrabold">Upcoding Errors:</strong> Unintentionally charging for complex treatments that exceed the actual procedure logged
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      <div>
                        <strong className="text-slate-800 font-extrabold">Unbundling Coding:</strong> Separating and billing individual CPT components of a single integrated service to increase claim amount falsely
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      <div>
                        <strong className="text-slate-800 font-extrabold">Duplicate Items:</strong> Charging multiple times for disposable supplies or physician hours on a single claim ledger
                      </div>
                    </li>
                  </ul>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-[11px] text-emerald-950 leading-relaxed">
                  <strong className="font-extrabold text-emerald-900 block uppercase tracking-wider text-[9px] mb-1">Key Takeaway</strong>
                  BillSlayer AI performs an automated audit to cross-reference CPT billing against standard national procedures, allowing clients to reclaim money and challenge errors directly
                </div>
              </div>

              {/* Module 2 */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-xs hover:shadow-md transition duration-200 text-left space-y-6">
                <div>
                  <h4 className="text-base sm:text-lg font-extrabold text-emerald-600 flex items-center gap-2">
                    <CourtIcon className="w-5 h-5 text-emerald-500" />
                    Module 2: Formulating Legal Demand Packages
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed mt-2.5">
                    For personal injury lawyers, a Settlement Demand Package compiles evidence of third-party negligence and links it to physical and financial damages. Writing these involves:
                  </p>
                  <ul className="space-y-3 mt-4 text-[11px] text-slate-600">
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      <div>
                        <strong className="text-slate-800 font-extrabold">Treatment Chronology:</strong> Creating an exact timeline mapping doctor notes, emergency room visits, therapy timelines, and diagnosis records
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      <div>
                        <strong className="text-slate-800 font-extrabold">Damages Calculation:</strong> Aggregating emergency care costs, future therapeutic demands, lost wages, and pain & suffering indexes
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      <div>
                        <strong className="text-slate-800 font-extrabold">Liability Arguments:</strong> Using police reports, accident notes, and traffic citations to substantiate negligence claims
                      </div>
                    </li>
                  </ul>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-[11px] text-emerald-950 leading-relaxed">
                  <strong className="font-extrabold text-emerald-900 block uppercase tracking-wider text-[9px] mb-1">Key Takeaway</strong>
                  BillSlayer AI slashes legal preparation times from 15 hours to minutes, compiling structured Demand Packages and timelines that lawyers use to negotiate maximum claim valuations
                </div>
              </div>
            </div>
          </div>

          {/* FAQs Accordion */}
          <div id="faq" className="space-y-6">
            <div className="flex items-center gap-2.5 text-emerald-950 border-b border-slate-200/80 pb-3 text-left">
              <Shield className="w-5 h-5 text-emerald-600" />
              <h3 className="text-xs font-black uppercase tracking-widest font-mono text-slate-900">
                FREQUENTLY ASKED QUESTIONS
              </h3>
            </div>

            <div className="space-y-4 max-w-4xl mx-auto">
              {[
                {
                  q: "How does BillSlayer AI protect personal information?",
                  a: "HIPAA compliance and data security are core requirements. We maintain strict role-based access isolation where clients, lawyers, and clinics operate in secure, independent portals. Documents generated are treated as one-time secure downloads or held securely within premium subscriber workspaces"
                },
                {
                  q: "What is the difference between Pay-Per-Case and Subscription Workspaces?",
                  a: "One-time users can upload single billing sheets or record packages and pay a fixed fee (e.g. $10 to $30) to generate and download their document once. High-volume clinical billers and legal groups can purchase Subscription Workspaces which provide complete case history tracking, analytics, and reusable monthly credits with zero file storage limits"
                },
                {
                  q: "What is an upcoded or unbundled charge in a medical bill?",
                  a: "Upcoding occurs when a healthcare provider logs a more severe CPT code than what was actually performed, artificially increasing the cost. Unbundling occurs when they bill separate fees for multiple components of a service that should have been grouped into a single standard package code"
                },
                {
                  q: "Is my personal patient and diagnostic data HIPAA secure?",
                  a: "Absolutely. BillSlayer AI utilizes modern de-identification algorithms to strip personal patient identification from raw medical data before checking databases. All transfers are encrypted, and we strictly comply with all HIPAA administrative and security mandates"
                },
                {
                  q: "How does the pay-per-generation option work?",
                  a: "Our system has zero ongoing commitments. You can sign up for a free patient account, input your case details, and the system will run an initial scan. Before creating any certified dispute letter or detailed CPT audit, you trigger a secure $15 Stripe payment. Once paid, the full document unlocks instantly"
                },
                {
                  q: "Can I use BillSlayer appeal letters for court disputes?",
                  a: "Yes. Our appeal letters are drafted using standard clinical and regulatory syntax, citing ERISA regulations and relevant CMS guidelines. However, you should consult with a qualified health advocate or attorney if you intend to pursue formal litigation"
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

                  <AnimatePresence initial={false}>
                    {expandedFaq === index && (
                      <motion.div
                        key="answer"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="px-6 pb-5 text-xs text-slate-500 leading-relaxed border-t border-slate-100 pt-3 bg-slate-50/50">
                          {item.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
      }

      {/* SECTION 9: SECURE CONTACT US GATEWAY */}
      {!showSupportTipsOnly &&
      <div id="contact-section" className="py-20 scroll-mt-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-stretch">
            
            {/* Left Column: Helpdesk & Authority Card */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-md text-left relative overflow-hidden flex flex-col justify-between h-full">
              <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500"></div>
              
              <div className="space-y-6">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1 rounded border border-emerald-100 inline-block">
                    SECURE COMPLIANCE DESK
                  </span>
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight mt-3 font-display">
                    Get in Touch
                  </h2>
                  <p className="text-xs text-slate-600 mt-3 leading-relaxed font-medium">
                    Have questions about medical bill auditing, CPT code disputes, clinical account setups, or data protection? Contact our regulatory support desk directly.
                  </p>
                </div>

                {/* Support details list */}
                <div className="space-y-4">
                  <div className="flex gap-4 p-5 bg-emerald-50/40 border border-emerald-100 rounded-2xl items-center">
                    <span className="p-3 bg-emerald-500 text-white rounded-xl flex items-center justify-center font-bold text-lg h-12 w-12 shrink-0 shadow-xs">
                      <Mail className="w-6 h-6" />
                    </span>
                    <div>
                      <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block mb-0.5">Contact Email Address</span>
                      <a href="mailto:billslayerai@gmail.com" className="text-sm text-emerald-600 hover:text-emerald-700 font-extrabold transition-colors block">
                        billslayerai@gmail.com
                      </a>
                      <span className="text-[9px] text-slate-500 font-medium block mt-0.5">Response guaranteed within 2 hours</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4 text-[10px] text-emerald-800 font-medium leading-relaxed flex items-start gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" /> <span><strong>HIPAA Notice:</strong> Please do not submit actual un-redacted clinical medical records or raw SSN numbers via this public support gateway. Redacted dispute summaries are safe.</span>
              </div>
            </div>

            {/* Right Column: Interactive Secure Form */}
            <motion.div
              className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-md text-left relative overflow-hidden flex flex-col justify-between h-full"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6 }}
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500"></div>

              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-6 flex items-center gap-2">
                  <Send className="w-4 h-4 text-emerald-600" /> Submit a Compliance Message
                </h3>

                {contactStatus === "success" ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-6 text-center space-y-3"
                  >
                    <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600 font-black text-lg">
                      ✓
                    </div>
                    <h4 className="font-extrabold text-sm uppercase text-emerald-800">Message Transmitted Securely</h4>
                    <p className="text-[11px] text-emerald-700 leading-relaxed max-w-sm mx-auto">
                      Thank you, <strong>{contactName}</strong>! Your inquiry regarding <strong>{contactSubject}</strong> has been sent directly to our email ID <strong>billslayerai@gmail.com</strong>. Reference Ticket <strong>#SLY-{Math.floor(Math.random() * 9000) + 1000}</strong>.
                    </p>
                    
                    <button 
                      onClick={() => {
                        setContactName("");
                        setContactEmail("");
                        setContactMessage("");
                        setContactStatus("idle");
                      }}
                      className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black px-4 py-2 rounded-lg uppercase tracking-wider transition cursor-pointer font-mono"
                    >
                      Send Another Message
                    </button>
                  </motion.div>
                ) : (
                  <form onSubmit={handleContactSubmit} className="space-y-4">
                    {contactStatus === "error" && (
                      <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-xl p-3 flex items-center gap-2 font-semibold">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Transmission failed. Please verify all fields are filled and try again.
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Your Full Name <span className="text-rose-500">*</span></label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. John Doe"
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-emerald-500 transition-colors focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Email Address <span className="text-rose-500">*</span></label>
                        <input
                          type="email"
                          required
                          placeholder="e.g. john@example.com"
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-emerald-500 transition-colors focus:bg-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Dispute / Inquiry Type</label>
                      <select
                        value={contactSubject}
                        onChange={(e) => setContactSubject(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors"
                      >
                        <option value="Medical Bill Upcoding">Medical Bill Upcoding Audit</option>
                        <option value="Double Billing">Duplicate/Double Charges</option>
                        <option value="Insurance Denial">Insurance / ERISA Appeal Help</option>
                        <option value="Enterprise Clinic Plan">Enterprise Clinic Pricing</option>
                        <option value="Other Inquiries">General / Other Support</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Detailed Message <span className="text-rose-500">*</span></label>
                      <textarea
                        required
                        rows={4}
                        placeholder="Please describe your billing dispute context, hospital code issue, or regulatory question..."
                        value={contactMessage}
                        onChange={(e) => setContactMessage(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-emerald-500 transition-colors focus:bg-white"
                      ></textarea>
                    </div>

                    <motion.button
                      type="submit"
                      disabled={contactStatus === "sending"}
                      whileTap={{ scale: 0.97 }}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] py-3 rounded-xl transition duration-150 uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:scale-101"
                    >
                      {contactStatus === "sending" ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Transmitting Compliance Ticket...
                        </>
                      ) : (
                        <>
                          <span>Transmit Secure Help Request</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </motion.button>
                  </form>
                )}
              </div>
            </motion.div>
          </div>

        </div>
      </div>
      }

      <motion.footer
        className="bg-[#051713] text-white py-4 border-t border-emerald-500/20 text-left"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6 }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-4">
            
            {/* Col 1 */}
            <div>
              <div className="flex items-center gap-1.5 mb-3 text-left">
                {/* Homepage Header Branded Matching Logo */}
                <div className="relative flex items-center justify-center">
                  <ShieldCheck className="w-7 h-7 text-emerald-450" />
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#00df89] rounded-full animate-pulse" />
                </div>
                <div className="flex items-baseline">
                  <span className="font-extrabold text-xl text-white tracking-tight">bill</span>
                  <span className="font-black text-xl text-[#00df89] tracking-tight">slayer</span>
                  <span className="text-[10px] font-bold text-slate-300 ml-1 uppercase tracking-widest font-mono">AI</span>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-slate-100 leading-relaxed text-left font-medium">
                Verified Legal-Medical Dispute and CPT Audit workspace. HIPAA Protected and compliant data encryption system.
              </p>
            </div>

            {/* Col 2 */}
            <div className="text-left">
              <h4 className="text-white text-xs font-black uppercase tracking-wider mb-2 pb-0.5 border-b border-[#00df89]/10">Product</h4>
              <ul className="space-y-2 text-xs font-medium">
                <li>
                  <button onClick={() => onNavigate ? onNavigate("estimator") : document.getElementById("estimator")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="text-slate-100 hover:text-[#00df89] transition duration-200 cursor-pointer text-left block w-full p-0 bg-transparent font-medium text-xs">
                    Savings Calculator
                  </button>
                </li>
                <li>
                  <button onClick={() => onTriggerAuth("client", true)} className="text-slate-100 hover:text-[#00df89] transition duration-200 cursor-pointer text-left block w-full p-0 bg-transparent font-medium text-xs">
                    Patient Portal
                  </button>
                </li>
                <li>
                  <button onClick={() => onTriggerAuth("clinic", true)} className="text-slate-100 hover:text-[#00df89] transition duration-200 cursor-pointer text-left block w-full p-0 bg-transparent font-medium text-xs">
                    Clinical Accounts
                  </button>
                </li>
              </ul>
            </div>

            {/* Col 3 */}
            <div className="text-left">
              <h4 className="text-white text-xs font-black uppercase tracking-wider mb-2 pb-0.5 border-b border-[#00df89]/10">Resources</h4>
              <ul className="space-y-2 text-xs font-medium">
                <li>
                  <button onClick={() => onNavigate ? onNavigate("support-tips") : document.getElementById("support-tips")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="text-slate-100 hover:text-[#00df89] transition duration-200 cursor-pointer text-left block w-full p-0 bg-transparent font-medium text-xs">
                    Support & Tips
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate ? onNavigate("support-tips") : document.getElementById("support-tips")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="text-slate-100 hover:text-[#00df89] transition duration-200 cursor-pointer text-left block w-full p-0 bg-transparent font-medium text-xs">
                    ERISA Dispute Laws
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate ? onNavigate("support-tips") : document.getElementById("support-tips")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="text-slate-100 hover:text-[#00df89] transition duration-200 cursor-pointer text-left block w-full p-0 bg-transparent font-medium text-xs">
                    Standard Billing Codes
                  </button>
                </li>
              </ul>
            </div>

            {/* Col 4 */}
            <div className="text-left">
              <h4 className="text-white text-xs font-black uppercase tracking-wider mb-2 pb-0.5 border-b border-[#00df89]/10">Security</h4>
              <div className="space-y-2 text-xs sm:text-sm text-slate-100 leading-relaxed text-left font-medium">
                <p className="flex items-center gap-2">🔒 <span className="text-xs">HIPAA Standard Certified Hub</span></p>
                <p className="flex items-center gap-2">🔒 <span className="text-xs">Secure Stripe PCI-DSS Payments</span></p>
              </div>
            </div>

          </div>

          <div className="pt-4 border-t border-slate-800/60 text-center text-[11px] sm:text-xs text-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 font-normal">
            <span className="text-slate-100">© 2026 BillSlayer AI System. All administrative rights reserved.</span>
            <div className="flex gap-4 font-normal">
              <span className="hover:text-[#00df89] text-slate-100 transition duration-150 cursor-pointer text-[11px] sm:text-xs">Security Policy</span>
              <span className="hover:text-[#00df89] text-slate-100 transition duration-150 cursor-pointer text-[11px] sm:text-xs">Terms of Use</span>
              <span className="hover:text-[#00df89] text-slate-100 transition duration-150 cursor-pointer text-[11px] sm:text-xs">HIPAA Disclosures</span>
            </div>
          </div>
        </div>
      </motion.footer>

    </div>
  );
}
