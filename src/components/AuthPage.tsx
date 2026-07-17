import React, { useState } from "react";
import { UserRole, PLANS } from "../types";
import { 
  ShieldCheck, User as UserIcon, Award, Activity, CheckSquare, Sparkles, 
  LogIn, Key, Loader2, Mail, Shield, Lock, Send, CheckCircle2, RefreshCw, X,
  Eye, EyeOff
} from "lucide-react";

interface AuthPageProps {
  onAuthSuccess: (user: any) => void;
  initialRole?: UserRole;
  initialSignUp?: boolean;
}

export default function AuthPage({ onAuthSuccess, initialRole = "client", initialSignUp = false }: AuthPageProps) {
  const [isSignUp, setIsSignUp] = useState(initialSignUp);

  React.useEffect(() => {
    setIsSignUp(initialSignUp);
  }, [initialSignUp]);

  React.useEffect(() => {
    if (initialRole) {
      setRole(initialRole);
    }
  }, [initialRole]);

  const [role, setRole] = useState<UserRole>(initialRole);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  // Forgot Password & OTP Flow States
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [demoOtpCode, setDemoOtpCode] = useState<string | null>(null); // For developer convenience in sandbox
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [timer, setTimer] = useState(15);
  const [canResend, setCanResend] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [licenseNumber, setLicenseNumber] = useState("");
  const [orgName, setOrgName] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Handle OTP countdown timer
  React.useEffect(() => {
    if (!otpModalOpen || !otpSent) return;

    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [otpModalOpen, otpSent]);

  // Send OTP
  const handleSendOtp = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setError(null);
    setSuccess(null);
    setDemoOtpCode(null);
    setModalError(null);
    setModalSuccess(null);

    if (!email) {
      setError("Please enter your workspace email address first.");
      return;
    }

    if (!email.includes("@")) {
      setError("Please enter a valid email address. For example: name@practice.com");
      return;
    }

    // IMMEDIATELY OPEN POPUP SCREEN & INITIALIZE TIMER & SHOW INPUT BOX
    setOtpModalOpen(true);
    setOtpSent(true); // Open input box immediately
    setTimer(15);
    setCanResend(false);
    setOtpVerified(false);
    setOtp("");

    setLoading(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });

      const text = await response.text();
      let data: any = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (e) {
          data = { error: text };
        }
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate OTP code. Verify your account matches this role.");
      }

      setModalSuccess("One-Time Password (OTP) dispatched! Please verify your inbox.");
      
      // If we are in demo mode (no real email keys), show the code directly to make sandbox testing effortless!
      if (data.demoOtpCode || data.otp) {
        const otpCode = data.otp || data.demoOtpCode;
        setDemoOtpCode(otpCode);
      }
    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    setModalError(null);
    setModalSuccess(null);
    setDemoOtpCode(null);
    
    // Reset timer immediately
    setTimer(15);
    setCanResend(false);

    setLoading(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });

      const text = await response.text();
      let data: any = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (e) {
          data = { error: text };
        }
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to resend verification OTP.");
      }

      setModalSuccess("A fresh verification OTP has been generated.");
      
      if (data.demoOtpCode || data.otp) {
        const otpCode = data.otp || data.demoOtpCode;
        setDemoOtpCode(otpCode);
      }
    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setModalError(null);
    setModalSuccess(null);

    if (!otp || otp.length < 5) {
      setModalError("Please enter the complete 6-digit OTP code sent to your email.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role, otp }),
      });

      const text = await response.text();
      let data: any = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (e) {
          data = { error: text };
        }
      }

      if (!response.ok) {
        throw new Error(data.error || "Incorrect OTP. Please check the code and try again.");
      }

      setOtpVerified(true);
      setModalSuccess("OTP verified successfully! Now, please enter your new secure password.");
    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Reset password after verification
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setModalError(null);
    setModalSuccess(null);

    if (!newPassword) {
      setModalError("Please specify a new security password.");
      return;
    }

    if (newPassword.length < 6) {
      setModalError("The new password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role, password: newPassword, otp }),
      });

      const text = await response.text();
      let data: any = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (e) {
          data = { error: text };
        }
      }

      if (!response.ok) {
        throw new Error(data.error || "Password update failed. Please try again.");
      }

      setModalSuccess("Your workspace password has been updated successfully! Returning to login screen...");
      setSuccess("Your workspace password has been updated successfully! Please log in.");
      
      setTimeout(() => {
        setIsForgotMode(false);
        setOtpModalOpen(false);
        setOtpSent(false);
        setOtpVerified(false);
        setOtp("");
        setPassword("");
        setNewPassword("");
        setDemoOtpCode(null);
        setModalSuccess(null);
        setModalError(null);
      }, 2000);

    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle normal login & registration
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email) {
      setError("Please enter the info: Email is required.");
      return;
    }

    if (!email.includes("@")) {
      setError("Please enter a valid email address. For example: name@practice.com");
      return;
    }

    if (!password) {
      setError("Please enter the info: Password is required.");
      return;
    }

    if (isSignUp) {
      if (password.length < 6) {
        setError("Password must be at least 6 characters long.");
        return;
      }
      if (!name) {
        setError("Please enter the info: Full Name is required.");
        return;
      }
      if (!acceptedTerms) {
        setError("You must read and agree to the Terms of Service and HIPAA consent privacy rules.");
        return;
      }
      if (role === 'lawyer' && !licenseNumber) {
        setError("A unique Professional License Number is required for lawyer registration.");
        return;
      }
    }

    setLoading(true);

    try {
      const endpoint = isSignUp ? "/api/auth/register" : "/api/auth/login";
      const payload = isSignUp ? {
        email,
        name,
        role,
        password,
        licenseNumber: role === 'lawyer' ? licenseNumber : undefined,
        orgName: (role === 'clinic' || role === 'lawyer') ? orgName : undefined,
      } : { email, role, password };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      let data: any = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (e) {
          data = { error: text };
        }
      }

      if (!response.ok) {
        throw new Error(data.error || "Authentication failed. Please verify your credentials.");
      }

      // If logging in, or registering, auto-accept terms on backend if checked
      if (isSignUp && acceptedTerms) {
        await fetch("/api/auth/accept-terms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: data.id })
        });
        data.acceptedTerms = true;
      }

      setSuccess(isSignUp ? "Account registered successfully! Logging you in..." : "Welcome back!");
      
      // Persist login state once to avoid repeatedly bothering the user
      localStorage.setItem("billslayer_session", JSON.stringify(data));
      
      setTimeout(() => {
        onAuthSuccess(data);
      }, 800);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Determine dynamic grid columns for role selectors to stretch them evenly across the full width
  const visibleRolesCount = (!isSignUp || isForgotMode) ? 4 : 3;

  return (
   <div className="min-h-screen bg-[#F9FAFB] flex flex-col lg:flex-row font-sans text-slate-900 w-full overflow-x-hidden no-scrollbar">
      
      {/* Left Column: Sleek Brand Artwork */}
      <div className="w-full lg:w-[40%] bg-slate-950 border-r border-slate-900 pt-10 sm:pt-14 px-8 sm:px-12 lg:px-16 pb-12 flex flex-col relative text-white overflow-hidden">
        {/* Subtle decorative circles */}
        <div className="absolute top-0 left-0 -mt-20 -ml-20 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 -mb-20 -mr-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Group: Logo and Slogans grouped together to prevent uneven shifting */}
        <div className="flex flex-col relative z-10">
          {/* Brand Logo Header (Aligned with homepage logo style) */}
          <div className="flex flex-col gap-1 text-left">
            <div className="flex items-center gap-2.5">
              <div className="relative flex items-center justify-center">
                <ShieldCheck className="w-8 h-8 text-emerald-400 animate-pulse" />
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full" />
              </div>
              <div className="flex items-baseline">
                <span className="font-extrabold text-2xl tracking-tight text-white">bill</span>
                <span className="font-black text-2xl tracking-tight text-emerald-400">slayer</span>
                <span className="text-[11px] font-black text-emerald-400 ml-1.5 uppercase tracking-widest">AI</span>
              </div>
            </div>
            <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase block mt-1 pl-0.5">
              Medical-Legal Dispute Engine
            </span>
          </div>

          {/* Marketing Slogans - mt-12 sm:mt-16 lg:mt-20 for exact consistent positioning */}
          <div className="mt-10 text-left max-w-md">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-black tracking-widest text-emerald-400 bg-emerald-500/10 px-3.5 py-1 rounded-full border border-emerald-400/20 uppercase">
              <Shield className="w-3.5 h-3.5" />
              Enterprise Grade Suite
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white mt-5 tracking-tight leading-tight font-display">
              Slay medical overcharges & protect margins.
            </h1>
            <p className="text-slate-300 mt-4 text-xs sm:text-sm leading-relaxed">
              Generate bulletproof clinical appeals and professional injury demand chronologies within seconds using our state-of-the-art AI compilation models.
            </p>

            <div className="space-y-5 mt-6 mb-8">
              <div className="flex items-start gap-3.5">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-400/20 text-emerald-400 flex items-center justify-center mt-0.5 shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed">
                  <strong className="text-white block font-extrabold">HIPAA Secure Workspace</strong> Data isolation safeguards patient records locally.
                </p>
              </div>
              <div className="flex items-start gap-3.5">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-400/20 text-emerald-400 flex items-center justify-center mt-0.5 shrink-0">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed">
                  <strong className="text-white block font-extrabold">AI-Assisted CPT Auditing</strong> Catch duplicate itemizations and code errors instantly.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Minimal Footer Credits */}
        <div className="text-[10px] text-slate-500 text-left mt-4">
          © 2026 BillSlayer AI Platform. Protected by industry standard encryption and mutual security clearances.
        </div>
      </div>

      {/* Right Column: Complete Login Form Container - Aligned to Top with Matching Padding */}
      <div className="w-full lg:w-[60%] flex items-start justify-center px-6 sm:px-12 lg:px-20 pt-10 sm:pt-14 bg-white">
        <div id="auth-form-top" className="w-full max-w-xl text-left space-y-6 scroll-mt-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#00BC7D] tracking-tight font-display">
              {isForgotMode
                ? "Reset Workspace Password"
                : isSignUp
                  ? "Create Your Workspace"
                  : "Welcome to BillSlayer AI"}
            </h2>

            <p className="text-xs sm:text-sm text-slate-500 mt-1.5">
              {isForgotMode
                ? "Generate a secure One-Time Password (OTP) code to verify your email."
                : isSignUp
                  ? "Configure your role to claim customized document models."
                  : "Enter your workspace credentials to resume operations."}
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 text-xs text-rose-800 flex items-start gap-3 shadow-2xs">
              <span className="font-semibold bg-rose-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[11px] shrink-0 mt-0.5">!</span>
              <span>{error}</span>
            </div>
          )}

          {/* Success Banner */}
          {success && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-xs text-emerald-800 flex items-start gap-3 shadow-2xs">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {/* Role selector buttons - Designed to spread beautifully across the whole width */}
          <div id="practice-role-selector" className="space-y-2 scroll-mt-6">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">
              Select Your Practice Role
            </label>
            
            <div className={`grid gap-2.5 w-full ${
              visibleRolesCount === 4 
                ? "grid-cols-2 sm:grid-cols-4" 
                : "grid-cols-1 sm:grid-cols-3"
            }`}>
              <button
                type="button"
                onClick={() => setRole("client")}
                className={`py-3 px-2 rounded-xl border text-xs font-black flex flex-col items-center justify-center gap-1.5 transition duration-200 cursor-pointer ${
                  role === "client"
                    ? "bg-emerald-500/5 border-[#00BC7D] text-[#00BC7D] shadow-xs"
                    : "bg-white border-slate-200 text-slate-600 hover:text-[#00BC7D] hover:bg-slate-50"
                }`}
              >
                <UserIcon className="w-4.5 h-4.5 shrink-0" />
                <span className="truncate text-[11px]">Client</span>
              </button>
              
              <button
                type="button"
                onClick={() => setRole("lawyer")}
                className={`py-3 px-2 rounded-xl border text-xs font-black flex flex-col items-center justify-center gap-1.5 transition duration-200 cursor-pointer ${
                  role === "lawyer"
                    ? "bg-emerald-500/5 border-[#00BC7D] text-[#00BC7D] shadow-xs"
                    : "bg-white border-slate-200 text-slate-600 hover:text-[#00BC7D] hover:bg-slate-50"
                }`}
              >
                <Award className="w-4.5 h-4.5 shrink-0" />
                <span className="truncate text-[11px]">Injury Lawyer</span>
              </button>

              <button
                type="button"
                onClick={() => setRole("clinic")}
                className={`py-3 px-2 rounded-xl border text-xs font-black flex flex-col items-center justify-center gap-1.5 transition duration-200 cursor-pointer ${
                  role === "clinic"
                    ? "bg-emerald-500/5 border-[#00BC7D] text-[#00BC7D] shadow-xs"
                    : "bg-white border-slate-200 text-slate-600 hover:text-[#00BC7D] hover:bg-slate-50"
                }`}
              >
                <Activity className="w-4.5 h-4.5 shrink-0" />
                <span className="truncate text-[11px]">Clinic Biller</span>
              </button>

              {(!isSignUp || isForgotMode) && (
                <button
                  type="button"
                  onClick={() => setRole("admin")}
                  className={`py-3 px-2 rounded-xl border text-xs font-black flex flex-col items-center justify-center gap-1.5 transition duration-200 cursor-pointer ${
                    role === "admin"
                      ? "bg-emerald-500/5 border-[#00BC7D] text-[#00BC7D] shadow-xs"
                    : "bg-white border-slate-200 text-slate-600 hover:text-[#00BC7D] hover:bg-slate-50"
                }`}
              >
                <Shield className="w-4.5 h-4.5 shrink-0" />
                <span className="truncate text-[11px]">Admin</span>
              </button>
              )}
            </div>
          </div>

          {/* FORGOT PASSWORD SCREEN */}
          {isForgotMode ? (
            <div className="space-y-4">
              
              {/* Input Email & Request Code */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      disabled={otpSent}
                      placeholder="e.g. name@practice.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white border border-slate-300 focus:border-[#00BC7D] focus:outline-none focus:ring-1 focus:ring-[#00BC7D] rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition disabled:bg-slate-50 disabled:text-slate-500"
                    />
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  </div>
                </div>

                {!otpSent ? (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleSendOtp}
                    className="w-full bg-[#00BC7D] hover:bg-[#00A86F] disabled:bg-slate-100 disabled:text-slate-400 text-white text-xs font-bold py-3 px-4 rounded-xl transition duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-xs uppercase tracking-wider"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Generate & Send Verification OTP
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-2.5 text-xs text-emerald-800 text-center">
                      Security OTP has been sent to your email address.
                    </div>
                    <button
                      type="button"
                      onClick={() => setOtpModalOpen(true)}
                      className="w-full bg-[#00BC7D] hover:bg-[#00A86F] text-white text-xs font-bold py-3 px-4 rounded-xl transition duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-xs uppercase tracking-wider"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Open Verification Window
                    </button>
                  </div>
                )}
              </div>

            </div>
          ) : (
            /* STANDARD LOGIN / SIGN UP SCREEN - SPACING TIGHTENED */
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Name Input - Sign Up Only */}
              {isSignUp && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Alexander Mercer"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white border border-slate-300 focus:border-[#00BC7D] focus:outline-none focus:ring-1 focus:ring-[#00BC7D] rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition"
                  />
                </div>
              )}

              {/* Email Address */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. name@practice.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white border border-slate-300 focus:border-[#00BC7D] focus:outline-none focus:ring-1 focus:ring-[#00BC7D] rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition"
                />
              </div>

              {/* Password input */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-500">
                    Password
                  </label>
                  {!isSignUp && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotMode(true);
                        setOtpSent(false);
                        setOtpVerified(false);
                        setError(null);
                        setSuccess(null);
                        setDemoOtpCode(null);
                      }}
                      className="text-xs font-semibold text-[#00BC7D] hover:text-[#00A86F] underline cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    style={!showPassword ? ({ WebkitTextSecurity: "disc", textSecurity: "disc" } as React.CSSProperties) : undefined}
                    autoComplete="off"
                    required
                    placeholder="e.g. ••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white border border-slate-300 focus:border-[#00BC7D] focus:outline-none focus:ring-1 focus:ring-[#00BC7D] rounded-xl pl-4 pr-11 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1 cursor-pointer flex items-center justify-center"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {isSignUp && (
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Password must be at least 6 characters long to protect your client cases.
                  </span>
                )}
              </div>

              {/* Lawyer License Number - Sign Up Only */}
              {isSignUp && role === "lawyer" && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    Unique Professional License Number
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BAR-6512-NY"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    className="w-full bg-white border border-slate-300 focus:border-[#00BC7D] focus:outline-none focus:ring-1 focus:ring-[#00BC7D] rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Verifies legal authorization. This number is unique and cannot be reused.
                  </span>
                </div>
              )}

              {/* Practice Organization Name - Sign Up Only */}
              {isSignUp && (role === "clinic" || role === "lawyer") && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    Practice / Facility Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={role === "clinic" ? "e.g. Apex Health & Surgery Center" : "e.g. Mercer Legal Associates LLC"}
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="w-full bg-white border border-slate-300 focus:border-[#00BC7D] focus:outline-none focus:ring-1 focus:ring-[#00BC7D] rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition"
                  />
                </div>
              )}

              {/* Terms and Conditions Checkbox */}
              {isSignUp && (
                <div className="flex items-start gap-2.5 pt-1">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-1 accent-emerald-500 h-4 w-4 bg-white border-slate-300 rounded cursor-pointer"
                  />
                  <label htmlFor="terms" className="text-xs text-slate-500 leading-relaxed cursor-pointer select-none">
                    I agree to the <strong>Terms of Service</strong>, understand that documents are generated via paid compute resources with one-time access, and consent to localized HIPAA security rules.
                  </label>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#00BC7D] hover:bg-[#00A86F] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs sm:text-sm font-black py-3.5 rounded-xl transition duration-200 mt-2 cursor-pointer flex items-center justify-center gap-2 shadow-xs uppercase tracking-wider"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verifying Credentials...
                  </>
                ) : isSignUp ? (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Complete Registration &rarr;
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    Enter Workspace &rarr;
                  </>
                )}
              </button>
            </form>
          )}

          {/* Toggle login vs signup */}
          <div  className="mt-4 pt-3 pb-8 border-t border-slate-200 text-center text-xs">
            {isForgotMode ? (
              <>
                <span className="text-slate-500">Remembered your password?</span>{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotMode(false);
                    setOtpSent(false);
                    setOtpVerified(false);
                    setOtp("");
                    setError(null);
                    setSuccess(null);
                    setDemoOtpCode(null);
                  }}
                  className="text-[#00BC7D] font-bold hover:text-[#00A86F] ml-1 underline cursor-pointer"
                >
                  Back to Sign In
                </button>
              </>
            ) : (
              <>
                <span className="text-slate-500">
                  {isSignUp ? "Already registered your workspace?" : "Need to generate document suites?"}
                </span>{" "}
                <button
                  type="button"
                  onClick={() => {
                    const newIsSignUp = !isSignUp;
                    setIsSignUp(newIsSignUp);
                    setError(null);
                    if (newIsSignUp && role === "admin") {
                      setRole("client");
                    }
                    // Smoothly scroll directly to the options so they don't have to scroll manually
                    setTimeout(() => {
                      const element = document.getElementById("practice-role-selector") || document.getElementById("auth-form-top");
                      if (element) {
                        element.scrollIntoView({ behavior: "smooth", block: "start" });
                      } else {
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }
                    }, 80);
                  }}
                  className="text-[#00BC7D] font-bold hover:text-[#00A86F] ml-1 underline cursor-pointer"
                >
                  {isSignUp ? "Sign In Instead" : "Create Professional Profile"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* SECURE OTP MODAL POPUP */}
      {otpModalOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <div 
            className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative border border-slate-150 animate-scaleIn text-slate-900"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            
            {/* Close Button */}
            <button
              type="button"
              onClick={() => {
                setOtpModalOpen(false);
                setOtpSent(false);
                setOtpVerified(false);
                setOtp("");
                setDemoOtpCode(null);
                setModalError(null);
                setModalSuccess(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition p-1.5 hover:bg-slate-100 rounded-full cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <ShieldCheck className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                {!otpSent 
                  ? "Generating Secure OTP" 
                  : !otpVerified 
                    ? "Enter Security OTP" 
                    : "Establish New Password"
                }
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {!otpSent
                  ? "Dispatched cryptographic security session credentials..."
                  : !otpVerified 
                    ? `Enter the 6-digit verification code sent to ${email}`
                    : "Specify your new practice password below to reclaim access."
                }
              </p>
            </div>

            {/* If still sending OTP */}
            {!otpSent ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <Loader2 className="w-12 h-12 animate-spin text-[#00BC7D]" />
                <span className="text-sm font-semibold text-slate-700">Generating secure credentials...</span>
              </div>
            ) : (
              <>
                {/* Local Modal Errors/Success messages */}
                {modalError && (
                  <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-xs text-rose-800 mb-4 flex items-start gap-2">
                    <span className="font-bold text-[10px] bg-rose-500 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center flex-shrink-0 mt-0.5">!</span>
                    <span>{modalError}</span>
                  </div>
                )}

                {modalSuccess && (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-xs text-emerald-800 mb-4">
                    {modalSuccess}
                  </div>
                )}

                {/* Form Step 2: Verify OTP */}
                {!otpVerified ? (
                  <form onSubmit={handleVerifyOtp} className="space-y-5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 text-center">
                        6-Digit Code
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        placeholder="e.g. 123456"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                        className="w-full bg-white border border-slate-300 focus:border-[#00BC7D] focus:outline-none focus:ring-1 focus:ring-[#00BC7D] rounded-xl px-4 py-3 text-xl tracking-[0.4em] text-center font-mono text-slate-900 placeholder-slate-300 transition"
                      />
                    </div>

                    {/* OTP Timer Countdown in modal */}
                    <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        {timer > 0 ? (
                          <>
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                            <span>Resend available in <strong className="font-bold text-slate-700">{timer}s</strong></span>
                          </>
                        ) : (
                          <>
                            <span className="w-1.5 h-1.5 bg-rose-500 rounded-full" />
                            <span>Did not receive code?</span>
                          </>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={!canResend || loading}
                        onClick={handleResendOtp}
                        className={`text-xs font-bold transition flex items-center gap-1 cursor-pointer px-3 py-2 rounded-lg ${
                          canResend && !loading
                            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                            : "bg-slate-100 text-slate-400 cursor-not-allowed opacity-60"
                        }`}
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                        Resend OTP
                      </button>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setOtpModalOpen(false);
                          setOtpSent(false);
                          setOtp("");
                          setDemoOtpCode(null);
                          setModalError(null);
                          setModalSuccess(null);
                        }}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl text-sm transition cursor-pointer text-center"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={loading || otp.length !== 6}
                        className="flex-1 bg-[#00BC7D] hover:bg-[#00A86F] disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-3 rounded-xl text-sm transition cursor-pointer flex items-center justify-center gap-2 shadow-md"
                      >
                        {loading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <ShieldCheck className="w-4 h-4" />
                        )}
                        Confirm Code
                      </button>
                    </div>
                  </form>
                ) : (
                  /* Form Step 3: Reset Password */
                  <form onSubmit={handleResetPassword} className="space-y-5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        New Security Password
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          style={!showNewPassword ? ({ WebkitTextSecurity: "disc", textSecurity: "disc" } as React.CSSProperties) : undefined}
                          autoComplete="off"
                          required
                          placeholder="e.g. ••••••••"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full bg-white border border-slate-300 focus:border-[#00BC7D] focus:outline-none focus:ring-1 focus:ring-[#00BC7D] rounded-xl pl-4 pr-11 py-3 text-sm text-slate-900 placeholder-slate-400 transition"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1 cursor-pointer flex items-center justify-center"
                          title={showNewPassword ? "Hide password" : "Show password"}
                        >
                          {showNewPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        Choose at least 6 alphanumeric characters to protect patient-lawyer confidentiality records.
                      </span>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setOtpVerified(false);
                          setNewPassword("");
                          setModalError(null);
                          setModalSuccess(null);
                        }}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl text-sm transition cursor-pointer text-center"
                      >
                        Back to OTP
                      </button>
                      <button
                        type="submit"
                        disabled={loading || newPassword.length < 6}
                        className="flex-1 bg-[#00BC7D] hover:bg-[#00A86F] disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-3 rounded-xl text-sm transition cursor-pointer flex items-center justify-center gap-2 shadow-md"
                      >
                        {loading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Key className="w-4 h-4" />
                        )}
                        Update Password
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
