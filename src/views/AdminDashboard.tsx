import React, { useState, useEffect } from "react";
import { User, UserRole, PLANS } from "../types";
import { 
  Users, DollarSign, Cpu, ShieldAlert, Key, Settings, Loader2, 
  CheckCircle, Plus, Edit, AlertCircle, RefreshCw, Trash2, ShieldCheck, UserCheck, Database, LayoutDashboard
} from "lucide-react";
import DatabaseExplorer from "../components/DatabaseExplorer";

interface AdminDashboardProps {
  user: User;
}

export default function AdminDashboard({ user }: AdminDashboardProps) {
  const [adminView, setAdminView] = useState<"overview" | "database">("overview");
  const [users, setUsers] = useState<User[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>({
    totalRevenue: 0,
    apiCost: 0,
    profitMargin: 100,
    hasSafeMargins: true
  });
  
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [creditAdjustment, setCreditAdjustment] = useState(0);

  // New admin form states
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [adminFormError, setAdminFormError] = useState<string | null>(null);
  const [adminFormSuccess, setAdminFormSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const uRes = await fetch("/api/admin/users");
      const uData = await uRes.json();
      setUsers(Array.isArray(uData) ? uData : []);

      const pRes = await fetch("/api/admin/payments");
      const pData = await pRes.json();
      setPayments(Array.isArray(pData) ? pData : []);

      const mRes = await fetch("/api/admin/metrics");
      if (mRes.ok) {
        const mData = await mRes.json();
        const totalRevenue = mData.totalRevenue ?? 0;
        const totalApiCost = mData.totalApiCost ?? 0;
        const profitMargin = totalRevenue > 0 ? Math.round(((totalRevenue - totalApiCost) / totalRevenue) * 100) : 100;
        const hasSafeMargins = profitMargin >= 15 || totalRevenue === 0;

        setMetrics({
          totalRevenue,
          totalApiCost,
          apiCost: totalApiCost, // compatibility
          profitMargin,
          hasSafeMargins,
          totalUsers: mData.totalUsers ?? 0,
          totalDocsGenerated: mData.totalDocsGenerated ?? 0,
          subscriptionsByType: mData.subscriptionsByType ?? { free: 0, basic: 0, pro: 0, enterprise: 0 }
        });
      }
    } catch (e) {
      console.error("Error loading admin stats:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCredits = async (targetUserId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${targetUserId}/credits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits: creditAdjustment })
      });

      if (res.ok) {
        setSelectedUser(null);
        setCreditAdjustment(0);
        fetchAdminData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleBlockUser = async (targetUserId: string, block: boolean) => {
    try {
      const res = await fetch(`/api/admin/users/${targetUserId}/block`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ block })
      });

      if (res.ok) {
        fetchAdminData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleExpirePlan = async (targetUserId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${targetUserId}/expire-plan`, {
        method: "POST"
      });
      if (res.ok) {
        fetchAdminData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminFormError(null);
    setAdminFormSuccess(null);

    const trimmedName = newAdminName.trim();
    const trimmedEmail = newAdminEmail.trim();

    if (!trimmedName || !trimmedEmail) {
      setAdminFormError("Please enter the info: Name and Email are required.");
      return;
    }
    if (!trimmedEmail.includes("@")) {
      setAdminFormError("Please enter a valid email address containing '@'.");
      return;
    }

    try {
      const res = await fetch("/api/admin/add-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, email: trimmedEmail })
      });

      if (res.ok) {
        setNewAdminName("");
        setNewAdminEmail("");
        setAdminFormSuccess(`Administrator "${trimmedName}" account provisioned successfully!`);
        setAdminFormError(null);
        fetchAdminData();
      } else {
        const text = await res.text();
        let errorMessage = "Failed to provision admin.";
        try {
          const err = JSON.parse(text);
          errorMessage = err.error || errorMessage;
        } catch (_) {
          errorMessage = text || errorMessage;
        }
        setAdminFormError(errorMessage);
      }
    } catch (err) {
      console.error(err);
      setAdminFormError("System error occurred. Please check network connection.");
    }
  };

  const handleTerminateUser = async (targetUserId: string, targetName: string) => {
    if (confirm(`CRITICAL OPERATION: Are you sure you want to terminate "${targetName}"'s account and delete their entire history? This action is permanent.`)) {
      try {
        const res = await fetch(`/api/admin/users/${targetUserId}`, {
          method: "DELETE"
        });
        if (res.ok) {
          fetchAdminData();
        } else {
          const err = await res.json();
          alert(err.error || "Failed to terminate account.");
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const activeMargin = metrics.profitMargin ?? 100;
  const hasSafe = metrics.hasSafeMargins ?? true;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 text-slate-800 font-sans">
      
      {/* Header & Sub-Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <span className="text-rose-600 font-bold text-[10px] uppercase tracking-widest bg-rose-50 px-3 py-1 rounded-full border border-rose-200 shadow-sm inline-block">
            System Staff Admin Portal
          </span>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mt-2.5">
            Platform Operations Panel
          </h1>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="bg-slate-200/80 p-1 rounded-2xl flex items-center border border-slate-300/60 shadow-inner">
            <button
              onClick={() => setAdminView("overview")}
              className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
                adminView === "overview" 
                  ? "bg-white text-slate-900 shadow-sm" 
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <LayoutDashboard className="w-4 h-4 text-indigo-600" />
              Platform Overview
            </button>
            <button
              onClick={() => setAdminView("database")}
              className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
                adminView === "database" 
                  ? "bg-slate-900 text-white shadow-sm" 
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Database className="w-4 h-4 text-emerald-400" />
              Backend Database Inspector
            </button>
          </div>

          {adminView === "overview" && (
            <button
              onClick={fetchAdminData}
              className="bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-sm cursor-pointer flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4 text-emerald-600" />
              Refresh
            </button>
          )}
        </div>
      </div>

      {adminView === "database" ? (
        <DatabaseExplorer />
      ) : (
        <>

      {/* Safety System Warning regarding API Costs vs Platform Revenue */}
      <div className={`border p-5 rounded-2xl mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm ${
        hasSafe 
          ? "bg-emerald-50/75 border-emerald-200/80 text-emerald-900" 
          : "bg-rose-50/75 border-rose-200/80 text-rose-900"
      }`}>
        <div className="flex items-start gap-3.5">
          <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${hasSafe ? "text-emerald-600" : "text-rose-600"}`} />
          <div className="text-xs">
            <span className="font-black uppercase tracking-wider block mb-0.5">
              {hasSafe ? "API Compute Margins Healthy" : "CRITICAL WARNING: API cost deficit"}
            </span>
            <span className="text-slate-600 font-medium">
              The system prevents API costs from ever exceeding the revenue generated from subscriptions by implementing dynamic model quotas and auto-blocking bad actors. Current active margin is <strong className="text-slate-900 font-bold">{activeMargin}%</strong>.
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <span className={`text-[10px] px-3 py-1 rounded-full font-extrabold uppercase shadow-sm ${
            hasSafe ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : "bg-rose-100 text-rose-800 border border-rose-200"
          }`}>
            Status: {hasSafe ? "Safe" : "Deficit Warning"}
          </span>
        </div>
      </div>

      {/* Numerical Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        <div className="bg-white border border-slate-200 rounded-2xl p-5.5 shadow-sm hover:shadow transition duration-200 text-left">
          <div className="flex justify-between items-center mb-2.5">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Revenue Received</span>
            <div className="p-1.5 bg-emerald-50 rounded-lg"><DollarSign className="w-4 h-4 text-emerald-600" /></div>
          </div>
          <p className="text-2xl font-black text-slate-950">${(metrics.totalRevenue ?? 0).toFixed(2)} <span className="text-xs font-semibold text-slate-400">USD</span></p>
          <span className="text-[10px] text-slate-400 font-medium mt-1 block">Stripe Sandbox checkout totals</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5.5 shadow-sm hover:shadow transition duration-200 text-left">
          <div className="flex justify-between items-center mb-2.5">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gemini API Compute Cost</span>
            <div className="p-1.5 bg-indigo-50 rounded-lg"><Cpu className="w-4 h-4 text-indigo-600" /></div>
          </div>
          <p className="text-2xl font-black text-slate-950">${(metrics.totalApiCost ?? metrics.apiCost ?? 0).toFixed(4)} <span className="text-xs font-semibold text-slate-400">USD</span></p>
          <span className="text-[10px] text-slate-400 font-medium mt-1 block">Tracked model execution price</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5.5 shadow-sm hover:shadow transition duration-200 text-left">
          <div className="flex justify-between items-center mb-2.5">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Profit Margin Status</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-extrabold uppercase border border-emerald-100">
              OK
            </span>
          </div>
          <p className="text-2xl font-black text-slate-950">{activeMargin}%</p>
          <span className="text-[10px] text-slate-400 font-medium mt-1 block">Net profitability buffer</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5.5 shadow-sm hover:shadow transition duration-200 text-left">
          <div className="flex justify-between items-center mb-2.5">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Registered Workspaces</span>
            <div className="p-1.5 bg-emerald-50 rounded-lg"><Users className="w-4 h-4 text-emerald-600" /></div>
          </div>
          <p className="text-2xl font-black text-slate-950">{users.length} <span className="text-xs font-semibold text-slate-400">Profiles</span></p>
          <span className="text-[10px] text-slate-400 font-medium mt-1 block">Separated user environments</span>
        </div>
      </div>

      {/* Activity Graph Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-10 shadow-sm text-left">
        <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-600" />
          Live Platform Activity Analytics
        </h2>
        <p className="text-xs text-slate-500 mb-6 font-semibold">
          Real-time tracking of workspace activities, document compliance pipelines, and payments processed.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-2">
          {[
            { label: "Document Generation", count: metrics.totalDocsGenerated ?? 18, color: "bg-emerald-500" },
            { label: "Active Profiles", count: users.length ?? 4, color: "bg-teal-500" },
            { label: "Stripe Sandbox Tx", count: payments.length ?? 8, color: "bg-cyan-500" },
            { label: "Admin Clearance", count: users.filter(u => u.role === 'admin').length ?? 1, color: "bg-indigo-500" }
          ].map((act, index, arr) => {
            const maxActivity = Math.max(...arr.map(a => a.count), 1);
            const percentage = (act.count / maxActivity) * 100;
            return (
              <div key={index} className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col justify-between hover:border-emerald-200 transition duration-150">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                    {act.label}
                  </span>
                  <span className="text-2xl font-black text-slate-900">
                    {act.count}
                  </span>
                </div>
                
                {/* Visual bar */}
                <div className="mt-4">
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${act.color} rounded-full transition-all duration-1000`} 
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-slate-400 font-semibold mt-1 block text-right">
                    {percentage.toFixed(0)}% of maximum
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Splitscreen: User Directory and Payment Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* User Workspace Management (Left 2 columns) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-5 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600" />
              Platform Workspace Accounts Directory
            </h2>

            {loading ? (
              <div className="py-16 text-center">
                <Loader2 className="w-7 h-7 animate-spin text-emerald-600 mx-auto" />
                <p className="text-xs text-slate-400 font-semibold mt-3">Retrieving system registries...</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto pr-2">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-extrabold uppercase tracking-wider text-[10px]">
                      <th className="py-3">User Workspace</th>
                      <th className="py-3">Access Role</th>
                      <th className="py-3">Active Plan</th>
                      <th className="py-3">Credits</th>
                      <th className="py-3 text-right">System Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 font-semibold">
                          No registered workspace profiles found in this environment.
                        </td>
                      </tr>
                    ) : (
                      users.map(u => {
                        const hasSubscription = u.planId !== 'free';
                        const expiryStr = (u as any).planExpiresAt 
                          ? new Date((u as any).planExpiresAt).toLocaleDateString()
                          : "None";
                        const isExpired = (u as any).planExpiresAt && new Date((u as any).planExpiresAt) < new Date();

                        return (
                          <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition duration-150">
                            <td className="py-3.5">
                              <span className="font-extrabold text-slate-800 text-sm block">{u.name}</span>
                              <span className="text-[10px] text-slate-400 font-semibold mt-0.5 block">{u.email}</span>
                            </td>
                            <td className="py-3.5">
                              <span className="font-bold text-slate-600 capitalize bg-slate-100 px-2 py-0.5 rounded border border-slate-200/50 text-[10px]">
                                {u.role}
                              </span>
                            </td>
                            <td className="py-3.5">
                              <div className="flex flex-col">
                                <span className="uppercase text-[9px] bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded border border-indigo-200 font-black self-start">
                                  {u.planId}
                                </span>
                                {hasSubscription && (
                                  <span className={`text-[9px] font-bold mt-1 ${isExpired ? "text-rose-600" : "text-slate-400"}`}>
                                    Expires: {expiryStr} {isExpired && "(Expired)"}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 text-slate-700 font-black text-sm">{u.availableCredits}</td>
                            <td className="py-3.5 text-right space-x-1.5 whitespace-nowrap">
                              <button
                                onClick={() => {
                                  setSelectedUser(u);
                                  setCreditAdjustment(0);
                                }}
                                className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-[10px] font-extrabold px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                              >
                                Adjust Credits
                              </button>
                              
                              {hasSubscription && !isExpired && (
                                <button
                                  onClick={() => handleExpirePlan(u.id)}
                                  className="bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-[10px] font-extrabold px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                                  title="Set plan as expired to test fallback billing popup before generation"
                                >
                                  Force Expiry
                                </button>
                              )}

                              <button
                                onClick={() => handleToggleBlockUser(u.id, !u.isBlocked)}
                                className={`text-[10px] font-extrabold px-2.5 py-1.5 rounded-lg border transition cursor-pointer ${
                                  u.isBlocked 
                                    ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600" 
                                    : "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200"
                                }`}
                              >
                                {u.isBlocked ? "Unblock" : "Block"}
                              </button>
                              {u.email && u.email.toLowerCase() !== "maheenu2317@gmail.com" && (
                                <button
                                  onClick={() => handleTerminateUser(u.id, u.name)}
                                  className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-[10px] font-extrabold px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                                >
                                  Terminate
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Live Ledger and Admin Creation Stack (Right column) */}
        <div className="space-y-8">
          
          {/* Add an Admin Form Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm text-left">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-500" />
              Add an Admin
            </h2>
            <p className="text-[11px] text-slate-500 mb-5 leading-relaxed font-semibold">
              Provision a new secure administrator account. New administrators will receive standard operations clearance.
            </p>
            
            {adminFormError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl p-3 mb-4 flex items-start gap-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500 mt-0.5" />
                <span>{adminFormError}</span>
              </div>
            )}
            
            {adminFormSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-xl p-3 mb-4 flex items-start gap-2 animate-fadeIn">
                <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-500 mt-0.5" />
                <span>{adminFormSuccess}</span>
              </div>
            )}

            <form onSubmit={handleAddAdminSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Admin Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Admin Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. John@gmail.com"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-black py-2.5 rounded-xl cursor-pointer transition flex items-center justify-center gap-1.5 shadow-sm uppercase tracking-wider"
              >
                <Plus className="w-4 h-4" />
                Add an Admin
              </button>
            </form>
          </div>

          {/* Stripe Transaction Ledger */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm text-left">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              Live Payment Transactions Ledger
            </h2>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {payments.length === 0 ? (
                <p className="text-xs text-slate-400 font-semibold py-4">No transactions recorded in sandbox database.</p>
              ) : (
                payments.map((p, i) => (
                  <div key={i} className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 text-left text-xs hover:bg-slate-100/30 transition">
                    <div className="flex justify-between items-start">
                      <div className="min-w-0 flex-grow pr-2">
                        <span className="font-extrabold text-slate-800 block truncate">{p.item}</span>
                        <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">Account: {p.userEmail}</span>
                      </div>
                      <span className="font-black text-emerald-600 text-sm whitespace-nowrap">+${p.amount}.00</span>
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-400 font-bold mt-2.5 pt-2 border-t border-slate-200/50">
                      <span>Stripe Record Secure</span>
                      <span>{p.createdAt ? new Date(p.createdAt).toLocaleDateString() : new Date().toLocaleDateString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

      {/* ADJUST CREDITS MODAL */}
      {selectedUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-6 text-left relative shadow-2xl animate-scaleUp">
            <h3 className="text-sm font-black text-slate-900 mb-1.5 uppercase tracking-wider flex items-center gap-2">
              <Edit className="w-4 h-4 text-indigo-600" />
              Adjust Workspace Credits
            </h3>
            <p className="text-xs text-slate-500 font-semibold mb-6 leading-relaxed">
              Grant or deduct subscription compute credits for <strong>{selectedUser.name}</strong> ({selectedUser.email}). Current: <strong className="text-slate-800">{selectedUser.availableCredits}</strong>.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                  Credits to add/subtract (e.g. -5, 10)
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={creditAdjustment}
                  onChange={(e) => setCreditAdjustment(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 font-bold focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                />
              </div>

              <div className="flex gap-2.5 pt-4">
                <button
                  onClick={() => handleUpdateCredits(selectedUser.id)}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white text-xs font-black py-2.5 rounded-xl transition cursor-pointer uppercase tracking-wider shadow-sm"
                >
                  Apply Adjustment
                </button>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-bold py-2.5 px-4.5 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

        </>
      )}

    </div>
  );
}
