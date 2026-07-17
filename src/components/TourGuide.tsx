import React, { useState, useEffect } from "react";
import { UserRole } from "../types";
import { HelpCircle, ChevronRight, ChevronLeft, X, Sparkles, BookOpen, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface TourStep {
  title: string;
  description: string;
  selector?: string; // CSS selector to point to (or general info if empty)
  icon: React.ReactNode;
}

interface TourGuideProps {
  role: UserRole;
  userId: string;
}

export default function TourGuide({ role, userId }: TourGuideProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [elementRect, setElementRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  const clientSteps: TourStep[] = [
    {
      title: "Welcome to BillSlayer Client Workspace!",
      description: "This is your secure, HIPAA-compliant space to audit medical bills and fight unfair insurance denials. Let's take a quick 1-minute interactive tour!",
      icon: <Sparkles className="w-6 h-6 text-indigo-500" />
    },
    {
      title: "Private Dispute Case Files",
      description: "Start here by uploading your medical bills or insurance denial PDFs. We extract and analyze line-items for CPT billing errors or unbundled facility fees.",
      selector: "#private-cases-section",
      icon: <BookOpen className="w-6 h-6 text-[#0078d4]" />
    },
    {
      title: "AI Dispute Suite & Generation",
      description: "Pick your medical-legal strategy—like Clinical Coding Audits or ERISA Appeal Packets. Add any notes, then click the Generate button to instantly compile your document.",
      selector: "#ai-generation-section",
      icon: <ShieldCheck className="w-6 h-6 text-emerald-500" />
    },
    {
      title: "Premium Subscription & Billing",
      description: "Review your current account limits, upgrade to a professional subscription with included monthly audits, or manage your active plan parameters here.",
      selector: "#billing-section",
      icon: <ShieldCheck className="w-6 h-6 text-amber-500" />
    },
    {
      title: "Consent-Based Law Matching",
      description: "Need legal representation? Toggle your Matchmaking Consent to securely match with elite ERISA and healthcare dispute lawyers in our verified network.",
      selector: "#matchmaking-section",
      icon: <Sparkles className="w-6 h-6 text-pink-500" />
    }
  ];

  const lawyerSteps: TourStep[] = [
    {
      title: "Welcome to the Lawyer Litigation Portal!",
      description: "Engineered for elite advocacy. Here you can build federal-level ERISA appeals, conduct regional price index audits, and receive matched client leads.",
      icon: <Sparkles className="w-6 h-6 text-indigo-500" />
    },
    {
      title: "Litigation Case Files",
      description: "Manage client files, upload insurance correspondence, and structure medical records. Each case acts as a container for your pleadings, chronologies, and appeals.",
      selector: "#private-cases-section",
      icon: <BookOpen className="w-6 h-6 text-[#0078d4]" />
    },
    {
      title: "Professional Document Suite",
      description: "Select court-ready templates to generate high-authority injury chronologies, ERISA appeals, or out-of-network pricing disputes using regional Fair Health databases.",
      selector: "#ai-generation-section",
      icon: <ShieldCheck className="w-6 h-6 text-emerald-500" />
    },
    {
      title: "Subscription & Billing Control",
      description: "Check your active litigation account tier, credits, and renew or upgrade your professional lawyer plan here.",
      selector: "#billing-section",
      icon: <ShieldCheck className="w-6 h-6 text-amber-500" />
    },
    {
      title: "Verified Matchmaking Leads",
      description: "Connect with patients seeking expert legal disputes. Both you and the client must explicitly consent before contact info is exchanged to maintain strict compliance.",
      selector: "#matchmaking-section",
      icon: <Sparkles className="w-6 h-6 text-teal-500" />
    }
  ];

  const clinicSteps: TourStep[] = [
    {
      title: "Welcome to the Medical Clinic Workspace!",
      description: "Optimized for healthcare providers and billers to prevent facility denial penalties, audit unbundled codes, and maintain compliance standards.",
      icon: <Sparkles className="w-6 h-6 text-indigo-500" />
    },
    {
      title: "Clinical Claim Files",
      description: "Consolidate claim packages, upload CPT billing sheets, and track dispute timelines. Keeps all patient billing claims securely organized.",
      selector: "#private-cases-section",
      icon: <BookOpen className="w-6 h-6 text-[#0078d4]" />
    },
    {
      title: "CPT/HCPCS Audit Generator",
      description: "Instantly audit duplicate hospital line-items, check unbundled facility charges, and print authoritative, medically backed appeals.",
      selector: "#ai-generation-section",
      icon: <ShieldCheck className="w-6 h-6 text-emerald-500" />
    },
    {
      title: "Subscription & Billing limits",
      description: "Check your active clinical enterprise account tier, credits, and upgrade or renew your professional organization plan here.",
      selector: "#billing-section",
      icon: <ShieldCheck className="w-6 h-6 text-amber-500" />
    }
  ];

  const steps = role === "client" ? clientSteps : (role === "lawyer" ? lawyerSteps : clinicSteps);

  useEffect(() => {
    // If the user has never completed the tour, trigger it automatically!
    const isCompleted = localStorage.getItem(`billslayer_tour_completed_${userId}`);
    if (!isCompleted) {
      setIsOpen(true);
    }
  }, [userId]);

  // Handle continuous element bounding rect measurement and smooth scrolling
  useEffect(() => {
    if (!isOpen) {
      setElementRect(null);
      return;
    }

    const selector = steps[currentStep]?.selector;
    if (!selector) {
      setElementRect(null);
      return;
    }

    let active = true;
    let frameId: number;

    const measure = () => {
      if (!active) return;
      const element = document.querySelector(selector);
      if (element) {
        const rect = element.getBoundingClientRect();
        setElementRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height
        });
      } else {
        setElementRect(null);
      }
      frameId = requestAnimationFrame(measure);
    };

    // Scroll element into view once on step change
    const element = document.querySelector(selector);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    measure();

    return () => {
      active = false;
      cancelAnimationFrame(frameId);
    };
  }, [isOpen, currentStep, steps]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem(`billslayer_tour_completed_${userId}`, "true");
    setIsOpen(false);
    setCurrentStep(0);
  };

  // Calculate dynamic styling for the popover card to place next to the highlighted element
  const getCardStyle = () => {
    if (!elementRect) {
      return {
        position: "fixed" as const,
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 51,
        maxWidth: "440px",
        width: "100%"
      };
    }

    const cardWidth = 380;
    const cardHeight = 260;

    // 1. Check if there is enough room below the highlighted element
    if (elementRect.top + elementRect.height + cardHeight + 24 < window.innerHeight) {
      return {
        position: "fixed" as const,
        top: `${elementRect.top + elementRect.height + 16}px`,
        left: `${Math.max(16, Math.min(window.innerWidth - cardWidth - 16, elementRect.left + (elementRect.width - cardWidth) / 2))}px`,
        zIndex: 51,
        width: `${cardWidth}px`
      };
    }

    // 2. Check if there is enough room above the highlighted element
    if (elementRect.top - cardHeight - 24 > 0) {
      return {
        position: "fixed" as const,
        top: `${elementRect.top - cardHeight - 16}px`,
        left: `${Math.max(16, Math.min(window.innerWidth - cardWidth - 16, elementRect.left + (elementRect.width - cardWidth) / 2))}px`,
        zIndex: 51,
        width: `${cardWidth}px`
      };
    }

    // 3. Check if there is enough room to the left
    if (elementRect.left - cardWidth - 24 > 0) {
      return {
        position: "fixed" as const,
        top: `${Math.max(16, Math.min(window.innerHeight - cardHeight - 16, elementRect.top + (elementRect.height - cardHeight) / 2))}px`,
        left: `${elementRect.left - cardWidth - 16}px`,
        zIndex: 51,
        width: `${cardWidth}px`
      };
    }

    // 4. Check if there is enough room to the right
    if (elementRect.left + elementRect.width + cardWidth + 24 < window.innerWidth) {
      return {
        position: "fixed" as const,
        top: `${Math.max(16, Math.min(window.innerHeight - cardHeight - 16, elementRect.top + (elementRect.height - cardHeight) / 2))}px`,
        left: `${elementRect.left + elementRect.width + 16}px`,
        zIndex: 51,
        width: `${cardWidth}px`
      };
    }

    // 5. Default fallback to centered popover
    return {
      position: "fixed" as const,
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      zIndex: 51,
      maxWidth: "440px",
      width: "100%"
    };
  };

  return (
    <>
      {/* FLOATING ACTION QUESTION MARK BUTTON - Aligned bottom-right corner */}
      <button
        onClick={() => {
          setCurrentStep(0);
          setIsOpen(true);
        }}
        className="fixed bottom-6 right-6 z-40 bg-slate-900 hover:bg-indigo-600 text-white font-bold text-xs px-4 py-3 rounded-full shadow-2xl flex items-center gap-2 hover:scale-105 active:scale-95 transition-all cursor-pointer border border-slate-800"
        title="Interactive Workspace Guide"
        id="tour-guide-trigger"
      >
        <HelpCircle className="w-4 h-4 text-emerald-400" />
        <span>Workspace Guide</span>
      </button>

      {/* INTERACTIVE SPOTLIGHT OVERLAY & POPOVER */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop spotlight path layout */}
            <div className="fixed inset-0 z-50 pointer-events-none">
              {elementRect ? (
                <>
                  {/* SVG dark layout with spotlight cut-out hole */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-auto">
                    <defs>
                      <mask id="spotlight-mask">
                        <rect width="100%" height="100%" fill="white" />
                        <rect
                          x={elementRect.left - 12}
                          y={elementRect.top - 12}
                          width={elementRect.width + 24}
                          height={elementRect.height + 24}
                          rx="16"
                          fill="black"
                        />
                      </mask>
                    </defs>
                    <rect
                      width="100%"
                      height="100%"
                      fill="rgba(3, 7, 18, 0.65)"
                      mask="url(#spotlight-mask)"
                    />
                  </svg>
                  {/* Active glowing ring overlay */}
                  <div
                    className="absolute border-2 border-indigo-500 rounded-2xl shadow-[0_0_25px_rgba(99,102,241,0.5)] animate-pulse pointer-events-none"
                    style={{
                      top: `${elementRect.top - 12}px`,
                      left: `${elementRect.left - 12}px`,
                      width: `${elementRect.width + 24}px`,
                      height: `${elementRect.height + 24}px`,
                      transition: "all 0.2s ease-out"
                    }}
                  />
                </>
              ) : (
                /* Simple blurred dimmer for welcome card or fallback card */
                <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs pointer-events-auto" />
              )}
            </div>

            {/* Tour onboarding dialog popover box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              style={getCardStyle()}
              className="bg-white border border-slate-200 shadow-2xl rounded-2xl overflow-hidden text-left flex flex-col justify-between"
            >
              {/* Tour progress bar */}
              <div className="w-full h-1 bg-slate-100 relative">
                <div
                  className="h-full bg-indigo-600 transition-all duration-300"
                  style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                />
              </div>

              {/* Close Button */}
              <button
                onClick={handleComplete}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="p-6">
                <div className="flex items-center gap-3.5 mb-4">
                  <div className="p-2.5 bg-indigo-50 rounded-xl">
                    {steps[currentStep].icon}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">
                      Step {currentStep + 1} of {steps.length}
                    </span>
                    <h3 className="text-sm font-extrabold text-slate-950 tracking-tight">
                      {steps[currentStep].title}
                    </h3>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed font-sans font-medium">
                  {steps[currentStep].description}
                </p>

                {steps[currentStep].selector && !elementRect && (
                  <div className="mt-3.5 p-2.5 bg-amber-50 border border-amber-100 rounded-xl text-[10px] text-amber-800 leading-normal font-bold">
                    💡 Hint: Select a case or active file to see this section highlighted live!
                  </div>
                )}
              </div>

              {/* Navigation buttons */}
              <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex items-center justify-between">
                <button
                  onClick={handleComplete}
                  className="text-[10px] text-slate-400 hover:text-slate-600 font-bold uppercase cursor-pointer"
                >
                  Skip Guide
                </button>

                <div className="flex items-center gap-2">
                  {currentStep > 0 && (
                    <button
                      onClick={handleBack}
                      className="px-3 py-1.5 border border-slate-200 hover:bg-white text-slate-600 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      Back
                    </button>
                  )}

                  <button
                    onClick={handleNext}
                    className="px-4 py-1.5 bg-slate-950 hover:bg-indigo-600 text-white text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1"
                  >
                    {currentStep === steps.length - 1 ? "Finish Tour" : "Next"}
                    {currentStep !== steps.length - 1 && <ChevronRight className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
