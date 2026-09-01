import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { User, UserRole } from "./types";
import AuthPage from "./components/AuthPage";
import LandingPage from "./components/LandingPage";
import LearningHub from "./views/LearningHub";
import ClientDashboard from "./views/ClientDashboard";
import LawyerDashboard from "./views/LawyerDashboard";
import ClinicDashboard from "./views/ClinicDashboard";
import AdminDashboard from "./views/AdminDashboard";
import { 
  ShieldCheck, FileText, Sparkles, LogOut, BookOpen, User as UserIcon, 
  HelpCircle, ChevronRight, Laptop, Briefcase, Award, ArrowRight, HeartHandshake,
  TrendingUp, Shield, Scale, FileCheck, Sliders, CheckCircle, Percent, Database,
  Landmark, Info
} from "lucide-react";

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<"home" | "learning" | "auth">(() => {
    const stored = sessionStorage.getItem("billslayer_active_tab");
    if (stored === "home" || stored === "learning" || stored === "auth") {
      return stored;
    }
    return "home";
  });
  const [authRoleOverride, setAuthRoleOverride] = useState<UserRole>("client");
  const [authInitialSignUp, setAuthInitialSignUp] = useState<boolean>(false);
  const [scrollY, setScrollY] = useState(0);
  
  // Interactive navigation to specific elements across tabs
  const [scrollToSection, setScrollToSection] = useState<string | null>(null);

  useEffect(() => {
    sessionStorage.setItem("billslayer_active_tab", activeTab);
  }, [activeTab]);

  useEffect(() => {
    // Check if there is an active session
    const stored = localStorage.getItem("billslayer_session");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.id) {
          setCurrentUser(parsed);
        }
      } catch (e) {
        localStorage.removeItem("billslayer_session");
      }
    }

    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Aggressive scroll-to-top whenever activeTab changes (e.g. going to support or auth),
  // but SKIP if we are deliberately navigating to a specific homepage section so they don't fight.
  useEffect(() => {
    if (scrollToSection) return;

    window.scrollTo({ top: 0, behavior: "instant" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    const timer = setTimeout(() => {
      if (scrollToSection) return;
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }, 40);

    return () => clearTimeout(timer);
  }, [activeTab]);

  // Dynamically hide scrollbars on both login and signup screens
  useEffect(() => {
    if (activeTab === "auth") {
      document.body.classList.add("no-scrollbar");
      document.documentElement.classList.add("no-scrollbar");
    } else {
      document.body.classList.remove("no-scrollbar");
      document.documentElement.classList.remove("no-scrollbar");
    }
    return () => {
      document.body.classList.remove("no-scrollbar");
      document.documentElement.classList.remove("no-scrollbar");
    };
  }, [activeTab]);

  // Handle smooth scroll navigation to specific sections across different views
  const handleNavigateToSection = (sectionId: string) => {
    if (sectionId === "support-tips") {
      setScrollToSection(null);
      setActiveTab("learning");
      window.scrollTo({ top: 0, behavior: "instant" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      return;
    }

    if (activeTab !== "home") {
      window.scrollTo({ top: 0, behavior: "instant" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      setScrollToSection(sectionId);
      setActiveTab("home");
    } else {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  // Resiliently poll the DOM to ensure we scroll exactly when the requested section becomes available.
  // This solves race conditions on slow render systems and after page/layout shifts perfectly.
  useEffect(() => {
    if (activeTab === "home" && scrollToSection) {
      let attempts = 0;
      const maxAttempts = 50; // 2.5 seconds maximum retry time
      
      const tryScroll = () => {
        const el = document.getElementById(scrollToSection);
        if (el) {
          setTimeout(() => {
            const finalEl = document.getElementById(scrollToSection);
            if (finalEl) {
              finalEl.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }, 30);
          setScrollToSection(null);
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(tryScroll, 50);
        } else {
          setScrollToSection(null);
        }
      };

      const timer = setTimeout(tryScroll, 10);
      return () => clearTimeout(timer);
    }
  }, [activeTab, scrollToSection]);

  const handleLogout = () => {
    localStorage.removeItem("billslayer_session");
    sessionStorage.clear();
    setCurrentUser(null);
    setActiveTab("home");
  };

  const handleRefreshUser = async (updatedUser?: User) => {
    if (updatedUser) {
      const viewRole = currentUser?.viewRole;
      const userWithView = { ...updatedUser, viewRole: viewRole || updatedUser.role };
      setCurrentUser(userWithView);
      localStorage.setItem("billslayer_session", JSON.stringify(userWithView));
      return;
    }
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/users/${currentUser.id}`);
      if (res.ok) {
        const updated = await res.json();
        const viewRole = currentUser.viewRole;
        const userWithView = { ...updated, viewRole: viewRole || updated.role };
        setCurrentUser(userWithView);
        localStorage.setItem("billslayer_session", JSON.stringify(userWithView));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Navigates directly to registration with selected role
  const triggerAuthFlow = (role: UserRole, isSignUp: boolean = false) => {
    setAuthRoleOverride(role);
    setAuthInitialSignUp(isSignUp);
    setActiveTab("auth");
  };

  const isLandingDark = activeTab === "home" && !currentUser;

  return (
    <div className="min-h-screen bg-[#F3F4F6] font-sans text-slate-900 flex flex-col selection:bg-emerald-500/30 selection:text-slate-900">
      
      {/* Platform Navigation Header (Pristine Intuit Mint Branded Style) */}
      <nav className={`sticky top-0 z-40 transition-all duration-300 shadow-sm ${
        isLandingDark 
          ? "bg-slate-950 border-b border-slate-900 text-white" 
          : "bg-white border-b border-slate-100 text-slate-900"
      }`}>
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          
          {/* Left: Brand Logo & Links */}
          <div className="flex items-center gap-12">
            <button
              onClick={() => {
                setActiveTab("home");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="flex items-center gap-2 text-left cursor-pointer group"
            >
              {/* Mint-Style Check-Leaf Logo */}
              <div className="relative flex items-center justify-center">
                <ShieldCheck className="w-8 h-8 text-emerald-500 group-hover:scale-105 transition duration-200" />
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#0078d4] rounded-full animate-pulse" />
              </div>
              <div className="flex items-baseline">
                <span className={`font-extrabold text-xl tracking-tight transition-colors duration-300 ${isLandingDark ? "text-white" : "text-slate-800"}`}>bill</span>
                <span className="font-black text-xl text-emerald-500 tracking-tight">slayer</span>
                <span className="text-[10px] font-bold text-slate-400 ml-1 uppercase tracking-widest hidden sm:inline">AI</span>
              </div>
            </button>

            {/* Centered Navigation Links - ONLY shown when logged out, matches Mint screenshot */}
            {!currentUser && (
              <div className="hidden md:flex items-center gap-8">
                <button
                  onClick={() => {
                    setActiveTab("home");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className={`text-[11px] font-extrabold uppercase tracking-widest transition duration-300 cursor-pointer ${
                    isLandingDark ? "text-slate-300 hover:text-emerald-400" : "text-slate-600 hover:text-emerald-500"
                  }`}
                >
                  Home
                </button>
                <button
                  onClick={() => handleNavigateToSection("how-it-works")}
                  className={`text-[11px] font-extrabold uppercase tracking-widest transition duration-300 cursor-pointer ${
                    isLandingDark ? "text-slate-300 hover:text-emerald-400" : "text-slate-600 hover:text-emerald-500"
                  }`}
                >
                  How It Works
                </button>
                <button
                  onClick={() => handleNavigateToSection("estimator")}
                  className={`text-[11px] font-extrabold uppercase tracking-widest transition duration-300 cursor-pointer ${
                    isLandingDark ? "text-slate-300 hover:text-emerald-400" : "text-slate-600 hover:text-emerald-500"
                  }`}
                >
                  Find Savings
                </button>
                <button
                  onClick={() => handleNavigateToSection("support-tips")}
                  className={`text-[11px] font-extrabold uppercase tracking-widest transition duration-300 cursor-pointer ${
                    isLandingDark ? "text-slate-300 hover:text-emerald-400" : "text-slate-600 hover:text-emerald-500"
                  }`}
                >
                  Support & Tips
                </button>
                <button
                  onClick={() => handleNavigateToSection("contact-section")}
                  className={`text-[11px] font-extrabold uppercase tracking-widest transition duration-300 cursor-pointer ${
                    isLandingDark ? "text-slate-300 hover:text-emerald-400" : "text-slate-600 hover:text-emerald-500"
                  }`}
                >
                  Contact Us
                </button>
              </div>
            )}

            {/* Standard Links for Logged In practice */}
            {currentUser && (
              <div className="hidden md:flex items-center gap-6">
                <button
                  onClick={() => {
                    setActiveTab("home");
                  }}
                  className={`text-xs font-semibold tracking-wide transition ${
                    activeTab === "home" ? "text-emerald-600 font-bold" : "text-slate-600 hover:text-emerald-600"
                  } cursor-pointer`}
                >
                  Practice Workspace
                </button>
                
                <button
                  onClick={() => setActiveTab("learning")}
                  className={`text-xs font-semibold tracking-wide transition flex items-center gap-1.5 ${
                    activeTab === "learning" ? "text-emerald-600 font-bold" : "text-slate-600 hover:text-emerald-600"
                  } cursor-pointer`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Support & Tips
                </button>

                {currentUser.role === "admin" && (
                  <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 rounded-lg p-0.5 ml-2">
                    <span className="text-[9px] font-black uppercase text-emerald-800 tracking-wider px-2">Portal:</span>
                    <button
                      onClick={() => {
                        const updated = { ...currentUser, viewRole: "admin" as UserRole };
                        setCurrentUser(updated);
                        localStorage.setItem("billslayer_session", JSON.stringify(updated));
                        setActiveTab("home");
                      }}
                      className={`px-2 py-1 rounded text-[10px] font-bold transition ${
                        (!currentUser.viewRole || currentUser.viewRole === "admin")
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "text-emerald-800 hover:bg-emerald-100"
                      }`}
                    >
                      Admin Panel
                    </button>
                    <button
                      onClick={() => {
                        const updated = { ...currentUser, viewRole: "client" as UserRole };
                        setCurrentUser(updated);
                        localStorage.setItem("billslayer_session", JSON.stringify(updated));
                        setActiveTab("home");
                      }}
                      className={`px-2 py-1 rounded text-[10px] font-bold transition ${
                        currentUser.viewRole === "client"
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "text-emerald-800 hover:bg-emerald-100"
                      }`}
                    >
                      Client
                    </button>
                    <button
                      onClick={() => {
                        const updated = { ...currentUser, viewRole: "lawyer" as UserRole };
                        setCurrentUser(updated);
                        localStorage.setItem("billslayer_session", JSON.stringify(updated));
                        setActiveTab("home");
                      }}
                      className={`px-2 py-1 rounded text-[10px] font-bold transition ${
                        currentUser.viewRole === "lawyer"
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "text-emerald-800 hover:bg-emerald-100"
                      }`}
                    >
                      Lawyer
                    </button>
                    <button
                      onClick={() => {
                        const updated = { ...currentUser, viewRole: "clinic" as UserRole };
                        setCurrentUser(updated);
                        localStorage.setItem("billslayer_session", JSON.stringify(updated));
                        setActiveTab("home");
                      }}
                      className={`px-2 py-1 rounded text-[10px] font-bold transition ${
                        currentUser.viewRole === "clinic"
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "text-emerald-800 hover:bg-emerald-100"
                      }`}
                    >
                      Clinic
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            
            {/* Quick Support & Tips link for mobile */}
            <button
              onClick={() => handleNavigateToSection("support-tips")}
              className="md:hidden p-2 text-slate-500 hover:text-emerald-500 cursor-pointer"
              title="Support & Tips"
            >
              <BookOpen className="w-4 h-4" />
            </button>

            {currentUser ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:block text-right">
                  <span className="text-xs font-bold text-slate-900 block">{currentUser.name}</span>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">
                    {currentUser.role} Account
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold py-1.5 px-3 rounded transition duration-200 cursor-pointer flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <button
                  onClick={() => triggerAuthFlow("client", false)}
                  className={`hover:text-emerald-400 text-[11px] font-extrabold uppercase tracking-widest cursor-pointer flex items-center gap-1 transition-colors duration-300 ${
                    isLandingDark ? "text-slate-200" : "text-slate-700"
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  Login
                </button>
                <button
                  onClick={() => triggerAuthFlow("client", true)}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-black px-5 py-2.5 rounded shadow-sm hover:shadow-md transition uppercase tracking-widest cursor-pointer hover:scale-102"
                >
                  Sign Up
                </button>
              </div>
            )}
          </div>

        </div>
      </nav>

      {/* Dynamic Sticky Admin Impersonation Banner */}
      {currentUser && currentUser.role === "admin" && currentUser.viewRole && currentUser.viewRole !== "admin" && (
        <div className="bg-emerald-600 text-white py-2 px-4 text-xs font-bold flex items-center justify-between gap-4 shadow-md sticky top-16 z-30">
          <div className="max-w-6xl mx-auto w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="bg-white/25 px-2 py-0.5 rounded text-[9px] uppercase tracking-wider font-extrabold">Admin Impersonation Mode</span>
              <span>You are viewing the <strong>{currentUser.viewRole.toUpperCase()}</strong> portal. All actions simulate customer-facing behavior.</span>
            </div>
            <button 
              onClick={() => {
                const updated = { ...currentUser, viewRole: "admin" as UserRole };
                setCurrentUser(updated);
                localStorage.setItem("billslayer_session", JSON.stringify(updated));
              }}
              className="bg-white text-emerald-950 hover:bg-emerald-50 px-3 py-1 rounded font-black text-[10px] uppercase tracking-wider transition ml-4"
            >
              Return to Admin Panel &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Main View Container with smooth animations */}
      <main className="flex-grow">
        <AnimatePresence mode="wait">
          
          {/* VIEW: LEARNING HUB */}
          {activeTab === "learning" && (
            <motion.div
              key="learning_view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <LearningHub />
            </motion.div>
          )}

          {/* VIEW: AUTHENTICATION */}
          {activeTab === "auth" && !currentUser && (
            <motion.div
              key="auth_view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <AuthPage
                initialRole={authRoleOverride}
                initialSignUp={authInitialSignUp}
                onAuthSuccess={(user) => {
                  setCurrentUser(user);
                  setActiveTab("home");
                }}
              />
            </motion.div>
          )}

          {/* VIEW: WORKSPACES & DASHBOARDS / HOMEPAGE */}
          {activeTab === "home" && (
            <>
              {currentUser ? (
                /* REDIRECT BASED ON ROLE AFTER LOGIN */
                <motion.div
                  key="dashboard_container"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {(currentUser.role === "client" || (currentUser.role === "admin" && currentUser.viewRole === "client")) && (
                    <ClientDashboard user={currentUser} onRefreshUser={handleRefreshUser} />
                  )}
                  {(currentUser.role === "lawyer" || (currentUser.role === "admin" && currentUser.viewRole === "lawyer")) && (
                    <LawyerDashboard user={currentUser} onRefreshUser={handleRefreshUser} />
                  )}
                  {(currentUser.role === "clinic" || (currentUser.role === "admin" && currentUser.viewRole === "clinic")) && (
                    <ClinicDashboard user={currentUser} onRefreshUser={handleRefreshUser} />
                  )}
                  {currentUser.role === "admin" && (!currentUser.viewRole || currentUser.viewRole === "admin") && (
                    <AdminDashboard user={currentUser} />
                  )}
                </motion.div>
              ) : (
                /* REDESIGNED LANDING PAGE — IMMERSIVE, INTUITIVE & MINIMAL (MINT BRANDED STYLE) */
                <motion.div
                  key="landing_view"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <LandingPage
                    onTriggerAuth={triggerAuthFlow}
                    onNavigate={handleNavigateToSection}
                    pendingScrollSection={scrollToSection}
                  />
                </motion.div>
              )}
            </>
          )}

        </AnimatePresence>
      </main>

    </div>
  );
}
