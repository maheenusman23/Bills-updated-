export type UserRole = 'client' | 'lawyer' | 'clinic' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  password?: string;
  licenseNumber?: string;
  orgName?: string;
  orgType?: 'clinic' | 'law_firm';
  acceptedTerms: boolean;
  planId: string; // 'free' | 'basic' | 'pro' | 'enterprise'
  availableCredits: number;
  totalCreditsUsed: number;
  matchmakingConsent?: boolean;
  createdAt: string;
  isNewUser?: boolean;
  isBlocked?: boolean;
  viewRole?: UserRole;
  resetOtp?: string;
  resetOtpExpiresAt?: number;
  planExpiresAt?: string;
}

export interface BillItem {
  id: string;
  cptCode: string;
  description: string;
  statedAmount: number;
  adjustedAmount: number;
  violationType: "upcoded" | "duplicate" | "unbundled" | "none";
  severity: "high" | "medium" | "low";
}

export interface CaseFile {
  id: string;
  patientName: string;
  intakeDate: string;
  totalBill: number;
  savedAmount: number;
  status: "Ingested" | "Scrubbed" | "Audited" | "Appealed";
  codesCount: number;
}

export interface ChronologyEvent {
  id: string;
  date: string;
  provider: string;
  treatment: string;
  severity: "Severe" | "Moderate" | "Standard";
  cptCode: string;
}

export interface Case {
  id: string;
  title: string;
  description: string;
  patientName?: string;
  userId: string;
  role: UserRole;
  createdAt: string;
  status: string;
  files: Array<{ name: string; size: number; content?: string }>;
}

export interface GeneratedDocument {
  id: string;
  caseId: string;
  userId: string;
  role: UserRole;
  title: string;
  serviceType: string;
  content: string;
  createdAt: string;
  downloaded: boolean;
  isLocked: boolean; // One-time access locking
}

export interface Match {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  lawyerId: string;
  lawyerName: string;
  lawyerEmail: string;
  clientConsented: boolean;
  lawyerConsented: boolean;
  status?: string;
  initiatedBy?: string;
  createdAt: string; // ISO String
  isTimedOut: boolean;
  notified: boolean;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  creditsPerMonth: number;
  features: string[];
}

export interface AppNotification {
  id: string;
  userId: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'match_timeout';
  createdAt: string;
  read: boolean;
}

export interface PaymentRecord {
  id: string;
  userId: string;
  userEmail: string;
  amount: number;
  item: string;
  createdAt: string;
}

export interface ApiCostTracker {
  id: string;
  userId: string;
  userEmail: string;
  role: UserRole;
  serviceType: string;
  cost: number;
  revenue: number;
  createdAt: string;
}

export const PLANS: Record<string, SubscriptionPlan> = {
  free: {
    id: 'free',
    name: 'One-Time Payer',
    price: 15,
    creditsPerMonth: 0,
    features: ['Pay $15 per AI generation', 'Standard document templates', 'Single-user workspace', 'HIPAA Compliant Safe Vault']
  },
  clinic: {
    id: 'clinic',
    name: 'Professional Clinic',
    price: 89,
    creditsPerMonth: 10,
    features: ['10 Audits Included / Month', 'Client Intake Matchmaking', 'Advanced CPT Overlap Filters', 'Email Support']
  },
  lawyer: {
    id: 'lawyer',
    name: 'Elite Lawyer',
    price: 199,
    creditsPerMonth: 35,
    features: ['35 Audits Included / Month', 'Certified Firm Logo Seal', 'Direct Court-Ready Formats', '24/7 Priority Support']
  }
};

export const PRICING_PER_CASE = {
  'billing_audit': { name: 'Medical Billing Audit', price: 10 },
  'insurance_appeal': { name: 'Insurance Appeal Letter', price: 20 },
  'cpt_analysis': { name: 'CPT Code Analysis', price: 15 },
  'denial_explainer': { name: 'Insurance Denial Explanation', price: 10 },
  'treatment_chronology': { name: 'Treatment Chronology', price: 15 },
  'injury_demand': { name: 'Personal Injury Demand Package', price: 30 },
  'record_summary': { name: 'Medical Record Summary', price: 15 },
  'settlement_analysis': { name: 'Settlement Analysis', price: 20 }
};
