import React, { useState, useEffect } from "react";
import { User, Case, GeneratedDocument, Match, AppNotification, PLANS, PRICING_PER_CASE } from "../types";
import PDFPreview from "../components/PDFPreview";
import { downloadAsPDF, downloadAsWord } from "../lib/pdfGenerator";
import TourGuide from "../components/TourGuide";
import NotificationsDropdown from "../components/NotificationsDropdown";
import { 
  FileText, Plus, ShieldCheck, History, Landmark, Sparkles, Upload, 
  CheckCircle, ArrowRight, AlertTriangle, Users, HeartHandshake, Lock, 
  CheckSquare, HelpCircle, Loader2, RefreshCw 
} from "lucide-react";

interface ClientDashboardProps {
  user: User;
  onRefreshUser: (updatedUser?: User) => void;
}

export default function ClientDashboard({ user, onRefreshUser }: ClientDashboardProps) {
  const [cases, setCases] = useState<Case[]>([]);
  const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  
  // Create Case State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [caseTitle, setCaseTitle] = useState("");
  const [caseDesc, setCaseDesc] = useState("");
  const [patientName, setPatientName] = useState(user.name);
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; size: number; content?: string }>>([]);
  const [dragActive, setDragActive] = useState(false);

  // Active generation case state
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [selectedService, setSelectedService] = useState<string>("billing_audit");
  const [promptNotes, setPromptNotes] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Active Doc Preview state
  const [activeDoc, setActiveDoc] = useState<GeneratedDocument | null>(null);

  // Matchmaking State
  const [candidates, setCandidates] = useState<User[]>([]);
  const [consentingLawyerId, setConsentingLawyerId] = useState<string | null>(null);

  // Simulate Payment state
  const [showPaymentModal, setShowPaymentModal] = useState<any>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [paymentCardNumber, setPaymentCardNumber] = useState("");
  const [paymentExpiry, setPaymentExpiry] = useState("");
  const [paymentCvc, setPaymentCvc] = useState("");
  const [paymentCardName, setPaymentCardName] = useState("");
  const [paymentBillingEmail, setPaymentBillingEmail] = useState("");
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Case creation validation state
  const [caseError, setCaseError] = useState<string | null>(null);

  // Subscription upgrade states
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [selectedPlanForUpgrade, setSelectedPlanForUpgrade] = useState<any>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [subCardNumber, setSubCardNumber] = useState("");
  const [subExpiry, setSubExpiry] = useState("");
  const [subCvc, setSubCvc] = useState("");
  const [subCardName, setSubCardName] = useState("");
  const [subBillingEmail, setSubBillingEmail] = useState("");
  const [subError, setSubError] = useState<string | null>(null);

  useEffect(() => {
    fetchUserData();
  }, [user]);

  const fetchUserData = async (customUser?: User) => {
    const activeUser = customUser || user;
    try {
      // Fetch Client's isolated cases
      const casesRes = await fetch(`/api/cases?userId=${activeUser.id}&role=${activeUser.viewRole || activeUser.role}`);
      const casesData = await casesRes.json();
      setCases(casesData);

      // Fetch Client's isolated generated documents
      const docsRes = await fetch(`/api/documents?userId=${activeUser.id}&role=${activeUser.viewRole || activeUser.role}`);
      const docsData = await docsRes.json();
      setDocuments(docsData);

      // Fetch Client's isolated matchmaking statuses
      const matchRes = await fetch(`/api/matchmaking/matches?userId=${activeUser.id}&role=${activeUser.viewRole || activeUser.role}`);
      const matchData = await matchRes.json();
      setMatches(matchData);

      // Fetch consenting candidates
      const candRes = await fetch(`/api/matchmaking/candidates?userId=${activeUser.id}&role=${activeUser.viewRole || activeUser.role}`);
      const candData = await candRes.json();
      setCandidates(candData);

      // Fetch Client's notifications
      const notRes = await fetch(`/api/notifications/${activeUser.id}`);
      const notData = await notRes.json();
      setNotifications(notData);
    } catch (e) {
      console.error("Error loading user data", e);
    }
  };

  const handleDismissNotification = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "POST" });
      fetchUserData();
    } catch (e) {
      console.error("Error dismissing notification", e);
    }
  };

  const handleDismissAllNotifications = async () => {
    try {
      const unread = notifications.filter(n => !n.read);
      await Promise.all(unread.map(n => fetch(`/api/notifications/${n.id}/read`, { method: "POST" })));
      fetchUserData();
    } catch (e) {
      console.error("Error dismissing all notifications", e);
    }
  };

  // Drag and drop handler
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const MAX_SIZE_KB = 5120; // 5MB limit
      const exceededFiles: string[] = [];
      const validFiles: Array<{ name: string; size: number; content?: string }> = [];

      Array.from(e.dataTransfer.files).forEach((f: any) => {
        const sizeKB = Math.round(f.size / 1024);
        if (sizeKB > MAX_SIZE_KB) {
          exceededFiles.push(`${f.name} (${(f.size / (1024 * 1024)).toFixed(2)} MB)`);
        } else {
          validFiles.push({
            name: f.name,
            size: sizeKB,
            content: `Simulated OCR content for file ${f.name}`
          });
        }
      });

      if (exceededFiles.length > 0) {
        const warningMsg = `Warning: The following file(s) exceed the 5MB size limit and were rejected:\n- ${exceededFiles.join("\n- ")}`;
        setCaseError(warningMsg);
        alert(warningMsg);
      } else {
        setCaseError(null);
      }

      if (validFiles.length > 0) {
        setUploadedFiles(prev => [...prev, ...validFiles]);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const MAX_SIZE_KB = 5120; // 5MB limit
      const exceededFiles: string[] = [];
      const validFiles: Array<{ name: string; size: number; content?: string }> = [];

      Array.from(e.target.files).forEach((f: any) => {
        const sizeKB = Math.round(f.size / 1024);
        if (sizeKB > MAX_SIZE_KB) {
          exceededFiles.push(`${f.name} (${(f.size / (1024 * 1024)).toFixed(2)} MB)`);
        } else {
          validFiles.push({
            name: f.name,
            size: sizeKB,
            content: `Simulated OCR content for file ${f.name}`
          });
        }
      });

      if (exceededFiles.length > 0) {
        const warningMsg = `Warning: The following file(s) exceed the 5MB size limit and were rejected:\n- ${exceededFiles.join("\n- ")}`;
        setCaseError(warningMsg);
        alert(warningMsg);
      } else {
        setCaseError(null);
      }

      if (validFiles.length > 0) {
        setUploadedFiles(prev => [...prev, ...validFiles]);
      }
    }
  };

  // Create Case (Audit claim file)
  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    setCaseError(null);

    if (!caseTitle.trim()) {
      setCaseError("Please enter the info: Dispute Case Title is required.");
      return;
    }
    if (!patientName.trim()) {
      setCaseError("Please enter the info: Patient Full Name is required.");
      return;
    }

    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          role: user.viewRole || user.role,
          title: caseTitle,
          description: caseDesc,
          patientName,
          files: uploadedFiles
        })
      });

      if (res.ok) {
        setShowCreateModal(false);
        setCaseTitle("");
        setCaseDesc("");
        setUploadedFiles([]);
        fetchUserData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Trigger simulated Stripe Payment
  const triggerStripePayment = async (serviceType: string, isUnlock: boolean, docId?: string, isDownload?: boolean, downloadFormat?: string) => {
    const pricing = PRICING_PER_CASE[serviceType as keyof typeof PRICING_PER_CASE];
    const amount = isUnlock ? Math.round((pricing ? pricing.price : 15) * 0.5) : (pricing ? pricing.price : 15);
    
    setPaymentCardNumber("");
    setPaymentExpiry("");
    setPaymentCvc("");
    setPaymentCardName("");
    setPaymentBillingEmail(user.email || "");
    setPaymentError(null);

    setShowPaymentModal({
      serviceType,
      isUnlock,
      docId,
      amount,
      isDownload: isDownload || false,
      downloadFormat: downloadFormat || "pdf",
      name: pricing ? pricing.name : serviceType
    });
  };

  const handleConfirmSimulatedPayment = async () => {
    if (!showPaymentModal) return;
    setPaymentError(null);

    // Form input validation
    if (!paymentBillingEmail.trim()) {
      setPaymentError("Please enter the info: Billing Email is required.");
      return;
    }
    if (!paymentBillingEmail.includes("@")) {
      setPaymentError("Please enter a valid email address containing '@'.");
      return;
    }
    if (!paymentCardName.trim()) {
      setPaymentError("Please enter the info: Name on Card is required.");
      return;
    }
    if (!paymentCardNumber.trim()) {
      setPaymentError("Please enter the info: Card Number is required.");
      return;
    }
    const cleanedCard = paymentCardNumber.replace(/\s+/g, "");
    if (!/^\d+$/.test(cleanedCard)) {
      setPaymentError("Card number must contain only digits.");
      return;
    }
    if (cleanedCard.length < 13 || cleanedCard.length > 19) {
      setPaymentError(`Card number is invalid: must be between 13 and 19 digits (got ${cleanedCard.length}).`);
      return;
    }
    if (!paymentExpiry.trim()) {
      setPaymentError("Please enter the info: Expiry Date is required.");
      return;
    }
    if (!/^\d{2}\s*\/\s*\d{2,4}$/.test(paymentExpiry)) {
      setPaymentError("Please enter a valid expiry date in MM/YY format.");
      return;
    }
    if (!paymentCvc.trim()) {
      setPaymentError("Please enter the info: CVC is required.");
      return;
    }
    const cleanedCvc = paymentCvc.replace(/\s+/g, "");
    if (!/^\d{3,4}$/.test(cleanedCvc)) {
      setPaymentError("Please enter a valid 3 or 4-digit CVC.");
      return;
    }

    setIsPaying(true);

    try {
      if (showPaymentModal.isUnlock) {
        // Doc re-access unlock payment
        const res = await fetch(`/api/documents/${showPaymentModal.docId}/unlock`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id })
        });
        if (res.ok) {
          const unlocked = await res.json();
          setActiveDoc(unlocked.document);
          fetchUserData();
          onRefreshUser();
        }
      } else if (showPaymentModal.isDownload) {
        // Document download payment
        const item = `One-Time Download Payment: ${showPaymentModal.name} (Case: ${selectedCase ? selectedCase.id : ""})`;
        const res = await fetch("/api/billing/record-case-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            userEmail: paymentBillingEmail,
            amount: showPaymentModal.amount,
            item
          })
        });

        if (res.ok) {
          if (showPaymentModal.docId) {
            await proceedWithDownload(showPaymentModal.docId, showPaymentModal.downloadFormat || "pdf");
          }
        }
      } else {
        // Document generation payment
        const item = `One-Time Case Payment: ${showPaymentModal.name} (Case: ${selectedCase ? selectedCase.id : ""})`;
        const res = await fetch("/api/billing/record-case-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            userEmail: paymentBillingEmail,
            amount: showPaymentModal.amount,
            item
          })
        });

        if (res.ok) {
          // Trigger generation immediately now that payment has cleared!
          await generateAIDocument(showPaymentModal.serviceType);
        }
      }
      setShowPaymentModal(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsPaying(false);
    }
  };

  const handleSubscribeToPlan = async (planId: string, price: number) => {
    setSubError(null);
    if (planId !== "free") {
      if (!subBillingEmail.trim() || !subBillingEmail.includes("@")) {
        setSubError("Please enter a valid billing email address.");
        return;
      }
      if (!subCardName.trim()) {
        setSubError("Please enter the name on the card.");
        return;
      }
      if (!subCardNumber.trim() || subCardNumber.replace(/\s+/g, "").length < 13) {
        setSubError("Please enter a valid card number.");
        return;
      }
      if (!subExpiry.trim() || !subCvc.trim()) {
        setSubError("Card security code and expiry date are required.");
        return;
      }
    }

    setIsSubscribing(true);
    try {
      const res = await fetch("/api/billing/upgrade-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          planId,
          amount: price
        })
      });

      if (res.ok) {
        setShowSubscriptionModal(false);
        setSelectedPlanForUpgrade(null);
        setSubCardNumber("");
        setSubExpiry("");
        setSubCvc("");
        setSubCardName("");
        onRefreshUser();
      } else {
        const err = await res.json();
        setSubError(err.error || "Failed to process subscription.");
      }
    } catch (e) {
      console.error(e);
      setSubError("Network error. Please try again.");
    } finally {
      setIsSubscribing(false);
    }
  };

  // Generate Document
  const generateAIDocument = async (serviceType: string) => {
    if (!selectedCase) return;
    setGenerationError(null);

    const hasFiles = selectedCase.files && selectedCase.files.length > 0;
    const hasDesc = (selectedCase.description && selectedCase.description.trim().length > 0) || (promptNotes && promptNotes.trim().length > 0);

    if (!hasFiles && !hasDesc) {
      setGenerationError("⚠️ Error: Unable to compile document. You must upload at least one billing file or provide detailed dispute description/notes before the AI engine can generate a legally winning audit document.");
      return;
    }

    try {
      // 1. Enforce secure Stripe check BEFORE any document generation
      const checkRes = await fetch(`/api/billing/check-payment?userId=${user.id}&caseId=${selectedCase.id}&serviceType=${serviceType}`);
      const checkData = await checkRes.json();
      if (!checkData.hasPaid) {
        if (checkData.expired) {
          setGenerationError("Your monthly subscription plan credits have expired! Please upgrade or renew your plan to continue generating documents.");
          setShowSubscriptionModal(true);
          return;
        }
        if (checkData.reason === "out-of-audits") {
          setGenerationError("You have run out of monthly subscription audits! Please upgrade or renew your plan to continue generating documents.");
          setShowSubscriptionModal(true);
          return;
        }
        triggerStripePayment(serviceType, false);
        return;
      }

      // 2. Payment confirmed, now activate loading spinner and perform document generation
      setIsGenerating(true);
      const res = await fetch("/api/documents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          caseId: selectedCase.id,
          role: user.viewRole || user.role,
          serviceType,
          promptNotes
        })
      });

      const data = await res.json();

      if (res.status === 402) {
        if (data.error === "Out of Audits") {
          setGenerationError("You have run out of monthly subscription audits! Please upgrade or renew your plan to continue generating documents.");
          setShowSubscriptionModal(true);
        } else {
          triggerStripePayment(serviceType, false);
        }
        return;
      }

      if (!res.ok) {
        throw new Error(data.message || data.error || "Generation error");
      }

      setActiveDoc(data);
      fetchUserData();
      onRefreshUser();
      setPromptNotes("");
    } catch (e: any) {
      setGenerationError(e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // Enforce One-Time Access Locking on Download - triggers immediately
  const proceedWithDownload = async (docId: string, format: string) => {
    // 1. Download immediately to avoid any network blocking
    if (activeDoc && activeDoc.id === docId) {
      if (format === "pdf") {
        downloadAsPDF(activeDoc);
      } else {
        downloadAsWord(activeDoc);
      }
    }

    // 2. Log lock or status update to server in background
    try {
      const res = await fetch(`/api/documents/${docId}/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });

      if (res.ok) {
        const lockedDoc = await res.json();
        if (activeDoc && activeDoc.id === docId) {
          setActiveDoc(lockedDoc);
        }
        fetchUserData();
      }
    } catch (err) {
      console.error("Background document status update error", err);
    }
  };

  const handleDownload = async (docId: string, format: string) => {
    if (!activeDoc) return;
    await proceedWithDownload(docId, format);
  };

  // TOGGLE MATCHMAKING CONSENT
  const handleToggleConsent = async (consent: boolean) => {
    try {
      const res = await fetch("/api/matchmaking/toggle-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          consent
        })
      });
      if (res.ok) {
        const updatedUser = await res.json();
        onRefreshUser(updatedUser);
        fetchUserData(updatedUser);
      }
    } catch (e) {
      console.error("Error toggling consent", e);
    }
  };

  // SEND MATCHMAKING REQUEST
  const handleSendRequest = async (lawyerId: string, lawyerName: string, lawyerEmail: string) => {
    try {
      const res = await fetch("/api/matchmaking/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: user.id,
          clientName: user.name,
          clientEmail: user.email,
          lawyerId,
          lawyerName,
          lawyerEmail,
          initiatedBy: "client"
        })
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to send request.");
        return;
      }

      fetchUserData();
    } catch (e) {
      console.error("Error sending match request", e);
    }
  };

  // RESPOND TO INCOMING MATCHMAKING REQUEST
  const handleRespondToRequest = async (matchId: string, response: 'accept' | 'deny') => {
    try {
      const res = await fetch("/api/matchmaking/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId,
          response,
          role: user.viewRole || user.role
        })
      });
      if (res.ok) {
        fetchUserData();
      }
    } catch (e) {
      console.error("Error responding to request", e);
    }
  };

  // SIMULATE 24-HOUR TIMEOUT
  const triggerDemoTimeout = async (matchId: string) => {
    try {
      const res = await fetch("/api/matchmaking/simulate-timeout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId })
      });
      if (res.ok) {
        fetchUserData();
      }
    } catch (e) {
      console.error("Error simulating timeout", e);
    }
  };

  // DISMISS TIMED OUT OR DENIED MATCH
  const dismissMatch = async (matchId: string) => {
    try {
      await fetch("/api/matchmaking/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId })
      });
      fetchUserData();
    } catch (e) {
      console.error("Error dismissing match", e);
    }
  };

  // Delete Case
  const handleDeleteCase = async (caseId: string) => {
    if (confirm("Are you sure you want to permanently delete this case and all associated files? This cannot be undone.")) {
      const res = await fetch(`/api/cases/${caseId}`, { method: "DELETE" });
      if (res.ok) {
        setSelectedCase(null);
        setActiveDoc(null);
        fetchUserData();
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 font-sans text-slate-900">
      {/* Upper header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-slate-100 pb-6">
        <div>
          <span className="text-indigo-700 font-semibold text-xs uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
            Client Workspace
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-2 tracking-tight font-display">
            {user.isNewUser ? `Welcome to BillSlayer, ${user.name}` : `Welcome back`}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Secure Client Dispute Portal • Status: Active & Operational
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* SYSTEM RECENT ACTIVITIES / NOTIFICATIONS DROPDOWN */}
          <NotificationsDropdown
            notifications={notifications}
            onDismiss={handleDismissNotification}
            onDismissAll={handleDismissAllNotifications}
          />

          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-[#0078d4] hover:bg-[#005a9e] text-white text-xs font-bold px-4 py-2.5 rounded-lg transition duration-200 cursor-pointer flex items-center gap-2 h-11 shadow-md"
          >
            <Plus className="w-4 h-4" />
            Audit New Bill / File Case
          </button>
        </div>
      </div>

      {/* Grid Layout: Core Client Functions (Case selection & doc generation left, active outputs right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT TWO COLUMNS: Case Manager & AI Custom Documents Generator */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Active Cases Selectors */}
          <div id="private-cases-section" className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <History className="w-4 h-4 text-[#0078d4]" />
              Your Private Dispute Files & Cases
            </h2>

            {cases.length === 0 ? (
              <div className="border border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50">
                <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs text-slate-500">No current dispute files.</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="text-xs text-[#0078d4] hover:text-[#005a9e] mt-2 font-semibold underline cursor-pointer"
                >
                  Audit your first medical bill now
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {cases.map(c => (
                  <div
                    key={c.id}
                    onClick={() => {
                      setSelectedCase(c);
                      setActiveDoc(null);
                      setTimeout(() => {
                        const el = document.getElementById("ai-generation-section");
                        if (el) {
                          el.scrollIntoView({ behavior: "smooth", block: "start" });
                        }
                      }, 100);
                    }}
                    className={`p-4 rounded-xl border text-left transition duration-200 cursor-pointer ${
                      selectedCase?.id === c.id
                        ? "bg-blue-50/50 border-[#0078d4]"
                        : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-xs font-bold text-slate-900 block truncate">{c.title}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 font-semibold uppercase">
                        {c.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{c.description}</p>
                    <div className="flex items-center justify-between text-[9px] text-slate-400 mt-3 pt-2 border-t border-slate-100">
                      <span>{c.files.length} uploads</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCase(c.id);
                        }}
                        className="text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Matchmaking Premium Box */}
          <div id="matchmaking-section" className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
              <HeartHandshake className="w-4 h-4 text-[#0078d4]" />
              Consent-Based Law Matching
            </h2>

            {(() => {
              const isPlanExpired = user.planExpiresAt && new Date(user.planExpiresAt) < new Date();
              const isFreeOrExpired = user.planId === 'free' || isPlanExpired;
              if (isFreeOrExpired) {
                return (
                  <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-5 text-center mt-3">
                    <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-3 border border-amber-100">
                      <Lock className="w-5 h-5 text-amber-600" />
                    </div>
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">Premium Matching Locked</h3>
                    <p className="text-[10px] text-slate-500 leading-relaxed mt-1.5 max-w-sm mx-auto">
                      Matchmaking and lawyer connections are exclusive features for active, unexpired Professional Clinic or Elite Lawyer subscribers. One-Time Pay or expired plan users do not have access to client-matching features.
                    </p>
                    <div className="mt-4">
                      <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full uppercase tracking-wider border border-amber-100">
                        {user.planId === 'free' ? 'One-Time Payer Account' : 'Subscription Expired'}
                      </span>
                    </div>
                  </div>
                );
              }
              return (
                <>
                  <p className="text-[10px] text-slate-500 leading-relaxed mb-4">
                    To safeguard patient privacy and HIPAA compliance, both client and lawyer must explicitly consent before direct contact info is visible.
                  </p>

            {/* Toggle Switch for Matchmaking Consent */}
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl mb-4 text-left">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-extrabold text-slate-800 block">
                    Consent to Finding a Lawyer
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Enable to receive lawyer recommendations and request connections
                  </span>
                </div>
                <button
                  onClick={() => handleToggleConsent(!user.matchmakingConsent)}
                  className={`relative inline-flex h-5 w-10 items-center rounded-full transition duration-300 focus:outline-none cursor-pointer ${
                    user.matchmakingConsent ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-300 ${
                      user.matchmakingConsent ? "translate-x-5" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-200/50 flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${user.matchmakingConsent ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                  Status: {user.matchmakingConsent ? "Active & Consenting" : "Inactive / Incognito"}
                </span>
              </div>
            </div>

            {!user.matchmakingConsent ? (
              /* Informative Callout when Consent is Off */
              <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl text-center">
                <Users className="w-8 h-8 text-[#0078d4] mx-auto mb-2 opacity-80" />
                <span className="text-xs font-extrabold text-[#0078d4] block">Matchmaking is Inactive</span>
                <p className="text-[10px] text-slate-500 leading-relaxed mt-1">
                  By enabling matchmaking consent, our system will search for vetted medical injury legal specialists who have consented to be marketed. Your medical history will remain completely private until you choose to connect.
                </p>
                <button
                  onClick={() => handleToggleConsent(true)}
                  className="mt-3 bg-[#0078d4] hover:bg-[#005a9e] text-white text-[10px] font-black py-2 px-4 rounded-lg shadow-sm transition uppercase tracking-wider cursor-pointer"
                >
                  Enable Matchmaking
                </button>
              </div>
            ) : (
              /* Active Matchmaking UI when Consent is On */
              <div className="space-y-5">
                
                {/* 1. CURRENT CONNECTIONS & SENT REQUESTS */}
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2.5">
                    My Connections & Requests ({matches.length})
                  </span>

                  {matches.length === 0 ? (
                    <div className="bg-slate-50/60 border border-slate-100 p-3 rounded-lg text-center text-[10px] text-slate-400">
                      No active requests or connections yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {matches.map(match => {
                        const isAccepted = match.status === 'accepted';
                        const isPendingMe = match.status === 'pending_client';
                        const isPendingThem = match.status === 'pending_lawyer';
                        const isDenied = match.status === 'denied_by_lawyer' || match.status === 'denied_by_client';
                        const isTimedOut = match.status === 'timed_out';

                        return (
                          <div key={match.id} className="bg-white border border-slate-200 p-3.5 rounded-xl text-left shadow-xs">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="text-xs font-black text-slate-900 block">
                                  {isAccepted ? match.lawyerName : "Medical-Injury Attorney"}
                                </span>
                                <span className="text-[10px] font-medium text-slate-500 block mt-0.5">
                                  {isAccepted ? (
                                    <strong className="text-emerald-700 font-extrabold select-all">{match.lawyerEmail}</strong>
                                  ) : (
                                    <span className="text-slate-400 italic font-medium">Email Hidden — Match Required</span>
                                  )}
                                </span>
                              </div>

                              <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                isAccepted ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                                isPendingThem ? "bg-blue-50 text-blue-700 border border-blue-100 animate-pulse" :
                                isPendingMe ? "bg-purple-50 text-purple-700 border border-purple-100 animate-pulse" :
                                "bg-rose-50 text-rose-700 border border-rose-100"
                              }`}>
                                {isAccepted ? "Assigned!" :
                                 isPendingThem ? "Pending Lawyer" :
                                 isPendingMe ? "Pending Your Consent" :
                                 isTimedOut ? "Timed Out" : "Declined"}
                              </span>
                            </div>

                            {/* Notifications & Warning descriptions */}
                            {isPendingThem && (
                              <p className="text-[9px] text-slate-400 leading-relaxed mt-2 italic">
                                Waiting for lawyer to review your medical claim file. They have 24 hours to respond.
                              </p>
                            )}

                            {isPendingMe && (
                              <div className="bg-purple-50/50 border border-purple-100 rounded-lg p-2.5 mt-2.5">
                                <p className="text-[9px] text-purple-800 font-semibold leading-relaxed">
                                  Lawyer {match.lawyerName} requested to match with you! Do you consent to finding this lawyer and sharing contact info?
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                  <button
                                    onClick={() => handleRespondToRequest(match.id, 'accept')}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-[8px] font-black py-1 px-2.5 rounded-md cursor-pointer uppercase transition"
                                  >
                                    Accept Request
                                  </button>
                                  <button
                                    onClick={() => handleRespondToRequest(match.id, 'deny')}
                                    className="bg-rose-600 hover:bg-rose-700 text-white text-[8px] font-black py-1 px-2.5 rounded-md cursor-pointer uppercase transition"
                                  >
                                    Deny
                                  </button>
                                </div>
                              </div>
                            )}

                            {isDenied && (
                              <div className="bg-rose-50/50 border border-rose-100 rounded-lg p-2.5 mt-2.5 text-[9px] text-rose-800 font-medium">
                                <span>The request is no longer applicable. Please try matching with another specialist.</span>
                                <button
                                  onClick={() => dismissMatch(match.id)}
                                  className="text-[9px] text-rose-600 font-bold block underline mt-1 cursor-pointer"
                                >
                                  Dismiss Connection
                                </button>
                              </div>
                            )}

                            {isTimedOut && (
                              <div className="bg-rose-50/50 border border-rose-100 rounded-lg p-2.5 mt-2.5 text-[9px] text-rose-800 font-medium">
                                <strong>Request Expired:</strong> No response recorded within the 24-hour limit. This request is no longer applicable.
                                <button
                                  onClick={() => dismissMatch(match.id)}
                                  className="text-[9px] text-rose-600 font-bold block underline mt-1 cursor-pointer"
                                >
                                  Dismiss & Try Another
                                </button>
                              </div>
                            )}

                            {/* Demo Tools: Simulating 24 Hour Timeout */}
                            {(isPendingThem || isPendingMe) && (
                              <div className="mt-3 pt-2.5 border-t border-slate-100 flex justify-end">
                                <button
                                  onClick={() => triggerDemoTimeout(match.id)}
                                  className="text-[8px] text-slate-400 hover:text-amber-500 flex items-center gap-1 cursor-pointer"
                                  title="Test the 24h timeout alert"
                                >
                                  <RefreshCw className="w-2.5 h-2.5" />
                                  Simulate 24H Timeout
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 2. RECOMMENDED LAWYERS LIST */}
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2.5">
                    Consenting Specialist Candidates
                  </span>

                  {/* Exclude candidates where a match already exists */}
                  {candidates.filter(cand => !matches.some(m => m.lawyerId === cand.id)).length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic">
                      No other vetted legal specialists available at this exact moment. Check back soon!
                    </p>
                  ) : (
                    <div className="space-y-3.5">
                      {candidates
                        .filter(cand => !matches.some(m => m.lawyerId === cand.id))
                        .map(lawyer => (
                          <div key={lawyer.id} className="bg-slate-50/50 border border-slate-200/80 p-3.5 rounded-xl text-left shadow-2xs">
                            <div className="flex items-start justify-between gap-1">
                              <div>
                                <span className="text-xs font-black text-slate-900 block">
                                  {lawyer.name}
                                </span>
                                <span className="text-[9px] font-bold text-slate-400 block mt-0.5 uppercase tracking-wider">
                                  License: {lawyer.licenseNumber || "VETTED BAR"}
                                </span>
                                <p className="text-[9px] text-slate-500 mt-1.5 leading-relaxed">
                                  Vetted injury attorney specializing in hospital audits and dispute remands. Consented to receive client dispute audits.
                                </p>
                              </div>
                            </div>

                            <button
                              onClick={() => handleSendRequest(lawyer.id, lawyer.name, lawyer.email)}
                              className="w-full bg-[#0078d4] hover:bg-[#005a9e] text-white text-[9px] font-black py-2 rounded-lg mt-3 uppercase tracking-wider shadow-2xs cursor-pointer transition flex items-center justify-center gap-1.5"
                            >
                              <ArrowRight className="w-3 h-3" />
                              Send Match Request
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

              </div>
            )}
                </>
              );
            })()}
          </div>

          {/* AI Custom Document Generator */}
          {selectedCase && (
            <div id="ai-generation-section" className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm relative">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#0078d4]" />
                  Client AI Document Generation
                </h3>
                <span className="text-[10px] text-slate-500">
                  Target Case: <strong className="text-[#0078d4]">{selectedCase.title}</strong>
                </span>
              </div>

              {/* Warnings and notices */}
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-[11px] text-amber-800 mb-6 flex items-start gap-2 shadow-sm">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>
                  <strong>Secure Document Output:</strong> Once generated, your legal files are saved in your personal vault. You can review, download, and copy them as needed.
                </span>
              </div>

              <div className="space-y-4">
                {/* Select customizable document templates */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Select Dispute Template (Customized for Client)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedService("billing_audit")}
                      className={`p-3 rounded-xl border text-left transition text-xs font-bold cursor-pointer ${
                        selectedService === "billing_audit"
                          ? "bg-blue-50 border-[#0078d4] text-[#0078d4]"
                          : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      Medical Billing Audit
                      <span className="block text-[10px] text-slate-500 font-normal mt-1">Audit CPT/ICD codes for overcharges.</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedService("insurance_appeal")}
                      className={`p-3 rounded-xl border text-left transition text-xs font-bold cursor-pointer ${
                        selectedService === "insurance_appeal"
                          ? "bg-blue-50 border-[#0078d4] text-[#0078d4]"
                          : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      Insurance Appeal Letter
                      <span className="block text-[10px] text-slate-500 font-normal mt-1">Dispute claims denial directly.</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedService("denial_explainer")}
                      className={`p-3 rounded-xl border text-left transition text-xs font-bold cursor-pointer ${
                        selectedService === "denial_explainer"
                          ? "bg-blue-50 border-[#0078d4] text-[#0078d4]"
                          : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      Insurance Denial Explanation
                      <span className="block text-[10px] text-slate-500 font-normal mt-1">Decode complex insurance rejection lingo.</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedService("cpt_analysis")}
                      className={`p-3 rounded-xl border text-left transition text-xs font-bold cursor-pointer ${
                        selectedService === "cpt_analysis"
                          ? "bg-blue-50 border-[#0078d4] text-[#0078d4]"
                          : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      Legal Complaint Letter
                      <span className="block text-[10px] text-slate-500 font-normal mt-1">Demand settlement or formal legal review.</span>
                    </button>
                  </div>
                </div>

                {/* Additional notes prompt */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Add Patient Symptoms, Injury Details or Notes (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={promptNotes}
                    onChange={(e) => setPromptNotes(e.target.value)}
                    placeholder="Provide additional details to train the AI (e.g. date of treatment, specific disputable services, pain duration)"
                    className="w-full bg-white border border-slate-300 rounded-lg p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4] transition"
                  />
                </div>

                {/* Secure Payment Requirement Banner */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800 flex items-start gap-2.5">
                  <span className="text-amber-600 font-bold mt-0.5">⚠️</span>
                  <span>
                    <strong>Payment Gate Notice:</strong> Generating a custom AI medical-legal dispute document requires a secure one-time Stripe checkout or 1 active subscription credit.
                  </span>
                </div>

                {generationError && (
                  <p className="text-xs text-rose-600 font-semibold">{generationError}</p>
                )}

                {/* Generate Button */}
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => generateAIDocument(selectedService)}
                  className="w-full bg-[#0078d4] hover:bg-[#005a9e] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold py-3 rounded-lg transition duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Running AI CPT Audit & Compiling File...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate Dispute Document (AI Assisted)
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Render non-copyable PDFPreview */}
          {activeDoc && (
            <div id="pdf-preview-section">
              <PDFPreview
                document={activeDoc}
                onDownload={(format) => handleDownload(activeDoc.id, format)}
                onUnlock={() => triggerStripePayment(activeDoc.serviceType, true, activeDoc.id)}
              />
            </div>
          )}

        </div>

        {/* RIGHT ONE COLUMN: Platform Billing & Locked Document History */}
        <div className="space-y-8">
          
          {/* Platform Billing & Subscription Control Panel */}
          <div id="billing-section" className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm text-left">
            <h2 className="text-sm font-extrabold text-indigo-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="p-1 bg-indigo-50 rounded"><HeartHandshake className="w-4 h-4 text-indigo-600" /></span>
              Subscription & Billing Center
            </h2>
            
            <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 mb-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">Current Account Plan</span>
                  <span className="text-sm font-black text-slate-800">
                    {user.planId === 'free' ? 'One-Time Payer (Free)' : PLANS[user.planId]?.name || 'Premium'}
                  </span>
                </div>
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-extrabold uppercase ${
                  user.planId !== 'free' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                }`}>
                  {user.planId !== 'free' ? 'Active Subscription' : 'Pay-As-You-Go'}
                </span>
              </div>

              {user.planId !== 'free' ? (
                <div className="space-y-1.5 mt-3 pt-3 border-t border-slate-200/50">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-medium">Monthly Audits Left:</span>
                    <strong className="text-slate-800 font-extrabold">{user.availableCredits} / {PLANS[user.planId]?.creditsPerMonth || 10}</strong>
                  </div>
                  {(user as any).planExpiresAt && (
                    <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                      <span>Plan Renewal:</span>
                      <span>{new Date((user as any).planExpiresAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[10px] text-slate-500 leading-relaxed mt-2 font-medium">
                  You are currently paying **$15 per AI document generation**. Save up to 60% and get included audits by upgrading to a professional plan.
                </p>
              )}
            </div>

            <button
              onClick={() => {
                setSubBillingEmail(user.email || "");
                setShowSubscriptionModal(true);
              }}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-2.5 rounded-lg transition shadow-sm uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Manage Subscription Plan</span>
            </button>
          </div>

          {/* Document History list (Strictly Isolated to Client) */}
          {documents.length > 0 && (
            <div id="document-vault-section" className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#0078d4]" />
                Document Vault History
              </h2>

              <div className="space-y-3">
                {documents.map(d => (
                  <div
                    key={d.id}
                    onClick={() => setActiveDoc(d)}
                    className={`p-3 rounded-xl border text-left transition duration-200 cursor-pointer flex justify-between items-center ${
                      activeDoc?.id === d.id
                        ? "bg-blue-50/50 border-[#0078d4]"
                        : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-900 block truncate max-w-[150px]">{d.title}</span>
                      <span className="text-[9px] text-slate-400 block">
                        {new Date(d.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-emerald-700 flex items-center gap-1 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 font-semibold">
                        Available
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>

      {/* CREATE CASE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 text-left relative shadow-2xl flex flex-col max-h-[90vh]">
            <h3 className="text-base font-extrabold text-slate-900 mb-1 font-display">Audit New Bill / File Case</h3>
            <p className="text-xs text-slate-500 mb-4">
              Upload your medical records or insurance denial document to build a secure dispute file.
            </p>

            {caseError && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg p-3 mb-4 flex items-center gap-2 font-semibold">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <span>{caseError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCase} className="space-y-4 overflow-y-auto flex-grow pr-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Dispute Case Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Hospital ER Overcharge Audit"
                  value={caseTitle}
                  onChange={(e) => setCaseTitle(e.target.value)}
                  className="w-full bg-white border border-slate-300 focus:border-[#0078d4] focus:outline-none rounded-lg px-4 py-2 text-xs text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Patient Full Name</label>
                  <input
                    type="text"
                    required
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    className="w-full bg-white border border-slate-300 focus:border-[#0078d4] focus:outline-none rounded-lg px-4 py-2 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">File Status</label>
                  <span className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-xs text-indigo-700 font-bold block">
                    Awaiting Audit
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Description of Insurance Denial or Dispute</label>
                <textarea
                  rows={2}
                  placeholder="Summarize what insurance or hospital is claiming (e.g. Denied emergency CPT claim stating non-covered provider hours)"
                  value={caseDesc}
                  onChange={(e) => setCaseDesc(e.target.value)}
                  className="w-full bg-white border border-slate-300 focus:border-[#0078d4] focus:outline-none rounded-lg px-4 py-2 text-xs text-slate-900"
                />
              </div>

              {/* Drag and drop zone */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-6 text-center transition cursor-pointer ${
                  dragActive ? "border-[#0078d4] bg-blue-50/50" : "border-slate-200 hover:border-slate-300 bg-slate-50"
                }`}
              >
                <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                <p className="text-xs text-slate-700 font-semibold">Drag & drop your bill files or record document here</p>
                <p className="text-[10px] text-slate-400 mt-1">Accepts PDF, Images, DOCX up to 10MB</p>
                
                <input
                  type="file"
                  id="file-upload"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <label
                  htmlFor="file-upload"
                  className="text-xs text-[#0078d4] hover:text-[#005a9e] font-bold mt-3 inline-block cursor-pointer underline"
                >
                  Browse Files Manually
                </label>
              </div>

              {/* Uploaded lists */}
              {uploadedFiles.length > 0 && (
                <div className="bg-slate-50 rounded-lg border border-slate-200 p-3 max-h-24 overflow-y-auto">
                  <p className="text-[10px] font-bold text-[#0078d4] uppercase tracking-wider mb-1.5">Uploaded files:</p>
                  <div className="space-y-1">
                    {uploadedFiles.map((file, i) => (
                      <div key={i} className="flex justify-between items-center text-[10px] text-slate-600">
                        <span>📄 {file.name}</span>
                        <span>{file.size} KB</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-[#0078d4] hover:bg-[#005a9e] text-white text-xs font-bold py-2.5 rounded-lg cursor-pointer shadow-sm transition"
                >
                  Create Secure File
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold py-2.5 px-4 rounded-lg cursor-pointer transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SIMULATED STRIPE SUBSCRIPTION SELECT & CHECKOUT MODAL */}
      {showSubscriptionModal && (
        <div id="subscription-modal" className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 text-left relative shadow-2xl overflow-hidden my-8">
            {/* Stripe Blue bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#6772e5]"></div>
            
            <div className="flex items-center justify-between mb-4 mt-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#6772e5]/10 rounded-lg flex items-center justify-center text-[#6772e5] font-extrabold text-sm">
                  S
                </div>
                <span className="font-bold text-sm tracking-tight text-[#6772e5]">
                  Secure Subscription Center
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500 font-semibold mb-6">
              Choose your payment path. Selecting a monthly plan grants pre-allocated audits and ties the plan to your account so you won't be prompted for payment before document generations.
            </p>

            <div className="grid grid-cols-1 gap-3.5 mb-6">
              {Object.values(PLANS).map((p) => {
                const isSelected = selectedPlanForUpgrade?.id === p.id || (!selectedPlanForUpgrade && user.planId === p.id);
                const isCurrent = user.planId === p.id;

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPlanForUpgrade(p)}
                    className={`p-4 rounded-2xl border text-left transition duration-150 cursor-pointer flex justify-between items-start ${
                      isSelected
                        ? "bg-indigo-50/50 border-indigo-600 ring-1 ring-indigo-600"
                        : "bg-slate-50/50 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-slate-800">{p.name}</span>
                        {isCurrent && (
                          <span className="bg-emerald-100 text-emerald-800 text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">{p.features[0]} • {p.features[1]}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-sm font-black text-slate-900 block">
                        {p.price === 15 ? "$15" : `$${p.price}`}
                      </span>
                      <span className="text-[9px] text-slate-400 font-semibold block">
                        {p.price === 15 ? "per generation" : "per month"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* If selected plan is not 'free' and is different from current, render credit card details */}
            {selectedPlanForUpgrade && selectedPlanForUpgrade.id !== 'free' && selectedPlanForUpgrade.id !== user.planId && (
              <div className="space-y-4 border-t border-slate-100 pt-5 mt-5 animate-slideDown">
                <h4 className="text-xs font-extrabold text-[#6772e5] uppercase tracking-wider flex items-center gap-1.5">
                  💳 Enter Payment Information
                </h4>

                {subError && (
                  <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl p-3 flex items-center gap-2 font-semibold">
                    <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <span>{subError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Billing Email</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. billing@clinic.com"
                    value={subBillingEmail}
                    onChange={(e) => setSubBillingEmail(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-700 focus:outline-none focus:border-[#6772e5]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Name on Card</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={subCardName}
                    onChange={(e) => setSubCardName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-700 focus:outline-none focus:border-[#6772e5]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Card Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 4242 4242 4242 4242"
                    value={subCardNumber}
                    onChange={(e) => setSubCardNumber(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-700 focus:outline-none focus:border-[#6772e5]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Expires</label>
                    <input
                      type="text"
                      required
                      placeholder="MM/YY"
                      value={subExpiry}
                      onChange={(e) => setSubExpiry(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-700 focus:outline-none focus:border-[#6772e5]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">CVC</label>
                    <input
                      type="text"
                      required
                      placeholder="123"
                      value={subCvc}
                      onChange={(e) => setSubCvc(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-700 focus:outline-none focus:border-[#6772e5]"
                    />
                  </div>
                </div>
              </div>
            )}

            {selectedPlanForUpgrade && selectedPlanForUpgrade.id === 'free' && selectedPlanForUpgrade.id !== user.planId && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-2xl p-4.5 mt-5 font-semibold">
                ⚠️ Switching to **One-Time Payer** means you will have no monthly charge, but you will be prompted to authorize a $15 secure checkout before every single legal document generated.
              </div>
            )}

            <div className="flex gap-2.5 pt-6 mt-6 border-t border-slate-100">
              <button
                type="button"
                disabled={isSubscribing || (selectedPlanForUpgrade && selectedPlanForUpgrade.id === user.planId)}
                onClick={() => {
                  const planToBuy = selectedPlanForUpgrade || PLANS[user.planId];
                  handleSubscribeToPlan(planToBuy.id, planToBuy.price);
                }}
                className="flex-1 bg-[#6772e5] hover:bg-[#5469d4] disabled:bg-slate-100 disabled:text-slate-400 text-white text-xs font-bold py-2.5 rounded-xl cursor-pointer shadow-sm transition flex items-center justify-center gap-1.5 uppercase tracking-wider"
              >
                {isSubscribing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Processing Secure Payment...
                  </>
                ) : (
                  <>
                    {selectedPlanForUpgrade?.id === 'free' ? "Switch to One-Time Pay" : `Confirm & Pay $${selectedPlanForUpgrade?.price || PLANS[user.planId]?.price}.00`}
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={isSubscribing}
                onClick={() => {
                  setShowSubscriptionModal(false);
                  setSelectedPlanForUpgrade(null);
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold py-2.5 px-4 rounded-xl cursor-pointer transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIMULATED STRIPE PAYMENT CHECKOUT MODAL */}
      {showPaymentModal && (
        <div id="payment-modal" className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 text-left relative shadow-2xl overflow-hidden">
            {/* Stripe Blue bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#6772e5]"></div>
            
            <div className="flex items-center justify-between mb-4 mt-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#6772e5]/10 rounded-lg flex items-center justify-center text-[#6772e5] font-extrabold text-sm">
                  S
                </div>
                <span className="font-bold text-sm tracking-tight text-[#6772e5]">
                  Stripe Secure Checkout
                </span>
              </div>
            </div>

            <div className="border border-slate-100 bg-slate-50/50 rounded-xl p-4 mb-5">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#6772e5] tracking-widest block">Product / Service</span>
                  <span className="text-xs font-bold text-slate-800 block mt-0.5">{showPaymentModal.name}</span>
                  {selectedCase && (
                    <span className="text-[10px] text-slate-500 block">Case: {selectedCase.title}</span>
                  )}
                </div>
                <span className="text-sm font-extrabold text-slate-900">${showPaymentModal.amount}.00</span>
              </div>
            </div>

            <div className="space-y-4">
              {paymentError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg p-3 flex items-center gap-2 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <span>{paymentError}</span>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Billing Email</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. billing@practice.com"
                  value={paymentBillingEmail}
                  onChange={(e) => setPaymentBillingEmail(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-xs text-slate-700 focus:outline-none focus:border-[#6772e5]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Name on Card</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={paymentCardName}
                  onChange={(e) => setPaymentCardName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-xs text-slate-700 focus:outline-none focus:border-[#6772e5]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Card Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 4242 4242 4242 4242"
                  value={paymentCardNumber}
                  onChange={(e) => setPaymentCardNumber(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-xs text-slate-700 focus:outline-none focus:border-[#6772e5]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Expires</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 12/29"
                    value={paymentExpiry}
                    onChange={(e) => setPaymentExpiry(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-xs text-slate-700 focus:outline-none focus:border-[#6772e5]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">CVC</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 123"
                    value={paymentCvc}
                    onChange={(e) => setPaymentCvc(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-xs text-slate-700 focus:outline-none focus:border-[#6772e5]"
                  />
                </div>
              </div>

              <p className="text-[10px] text-slate-400 leading-relaxed text-center">
                This transaction is a secure simulated billing cycle. Clicking authorize below will record the clearance in the HIPAA database ledger and instantly proceed.
              </p>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isPaying}
                  onClick={handleConfirmSimulatedPayment}
                  className="flex-1 bg-[#6772e5] hover:bg-[#5469d4] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold py-2.5 rounded-lg cursor-pointer shadow-sm transition flex items-center justify-center gap-1.5"
                >
                  {isPaying ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Authorizing...
                    </>
                  ) : (
                    <>
                      Pay ${showPaymentModal.amount}.00 Securely
                    </>
                  )}
                </button>
                <button
                  type="button"
                  disabled={isPaying}
                  onClick={() => setShowPaymentModal(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold py-2.5 px-4 rounded-lg cursor-pointer transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tour Guide System */}
      <TourGuide role={user.role} userId={user.id} />

    </div>
  );
}
