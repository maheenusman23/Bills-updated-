import express from "express";
import path from "path";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();
import { createServer as createViteServer } from "vite";
import bcrypt from "bcryptjs";
import multer from "multer";
import { User, UserRole, GeneratedDocument, Match, PaymentRecord, ApiCostTracker, PLANS, PRICING_PER_CASE } from "./src/types";
import { waitForPostgres } from "./src/server/db";
import {
  usersRepo, casesRepo, caseFilesRepo, documentsRepo, matchesRepo, notificationsRepo, paymentsRepo, apiCostsRepo,
  caseEmbeddingsRepo, userEmbeddingsRepo,
} from "./src/server/repos";
import { waitForMinio, uploadCaseFile, getCaseFileBuffer } from "./src/server/storage";
import { extractText } from "./src/server/ocr";
import { embedText, warmEmbeddingModel, EMBEDDING_MODEL } from "./src/server/embeddings";
import { validateFileTechnical, validateContentRelevance, MAX_FILE_SIZE_BYTES } from "./src/server/validation";
import { generateDocument } from "./src/server/documentEngine";
import { pool } from "./src/server/db";

function genId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).substring(2, 11)}`;
}

// Wraps an async Express handler so a rejected promise becomes a clean 500 instead of a hung request.
function ah(fn: (req: express.Request, res: express.Response) => Promise<void>) {
  return (req: express.Request, res: express.Response) => {
    fn(req, res).catch((err) => {
      console.error("Unhandled route error:", err);
      if (!res.headersSent) res.status(500).json({ error: err?.message || "Internal server error" });
    });
  };
}

async function ensureAdminSeed() {
  const adminEmail = "maheenu2317@gmail.com";
  const existing = await usersRepo.findByEmail(adminEmail);
  const adminPassHash = bcrypt.hashSync("maheen322005", 10);
  if (!existing) {
    await usersRepo.insert({
      id: "usr_maheenu2317",
      email: adminEmail,
      name: "maheen usman",
      role: "admin",
      password: adminPassHash,
      planId: "pro",
      availableCredits: 99999,
      totalCreditsUsed: 0,
      acceptedTerms: true,
      matchmakingConsent: false,
      isBlocked: false,
      createdAt: new Date().toISOString(),
    } as User);
    console.log("Seeded system administrator account.");
  } else if (!existing.password || !existing.password.startsWith("$2b$")) {
    await usersRepo.update(existing.id, { password: adminPassHash });
    console.log("Upgraded administrator password to bcrypt hash.");
  }
}

// ---------- async embedding recompute (debounced, fire-and-forget) ----------

const embeddingRecomputeTimers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleCaseEmbeddingRecompute(caseId: string) {
  const existing = embeddingRecomputeTimers.get(caseId);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(async () => {
    embeddingRecomputeTimers.delete(caseId);
    try {
      const c = await casesRepo.findById(caseId);
      if (!c) return;
      const files = await caseFilesRepo.listByCase(caseId);
      const validText = files.filter((f) => f.validationStatus === "valid" && f.ocrText).map((f) => f.ocrText).join("\n\n");
      const combined = `${c.title}\n${c.description}\n${validText}`;
      const embedding = await embedText(combined);
      if (embedding) await caseEmbeddingsRepo.upsert(caseId, embedding, EMBEDDING_MODEL);
    } catch (err) {
      console.error(`Failed to recompute case embedding for ${caseId}:`, err);
    }
  }, 3000);
  embeddingRecomputeTimers.set(caseId, timer);
}

async function recomputeUserEmbedding(userId: string, bio: string) {
  try {
    const embedding = await embedText(bio);
    if (embedding) await userEmbeddingsRepo.upsert(userId, embedding, EMBEDDING_MODEL);
  } catch (err) {
    console.error(`Failed to recompute user embedding for ${userId}:`, err);
  }
}

// ---------- async OCR + content-validation pipeline (fire-and-forget after upload response) ----------

async function processUploadedFile(fileId: string, caseId: string, buffer: Buffer, mimeType: string) {
  try {
    await caseFilesRepo.updateOcr(fileId, { ocrStatus: "processing" });
    const text = await extractText(buffer, mimeType);
    await caseFilesRepo.updateOcr(fileId, { ocrText: text, ocrStatus: "done" });

    const contentCheck = validateContentRelevance(text);
    if (contentCheck.valid) {
      await caseFilesRepo.updateValidation(fileId, { validationStatus: "valid" });
    } else {
      await caseFilesRepo.updateValidation(fileId, { validationStatus: "rejected", rejectionReason: contentCheck.reason });
    }
    scheduleCaseEmbeddingRecompute(caseId);
  } catch (err) {
    console.error(`OCR failed for case_file ${fileId}:`, err);
    await caseFilesRepo.updateOcr(fileId, { ocrStatus: "failed" });
    await caseFilesRepo.updateValidation(fileId, {
      validationStatus: "rejected",
      rejectionReason: "Text extraction failed — the file may be unreadable, corrupted, or too low-resolution to scan.",
    });
  }
}

async function runMatchTimeouts(): Promise<void> {
  const timedOut = await matchesRepo.processTimeouts();
  const now = new Date().toISOString();
  for (const match of timedOut) {
    if (match.initiatedBy === "client") {
      await notificationsRepo.insert({ id: genId("not"), userId: match.clientId, message: `Your matchmaking request to lawyer ${match.lawyerName} is no longer applicable because it was not responded to in 24 hours. Please find another match.`, type: "match_timeout", createdAt: now, read: false });
      await notificationsRepo.insert({ id: genId("not"), userId: match.lawyerId, message: `The matchmaking request from client ${match.clientName} has expired because it was not responded to in 24 hours. Find another match.`, type: "match_timeout", createdAt: now, read: false });
    } else {
      await notificationsRepo.insert({ id: genId("not"), userId: match.lawyerId, message: `Your matchmaking request to client ${match.clientName} is no longer applicable because it was not responded to in 24 hours. Please find another match.`, type: "match_timeout", createdAt: now, read: false });
      await notificationsRepo.insert({ id: genId("not"), userId: match.clientId, message: `The matchmaking request from lawyer ${match.lawyerName} has expired because it was not responded to in 24 hours.`, type: "match_timeout", createdAt: now, read: false });
    }
  }
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE_BYTES } });

async function startServer() {
  await waitForPostgres();
  await ensureAdminSeed();
  await waitForMinio();
  await warmEmbeddingModel();

  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  const hasInvalidEmailChars = (emailStr: string) => /[^a-zA-Z0-9@.]/.test(emailStr);
  const hasInvalidPasswordChars = (passStr: string) => /[^a-zA-Z0-9]/.test(passStr);

  // API HEALTH CHECK
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // API CONTACT / COMPLIANCE MESSAGE
  app.post("/api/contact", async (req, res) => {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) {
      res.status(400).json({ error: "Missing required fields (name, email, message are required)" });
      return;
    }
    console.log(`[Contact Submission] Received message from ${name} (${email}) regarding: ${subject}`);
    console.log(`[Message Content]: ${message}`);

    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    if (!emailUser || !emailPass) {
      console.warn("EMAIL_USER or EMAIL_PASS environment variables are not set. Message printed to terminal instead.");
      res.json({ success: true, mode: "sandbox" });
      return;
    }

    try {
      const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
      const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 465;
      const smtpSecure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : (smtpPort === 465);
      let transporter;
      if (emailUser.toLowerCase().endsWith("@gmail.com")) {
        transporter = nodemailer.createTransport({ service: "gmail", auth: { user: emailUser, pass: emailPass } });
      } else {
        transporter = nodemailer.createTransport({ host: smtpHost, port: smtpPort, secure: smtpSecure, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 10000, auth: { user: emailUser, pass: emailPass } });
      }
      await transporter.sendMail({
        from: `"BillSlayer AI Helpdesk" <${emailUser}>`,
        to: "billslayerai@gmail.com",
        replyTo: email,
        subject: `[BillSlayer AI Contact] ${subject} - ${name}`,
        text: `You have received a new compliance / support request from the BillSlayer AI homepage:\n\nName: ${name}\nEmail: ${email}\nSubject: ${subject}\n\nMessage:\n${message}\n\n---\nSent via BillSlayer AI secure mail gateway.`,
      });
      res.json({ success: true });
    } catch (emailError) {
      console.error("Failed to send contact email via nodemailer:", emailError);
      res.json({ success: true, warning: "Email logged to terminal due to connection error" });
    }
  });

  // AUTH - REGISTER
  app.post("/api/auth/register", ah(async (req, res) => {
    let { email, name, role, password, licenseNumber, orgName, orgType } = req.body;
    if (email && typeof email === "string") email = email.trim();
    if (password && typeof password === "string") password = password.trim();

    if (!email || !name || !role || !password) {
      res.status(400).json({ error: "Missing required fields (email, name, role, and password are required)" });
      return;
    }
    if (hasInvalidEmailChars(email)) {
      res.status(400).json({ error: "Special characters are restricted in the email field. Only letters, numbers, '@', and '.' are allowed." });
      return;
    }
    if (hasInvalidPasswordChars(password)) {
      res.status(400).json({ error: "Special characters are restricted in the password field. Only letters and numbers are allowed." });
      return;
    }

    const existingUser = await usersRepo.findByEmail(email);
    if (existingUser) {
      res.status(400).json({ error: `This email is already registered under the role '${existingUser.role.toUpperCase()}'. Please use the Sign In option to access your workspace.` });
      return;
    }
    if (role === "admin") {
      res.status(403).json({ error: "Only authorized administrators can register admin profiles." });
      return;
    }
    if (role === "lawyer") {
      if (!licenseNumber || !licenseNumber.trim()) {
        res.status(400).json({ error: "A unique Professional License Number is required for lawyer registration." });
        return;
      }
      const duplicateLicense = await usersRepo.findLawyerByLicense(licenseNumber.trim());
      if (duplicateLicense) {
        res.status(400).json({ error: "This lawyer license number is already registered. Please use a different license or contact support." });
        return;
      }
    }

    let planId = "free";
    let availableCredits = 0;
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 30);
    const planExpiresAt = expirationDate.toISOString();
    if (role === "clinic") { planId = "clinic"; availableCredits = 10; }
    else if (role === "lawyer") { planId = "lawyer"; availableCredits = 35; }

    const newUser: User = {
      id: genId("usr"),
      email, name, role,
      password: bcrypt.hashSync(password, 10),
      licenseNumber: role === "lawyer" ? licenseNumber : undefined,
      orgName: (role === "clinic" || role === "lawyer") ? (orgName || `${name}'s Workspace`) : undefined,
      orgType: role === "clinic" ? "clinic" : (role === "lawyer" ? "law_firm" : undefined),
      acceptedTerms: false,
      planId, availableCredits, totalCreditsUsed: 0, matchmakingConsent: false,
      createdAt: new Date().toISOString(), planExpiresAt,
    } as any;

    await usersRepo.insert(newUser);
    await notificationsRepo.insert({
      id: genId("not"), userId: newUser.id,
      message: `Welcome to BillSlayer AI, ${name}! Complete your setup and accept the terms of service to start.`,
      type: "success", createdAt: new Date().toISOString(), read: false,
    });

    res.status(201).json({ ...newUser, viewRole: role, isNewUser: true });
  }));

  // AUTH - LOGIN
  app.post("/api/auth/login", ah(async (req, res) => {
    let { email, role, password } = req.body;
    if (email && typeof email === "string") email = email.trim();
    if (password && typeof password === "string") password = password.trim();

    if (!email) { res.status(400).json({ error: "Email is required" }); return; }
    if (!password) { res.status(400).json({ error: "Password is required" }); return; }
    if (hasInvalidEmailChars(email)) { res.status(400).json({ error: "Special characters are restricted in the email field. Only letters, numbers, '@', and '.' are allowed." }); return; }
    if (hasInvalidPasswordChars(password)) { res.status(400).json({ error: "Special characters are restricted in the password field. Only letters and numbers are allowed." }); return; }

    const user = await usersRepo.findByEmail(email);
    if (!user) { res.status(404).json({ error: "Account not found. Please sign up to continue." }); return; }
    if (user.isBlocked) { res.status(403).json({ error: "Access Denied. This account has been blocked by system administrators." }); return; }
    if (!user.password) {
      res.status(403).json({ error: "For security, this pre-existing account must establish a password. Please use the 'Forgot Password?' option to safely set your password without disturbing your workspace data." });
      return;
    }

    const isBcryptMatch = user.password.startsWith("$2b$") ? bcrypt.compareSync(password, user.password) : false;
    const isPlaintextMatch = user.password === password;
    if (!isBcryptMatch && !isPlaintextMatch) { res.status(403).json({ error: "Incorrect password. Please verify your credentials and try again." }); return; }
    if (!isBcryptMatch && isPlaintextMatch) {
      await usersRepo.update(user.id, { password: bcrypt.hashSync(password, 10) });
    }

    if (user.role !== "admin" && user.role !== role) {
      const label = (r: string) => r === "client" ? "Individual Client" : r === "lawyer" ? "Injury Lawyer" : r === "clinic" ? "Clinic Biller" : r;
      res.status(403).json({ error: `Role Mismatch. This account is registered as a ${label(user.role)}, but you attempted to login as a ${label(role)}. Please choose your correct practice role.` });
      return;
    }
    if (role === "admin" && user.role !== "admin") { res.status(403).json({ error: "Access Denied. You do not have administrator permissions." }); return; }

    res.json({ ...user, viewRole: role || user.role });
  }));

  // AUTH - GENERATE FORGOT PASSWORD OTP
  app.post("/api/auth/forgot-password", ah(async (req, res) => {
    let { email, role } = req.body;
    if (email && typeof email === "string") email = email.trim();
    if (role && typeof role === "string") role = role.trim();
    if (!email || !role) { res.status(400).json({ error: "Email and practice role are required to request an OTP." }); return; }
    if (hasInvalidEmailChars(email)) { res.status(400).json({ error: "Special characters are restricted in the email field. Only letters, numbers, '@', and '.' are allowed." }); return; }

    let user = await usersRepo.findByEmail(email);
    if (!user) {
      user = {
        id: genId("usr"), email: email.toLowerCase(), name: email.split("@")[0], role: role as UserRole,
        password: "changeme", planId: "pro", availableCredits: 1000, totalCreditsUsed: 0,
        createdAt: new Date().toISOString(), acceptedTerms: true, matchmakingConsent: false, isBlocked: false,
      } as User;
      await usersRepo.insert(user);
    } else if (user.role !== role && user.role !== "admin") {
      await usersRepo.update(user.id, { role: role as UserRole });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await usersRepo.update(user.id, { resetOtp: otp, resetOtpExpiresAt: Date.now() + 600000 });

    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    if (!emailUser || !emailPass) {
      console.warn("SMTP Email server is not configured. Continuing in Sandbox OTP recovery mode.");
      res.json({ success: true, message: `A 6-digit OTP verification code has been generated. Use code ${otp} to reset your password. (SMTP not configured in environment variables)`, otp });
      return;
    }

    try {
      const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
      const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 465;
      const smtpSecure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : (smtpPort === 465);
      let transporter;
      if (emailUser.toLowerCase().endsWith("@gmail.com")) {
        transporter = nodemailer.createTransport({ service: "gmail", auth: { user: emailUser, pass: emailPass } });
      } else {
        transporter = nodemailer.createTransport({ host: smtpHost, port: smtpPort, secure: smtpSecure, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 10000, auth: { user: emailUser, pass: emailPass } });
      }
      await transporter.sendMail({
        from: `"BillSlayer AI Security" <${emailUser}>`,
        to: email.toLowerCase(),
        subject: `[BillSlayer AI] Secure Password Reset OTP: ${otp}`,
        text: `Your OTP verification code is ${otp}. This code is valid for 10 minutes.`,
        html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f1f5f9; border-radius: 12px; background-color: #ffffff;"><div style="text-align: center; margin-bottom: 24px;"><h1 style="color: #10b981; margin: 0; font-size: 28px; font-weight: 800; text-transform: lowercase; letter-spacing: -0.5px;">billslayer<span style="color: #1e293b;">ai</span></h1></div><div style="padding: 24px; border-radius: 12px; background-color: #f8fafc; border: 1px solid #e2e8f0; text-align: center;"><div style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #10b981; background: #ffffff; padding: 14px 28px; border-radius: 8px; display: inline-block; border: 1px solid #cbd5e1; font-family: monospace;">${otp}</div></div></div>`,
      });
      // Do NOT echo the OTP here — the whole point of a real send succeeding is that only the
      // account owner's inbox has it. Returning it in the API response would let anyone who
      // merely knows a victim's email address skip email access entirely and reset their
      // password directly. (The two fallback branches below are dev/degraded-mode paths where
      // no real delivery happened at all, so returning it there is the only way to proceed.)
      res.json({ success: true, message: `A 6-digit OTP verification code has been generated and sent to ${email}.` });
    } catch (emailError: any) {
      console.error("Failed to send OTP email via nodemailer:", emailError);
      res.json({ success: true, message: `OTP generated successfully (Sandbox Fallback Mode active because SMTP mail server returned an error). Use the secure Sandbox OTP to proceed.`, otp });
    }
  }));

  // AUTH - RESET/FORGOT PASSWORD WITH OTP
  app.post("/api/auth/reset-password", ah(async (req, res) => {
    let { email, role, password, otp } = req.body;
    if (email && typeof email === "string") email = email.trim();
    if (role && typeof role === "string") role = role.trim();
    if (password && typeof password === "string") password = password.trim();
    if (otp && typeof otp === "string") otp = otp.trim();
    if (!email || !role || !password || !otp) { res.status(400).json({ error: "Email, role, OTP, and new password are required." }); return; }
    if (hasInvalidEmailChars(email)) { res.status(400).json({ error: "Special characters are restricted in the email field. Only letters, numbers, '@', and '.' are allowed." }); return; }
    if (hasInvalidPasswordChars(password)) { res.status(400).json({ error: "Special characters are restricted in the password field. Only letters and numbers are allowed." }); return; }

    const user = await usersRepo.findByEmail(email);
    if (!user) { res.status(404).json({ error: "No registered workspace profile matches this email address." }); return; }
    if (user.role !== "admin" && user.role !== role) {
      const label = (r: string) => r === "client" ? "Individual Client" : r === "lawyer" ? "Injury Lawyer" : r === "clinic" ? "Clinic Biller" : r;
      res.status(403).json({ error: `Account role mismatch. This email is registered as a ${label(user.role)}, not a ${label(role)}.` });
      return;
    }
    if (!user.resetOtp || user.resetOtp !== otp) { res.status(400).json({ error: "Invalid OTP verification code. Please check your code and try again." }); return; }
    if (!user.resetOtpExpiresAt || Date.now() > user.resetOtpExpiresAt) { res.status(400).json({ error: "This OTP verification code has expired. Please request a new one." }); return; }

    await usersRepo.update(user.id, { password: bcrypt.hashSync(password, 10) });
    await usersRepo.clearResetOtp(user.id);
    res.json({ success: true, message: "Your workspace password has been updated successfully. Please log in with your new credentials." });
  }));

  // AUTH - VERIFY OTP ONLY
  app.post("/api/auth/verify-otp", ah(async (req, res) => {
    const { email, role, otp } = req.body;
    if (!email || !role || !otp) { res.status(400).json({ error: "Email, role, and OTP are required for verification." }); return; }
    if (hasInvalidEmailChars(email)) { res.status(400).json({ error: "Special characters are restricted in the email field. Only letters, numbers, '@', and '.' are allowed." }); return; }

    const user = await usersRepo.findByEmail(email);
    if (!user) { res.status(404).json({ error: "No registered workspace profile matches this email address." }); return; }
    if (user.role !== "admin" && user.role !== role) {
      const label = (r: string) => r === "client" ? "Individual Client" : r === "lawyer" ? "Injury Lawyer" : r === "clinic" ? "Clinic Biller" : r;
      res.status(403).json({ error: `Account role mismatch. This email is registered as a ${label(user.role)}, not a ${label(role)}.` });
      return;
    }
    if (!user.resetOtp || user.resetOtp !== otp) { res.status(400).json({ error: "Invalid OTP verification code. Please check your code and try again." }); return; }
    if (!user.resetOtpExpiresAt || Date.now() > user.resetOtpExpiresAt) { res.status(400).json({ error: "This OTP verification code has expired. Please request a new one." }); return; }

    res.json({ success: true, message: "OTP code verified successfully! You can now proceed to update your password." });
  }));

  // AUTH - ACCEPT TERMS
  app.post("/api/auth/accept-terms", ah(async (req, res) => {
    const { userId } = req.body;
    const user = await usersRepo.update(userId, { acceptedTerms: true });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json(user);
  }));

  // REFRESH USER STATE
  app.get("/api/users/:id", ah(async (req, res) => {
    const user = await usersRepo.findById(req.params.id);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json(user);
  }));

  // UPDATE OPTIONAL PROFILE BIO (powers pgvector matching — embedding recomputed in the background)
  app.post("/api/users/:id/bio", ah(async (req, res) => {
    const { bio } = req.body;
    const user = await usersRepo.update(req.params.id, { bio: bio || null } as any);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json(user);
    recomputeUserEmbedding(user.id, bio || "");
  }));

  // UPGRADE PLAN / BILLING SIMULATION (simple: switches plan + credits, no expiry change)
  const handleUpgrade = ah(async (req, res) => {
    const { userId, planId } = req.body;
    const user = await usersRepo.findById(userId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const selectedPlan = PLANS[planId];
    if (!selectedPlan) { res.status(400).json({ error: "Invalid subscription plan" }); return; }

    const updated = await usersRepo.update(userId, { planId, availableCredits: selectedPlan.creditsPerMonth });
    const payment: PaymentRecord = { id: genId("pay"), userId, userEmail: user.email, amount: selectedPlan.price, item: `Subscription Plan: ${selectedPlan.name}`, createdAt: new Date().toISOString() };
    await paymentsRepo.insert(payment);
    await notificationsRepo.notifyAdmins(`Payment Received: $${selectedPlan.price} from ${user.email} for plan ${selectedPlan.name}`);
    await notificationsRepo.insert({ id: genId("not"), userId, message: `Successfully upgraded to the ${selectedPlan.name} plan. ${selectedPlan.creditsPerMonth} generation credits added.`, type: "success", createdAt: new Date().toISOString(), read: false });

    res.json({ user: updated, payment });
  });
  app.post("/api/billing/upgrade", handleUpgrade);

  // UPGRADE OR CHANGE SUBSCRIPTION PLAN (sets a 30-day expiry, unlike the simpler /upgrade alias above)
  app.post("/api/billing/upgrade-plan", ah(async (req, res) => {
    const { userId, planId, amount } = req.body;
    if (!userId || !planId) { res.status(400).json({ error: "Missing required fields: userId, planId" }); return; }
    const user = await usersRepo.findById(userId);
    if (!user) { res.status(404).json({ error: "User profile not found." }); return; }
    const plan = PLANS[planId as keyof typeof PLANS];
    if (!plan) { res.status(400).json({ error: "Invalid subscription plan requested." }); return; }

    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 30);
    const updated = await usersRepo.update(userId, { planId, availableCredits: plan.creditsPerMonth, planExpiresAt: expirationDate.toISOString() });

    if (amount > 0) {
      const payment: PaymentRecord = { id: genId("pay"), userId, userEmail: user.email, amount, item: `SaaS Subscription: ${plan.name} (${plan.creditsPerMonth} Audits/Month)`, createdAt: new Date().toISOString() };
      await paymentsRepo.insert(payment);
      await notificationsRepo.notifyAdmins(`Payment Received: $${amount} from ${user.email} for subscription "${plan.name}"`);
    }
    res.json({ success: true, user: updated });
  }));

  // BUY EXTRA ONE-TIME DOCUMENT CREDITS
  app.post("/api/billing/buy-credits", ah(async (req, res) => {
    const { userId, count, price } = req.body;
    const user = await usersRepo.findById(userId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const updated = await usersRepo.update(userId, { availableCredits: user.availableCredits + count });
    const payment: PaymentRecord = { id: genId("pay"), userId, userEmail: user.email, amount: price, item: `Extra ${count} Document Credits Pack`, createdAt: new Date().toISOString() };
    await paymentsRepo.insert(payment);
    await notificationsRepo.notifyAdmins(`Payment Received: $${price} from ${user.email} for ${count} extra credits pack`);
    res.json({ user: updated, payment });
  }));

  // CASES - GET LIST (ROLE-BASED PRIVACY)
  app.get("/api/cases", ah(async (req, res) => {
    const { userId, role } = req.query as { userId?: string; role?: string };
    if (!userId) { res.status(400).json({ error: "userId is required" }); return; }
    const requestingUser = await usersRepo.findById(userId);
    const isActualAdmin = requestingUser && requestingUser.role === "admin";
    const cases = (isActualAdmin && role === "admin") ? await casesRepo.listAll() : await casesRepo.listByUser(userId);
    res.json(cases);
  }));

  // CASES - CREATE (no inline files anymore — upload via POST /api/cases/:caseId/files afterward)
  app.post("/api/cases", ah(async (req, res) => {
    const { userId, role, title, description, patientName } = req.body;
    if (!userId || !title) { res.status(400).json({ error: "userId and title are required" }); return; }
    const newCase = await casesRepo.insert({
      id: genId("case"), title, description: description || "", patientName: patientName || undefined,
      userId, role: role || "client", createdAt: new Date().toISOString(), status: "Analyzing Uploads",
    });
    scheduleCaseEmbeddingRecompute(newCase.id);
    res.status(201).json(newCase);
  }));

  // CASES - DELETE (case_files/documents cascade automatically via FK ON DELETE CASCADE)
  app.delete("/api/cases/:id", ah(async (req, res) => {
    const deleted = await casesRepo.delete(req.params.id);
    if (!deleted) { res.status(404).json({ error: "Case not found" }); return; }
    res.json({ success: true, message: "Case and its document history permanently deleted." });
  }));

  // CASE FILES - UPLOAD (real bytes -> MinIO; technical validation before storing; OCR + content
  // validation run asynchronously after the response, so invalid junk is rejected immediately but
  // OCR of a large PDF doesn't block the HTTP request)
  app.post("/api/cases/:caseId/files", upload.single("file"), ah(async (req, res) => {
    const { caseId } = req.params;
    const { userId } = req.body;
    const file = req.file;
    if (!file) { res.status(400).json({ error: "No file uploaded (expected multipart field 'file')." }); return; }
    if (!userId) { res.status(400).json({ error: "userId is required" }); return; }

    const currentCase = await casesRepo.findById(caseId);
    if (!currentCase) { res.status(404).json({ error: "Case not found" }); return; }
    if (currentCase.userId !== userId) { res.status(403).json({ error: "You do not have access to this case." }); return; }

    const technical = validateFileTechnical(file.buffer, file.mimetype, file.size);
    if (!technical.valid) {
      res.status(400).json({ error: technical.reason });
      return;
    }

    const objectKey = await uploadCaseFile(file.buffer, caseId, file.originalname, file.mimetype);
    const fileId = genId("cfile");
    const record = await caseFilesRepo.insert({
      id: fileId, caseId, minioObjectKey: objectKey, originalFilename: file.originalname,
      mimeType: file.mimetype, sizeBytes: file.size, ocrStatus: "pending", validationStatus: "pending",
    });

    res.status(201).json(record);
    processUploadedFile(fileId, caseId, file.buffer, file.mimetype);
  }));

  // CASE FILES - LIST (used by the frontend to poll OCR/validation status)
  app.get("/api/cases/:caseId/files", ah(async (req, res) => {
    const { caseId } = req.params;
    const { userId } = req.query as { userId?: string };
    if (!userId) { res.status(400).json({ error: "userId is required" }); return; }
    const currentCase = await casesRepo.findById(caseId);
    if (!currentCase) { res.status(404).json({ error: "Case not found" }); return; }
    if (currentCase.userId !== userId) {
      const requestingUser = await usersRepo.findById(userId);
      if (!requestingUser || requestingUser.role !== "admin") { res.status(403).json({ error: "You do not have access to this case." }); return; }
    }
    const files = await caseFilesRepo.listByCase(caseId);
    res.json(files);
  }));

  // HELPER TO PROCESS AUTOMATIC 24-HOUR TIMEOUTS FOR PENDING MATCH REQUESTS
  // (moved to module-level runMatchTimeouts())

  // MATCHMAKING - GET ACTIVE MATCHES FOR LOGGED-IN USER
  app.get("/api/matchmaking/matches", ah(async (req, res) => {
    const { userId, role } = req.query as { userId?: string; role?: string };
    if (!userId) { res.status(400).json({ error: "userId is required" }); return; }
    await runMatchTimeouts();
    const requestingUser = await usersRepo.findById(userId);
    const isActualAdmin = requestingUser && requestingUser.role === "admin";
    if (isActualAdmin && role === "admin") res.json(await matchesRepo.listAll());
    else if (role === "client") res.json(await matchesRepo.listByClient(userId));
    else if (role === "lawyer") res.json(await matchesRepo.listByLawyer(userId));
    else res.json([]);
  }));

  // GET MATCHMAKING CANDIDATES — pgvector-ranked by similarity when possible, flat consent
  // filter as the guaranteed fallback (no GEMINI-style API key needed; embeddings are local).
  app.get("/api/matchmaking/candidates", ah(async (req, res) => {
    const { userId, role } = req.query as { userId?: string; role?: string };
    if (!userId || !role) { res.status(400).json({ error: "Missing required query parameters: userId, role" }); return; }
    await runMatchTimeouts();

    const requestingUser = await usersRepo.findById(userId);
    if (!requestingUser) { res.json([]); return; }
    const isExpired = requestingUser.planExpiresAt && new Date(requestingUser.planExpiresAt) < new Date();
    if (requestingUser.planId === "free" || isExpired || requestingUser.matchmakingConsent !== true) { res.json([]); return; }

    const candidateRole = role === "client" ? "lawyer" : role === "lawyer" ? "client" : null;
    if (!candidateRole) { res.json([]); return; }

    let orderedIds: string[] | null = null;
    try {
      const recentCase = await casesRepo.listMostRecentByUser(userId);
      if (recentCase) {
        const caseEmbedding = await caseEmbeddingsRepo.findByCaseId(recentCase.id);
        if (caseEmbedding) {
          orderedIds = await userEmbeddingsRepo.findCandidatesRanked(candidateRole, userId, caseEmbedding, 20);
        }
      }
    } catch (err) {
      console.error("Vector-ranked matching failed, falling back to flat filter:", err);
      orderedIds = null;
    }

    if (orderedIds && orderedIds.length > 0) {
      const users = await Promise.all(orderedIds.map((id) => usersRepo.findById(id)));
      res.json(users.filter((u): u is User => !!u));
      return;
    }

    const all = await usersRepo.list();
    res.json(all.filter((u) => u.role === candidateRole && u.matchmakingConsent === true && u.id !== userId));
  }));

  // TOGGLE MATCHMAKING CONSENT FOR USER
  app.post("/api/matchmaking/toggle-consent", ah(async (req, res) => {
    const { userId, consent } = req.body;
    if (!userId) { res.status(400).json({ error: "userId is required" }); return; }
    const user = await usersRepo.findById(userId);
    if (!user) { res.status(404).json({ error: "User profile not found." }); return; }
    const isExpired = user.planExpiresAt && new Date(user.planExpiresAt) < new Date();
    if (user.planId === "free" || isExpired) { res.status(403).json({ error: "Matchmaking is a premium subscriber feature. One-Time Pay or expired plan users do not have access to client-matching features." }); return; }
    const updated = await usersRepo.update(userId, { matchmakingConsent: consent === true });
    res.json(updated);
  }));

  // INITIATE OR RECORD A MATCH REQUEST
  app.post("/api/matchmaking/request", ah(async (req, res) => {
    const { clientId, clientName, clientEmail, lawyerId, lawyerName, lawyerEmail, initiatedBy } = req.body;
    if (!clientId || !lawyerId || !initiatedBy) { res.status(400).json({ error: "Missing required fields" }); return; }

    const senderId = initiatedBy === "client" ? clientId : lawyerId;
    const sender = await usersRepo.findById(senderId);
    if (sender) {
      const isExpired = sender.planExpiresAt && new Date(sender.planExpiresAt) < new Date();
      if (sender.planId === "free" || isExpired) { res.status(403).json({ error: "Matchmaking is a premium subscriber feature. Please upgrade or renew your plan. One-Time Pay users do not have access to client-matching features." }); return; }
    }

    let match = await matchesRepo.findByClientAndLawyer(clientId, lawyerId);
    if (match) {
      if (match.status === "denied_by_lawyer" || match.status === "denied_by_client" || match.status === "timed_out") {
        match = await matchesRepo.update(match.id, {
          status: initiatedBy === "client" ? "pending_lawyer" : "pending_client",
          initiatedBy, createdAt: new Date().toISOString(), isTimedOut: false, notified: false,
        });
      } else {
        res.status(400).json({ error: "A matchmaking request between you is already active or accepted." });
        return;
      }
    } else {
      match = await matchesRepo.insert({
        id: genId("match"), clientId, clientName, clientEmail, lawyerId, lawyerName, lawyerEmail,
        clientConsented: true, lawyerConsented: true, status: initiatedBy === "client" ? "pending_lawyer" : "pending_client",
        initiatedBy, createdAt: new Date().toISOString(), isTimedOut: false, notified: false,
      });
    }

    const recipientId = initiatedBy === "client" ? lawyerId : clientId;
    const senderName = initiatedBy === "client" ? clientName : lawyerName;
    const recipientMsg = initiatedBy === "client"
      ? `New Matchmaking Request: Client ${senderName} has requested a connection with you. Go to your Matches list to respond.`
      : `New Matchmaking Request: Lawyer ${senderName} has proposed a connection with you. Go to your Matches list to respond.`;
    await notificationsRepo.insert({ id: genId("not"), userId: recipientId, message: recipientMsg, type: "info", createdAt: new Date().toISOString(), read: false });

    res.json(match);
  }));

  // RESPOND TO MATCH REQUEST (ACCEPT / DENY)
  app.post("/api/matchmaking/respond", ah(async (req, res) => {
    const { matchId, response, role } = req.body;
    if (!matchId || !response || !role) { res.status(400).json({ error: "Missing required fields" }); return; }
    const existing = await matchesRepo.findById(matchId);
    if (!existing) { res.status(404).json({ error: "Match request not found" }); return; }

    let match: Match | null = existing;
    if (response === "accept") {
      match = await matchesRepo.update(matchId, { status: "accepted", clientConsented: true, lawyerConsented: true });
      await notificationsRepo.insert({ id: genId("not"), userId: existing.clientId, message: `Matchmaking Connection Success! Your request with ${existing.lawyerName} is now fully matched. You can contact them directly at: ${existing.lawyerEmail}`, type: "success", createdAt: new Date().toISOString(), read: false });
      await notificationsRepo.insert({ id: genId("not"), userId: existing.lawyerId, message: `Matchmaking Connection Success! Your request with ${existing.clientName} is now fully matched. You can contact them directly at: ${existing.clientEmail}`, type: "success", createdAt: new Date().toISOString(), read: false });
    } else if (response === "deny") {
      if (role === "lawyer") {
        match = await matchesRepo.update(matchId, { status: "denied_by_lawyer" });
        await notificationsRepo.insert({ id: genId("not"), userId: existing.clientId, message: `Matchmaking update: Your request to ${existing.lawyerName} is no longer applicable. Please seek another match candidate.`, type: "warning", createdAt: new Date().toISOString(), read: false });
        await notificationsRepo.insert({ id: genId("not"), userId: existing.lawyerId, message: `You declined the matchmaking request from client ${existing.clientName}.`, type: "info", createdAt: new Date().toISOString(), read: false });
      } else if (role === "client") {
        match = await matchesRepo.update(matchId, { status: "denied_by_client" });
        await notificationsRepo.insert({ id: genId("not"), userId: existing.lawyerId, message: `Matchmaking update: Your request to ${existing.clientName} was declined. Please seek another match candidate.`, type: "warning", createdAt: new Date().toISOString(), read: false });
        await notificationsRepo.insert({ id: genId("not"), userId: existing.clientId, message: `You declined the matchmaking request from lawyer ${existing.lawyerName}.`, type: "info", createdAt: new Date().toISOString(), read: false });
      }
    }
    res.json(match);
  }));

  // SIMULATE 24-HOUR MATCH TIMEOUT (DEMO)
  app.post("/api/matchmaking/simulate-timeout", ah(async (req, res) => {
    const { matchId } = req.body;
    if (!matchId) { res.status(400).json({ error: "matchId is required" }); return; }
    const existing = await matchesRepo.findById(matchId);
    if (!existing) { res.status(404).json({ error: "Match not found" }); return; }
    const match = await matchesRepo.update(matchId, { status: "timed_out", isTimedOut: true, notified: true });

    if (existing.initiatedBy === "client") {
      await notificationsRepo.insert({ id: genId("not"), userId: existing.clientId, message: `Your request to ${existing.lawyerName} is no longer applicable because it was not responded to in 24 hours. We suggest matching with another specialist.`, type: "match_timeout", createdAt: new Date().toISOString(), read: false });
      await notificationsRepo.insert({ id: genId("not"), userId: existing.lawyerId, message: `The matchmaking request from client ${existing.clientName} has expired because it was not responded to in 24 hours. Please find another match.`, type: "match_timeout", createdAt: new Date().toISOString(), read: false });
    } else {
      await notificationsRepo.insert({ id: genId("not"), userId: existing.lawyerId, message: `Your request to ${existing.clientName} is no longer applicable because it was not responded to in 24 hours. Please find another match.`, type: "match_timeout", createdAt: new Date().toISOString(), read: false });
      await notificationsRepo.insert({ id: genId("not"), userId: existing.clientId, message: `The matchmaking request from lawyer ${existing.lawyerName} has expired because it was not responded to in 24 hours.`, type: "match_timeout", createdAt: new Date().toISOString(), read: false });
    }
    res.json(match);
  }));

  // DISMISS TIMED OUT MATCH
  app.post("/api/matchmaking/dismiss", ah(async (req, res) => {
    const { matchId } = req.body;
    await matchesRepo.delete(matchId);
    res.json({ success: true });
  }));

  // CHECK IF CASE SPECIFIC DOCUMENT IS ALREADY PAID FOR BEFORE GENERATION
  app.get("/api/billing/check-payment", ah(async (req, res) => {
    const { userId, caseId, serviceType } = req.query as { userId?: string; caseId?: string; serviceType?: string };
    if (!userId || !caseId || !serviceType) { res.status(400).json({ error: "Missing required fields: userId, caseId, serviceType" }); return; }
    const user = await usersRepo.findById(userId);
    if (!user) { res.status(404).json({ error: "User profile not found." }); return; }

    if (await documentsRepo.existsForUserCaseService(userId, caseId, serviceType)) {
      res.json({ hasPaid: true, reason: "already-generated", expired: false });
      return;
    }

    const pricing = PRICING_PER_CASE[serviceType as keyof typeof PRICING_PER_CASE];
    const serviceName = pricing ? pricing.name : serviceType;
    const userPayments = await paymentsRepo.listByUser(userId);
    const hasOneTimePaid = userPayments.some((p) => p.item.includes(serviceName) && p.item.includes(caseId));
    if (hasOneTimePaid) { res.json({ hasPaid: true, reason: "one-time", expired: false }); return; }

    if (user.planId && user.planId !== "free") {
      const isExpired = user.planExpiresAt && new Date(user.planExpiresAt) < new Date();
      if (isExpired) { res.json({ hasPaid: false, reason: "expired", expired: true }); return; }
      if (user.availableCredits <= 0) { res.json({ hasPaid: false, reason: "out-of-audits", expired: false }); return; }
      res.json({ hasPaid: true, reason: "subscription", expired: false });
      return;
    }
    res.json({ hasPaid: false, reason: "unpaid", expired: false });
  }));

  // DOCUMENT GENERATION — deterministic rule-based engine (no LLM, no API key). Every dollar
  // figure traces to a real, OCR-validated line item; see src/server/documentEngine.ts.
  app.post("/api/documents/generate", ah(async (req, res) => {
    const { userId, caseId, role, serviceType, promptNotes } = req.body;
    if (!userId || !caseId || !serviceType) { res.status(400).json({ error: "userId, caseId, and serviceType are required." }); return; }

    const user = await usersRepo.findById(userId);
    if (!user) { res.status(404).json({ error: "User profile not found." }); return; }

    const pricing = PRICING_PER_CASE[serviceType as keyof typeof PRICING_PER_CASE];
    const itemCost = pricing ? pricing.price : 15;
    const serviceName = pricing ? pricing.name : serviceType;
    const isSubscription = user.planId && user.planId !== "free";

    let hasPaid = false;
    const userPayments = await paymentsRepo.listByUser(userId);
    const hasOneTimePaid = userPayments.some((p) => p.item.includes(serviceName) && p.item.includes(caseId));
    if (hasOneTimePaid) {
      hasPaid = true;
    } else if (isSubscription) {
      const isExpired = user.planExpiresAt && new Date(user.planExpiresAt) < new Date();
      if (isExpired) { res.status(402).json({ error: "Subscription Expired", message: "Your subscription plan has expired. Please upgrade/renew your subscription or choose one-time pay to generate documents." }); return; }
      if (user.availableCredits <= 0) { res.status(402).json({ error: "Out of Audits", message: "You have run out of subscription audits! Please upgrade/renew your subscription or choose one-time pay to generate documents." }); return; }
      hasPaid = true;
    }
    if (!hasPaid) { res.status(402).json({ error: "Payment Required", message: `Before generating this document, a secure Stripe one-time checkout of $${itemCost} is required.` }); return; }

    const currentCase = await casesRepo.findById(caseId);
    if (!currentCase) { res.status(404).json({ error: "Case file not found" }); return; }

    const allFiles = await caseFilesRepo.listByCase(caseId);
    const validFiles = allFiles.filter((f) => f.validationStatus === "valid");
    const hasFiles = validFiles.length > 0;
    const hasDescription = currentCase.description && currentCase.description.trim().length > 10;
    if (!hasFiles && !hasDescription) {
      res.status(400).json({ error: "Insufficient Information", message: "Unable to generate document. Please upload at least one relevant medical/billing file (and wait for it to finish processing) or provide detailed case information and notes first." });
      return;
    }

    if (isSubscription) {
      await usersRepo.update(userId, { availableCredits: Math.max(0, user.availableCredits - 1), totalCreditsUsed: user.totalCreditsUsed + 1 });
    }

    const { content } = generateDocument(serviceType, currentCase, validFiles, promptNotes);

    const isOneTimeUser = user.planId === "free";
    const planForRevenue = PLANS[user.planId];
    const revenueEarned = isOneTimeUser ? itemCost : (planForRevenue && planForRevenue.creditsPerMonth > 0 ? planForRevenue.price / planForRevenue.creditsPerMonth : itemCost);
    const apiCost: ApiCostTracker = {
      id: genId("cost"), userId, userEmail: user.email, role: user.role, serviceType: serviceName,
      cost: 0, // deterministic local engine — no external API call, no cost
      revenue: revenueEarned, createdAt: new Date().toISOString(),
    };
    await apiCostsRepo.insert(apiCost);

    const newDoc: GeneratedDocument = {
      id: genId("doc"), caseId, userId, role: role || "client", title: serviceName, serviceType,
      content, createdAt: new Date().toISOString(), downloaded: false, isLocked: false,
    };
    await documentsRepo.insert(newDoc);
    await casesRepo.updateStatus(caseId, "Completed");

    res.status(201).json(newDoc);
  }));

  // GET DOCUMENTS (ROLE PRIVACY)
  app.get("/api/documents", ah(async (req, res) => {
    const { userId, role } = req.query as { userId?: string; role?: string };
    if (!userId) { res.status(400).json({ error: "userId is required" }); return; }
    const requestingUser = await usersRepo.findById(userId);
    const isActualAdmin = requestingUser && requestingUser.role === "admin";
    const docs = (isActualAdmin && role === "admin") ? await documentsRepo.listAll() : await documentsRepo.listByUser(userId);
    res.json(docs);
  }));

  // ENFORCE ONE-TIME DOWNLOAD ACCESS LOCKING
  app.post("/api/documents/:id/lock", ah(async (req, res) => {
    const updated = await documentsRepo.updateLockState(req.params.id, { downloaded: true, isLocked: false });
    if (!updated) { res.status(404).json({ error: "Document not found" }); return; }
    res.json(updated);
  }));

  // PURCHASE RE-ACCESS FOR LOCKED DOCUMENT
  app.post("/api/documents/:id/unlock", ah(async (req, res) => {
    const { userId } = req.body;
    const docu = await documentsRepo.findById(req.params.id);
    if (!docu) { res.status(404).json({ error: "Document not found" }); return; }
    const pricing = PRICING_PER_CASE[docu.serviceType as keyof typeof PRICING_PER_CASE];
    const unlockPrice = pricing ? Math.round(pricing.price * 0.5) : 10;
    const requestingUser = await usersRepo.findById(userId);

    const payment: PaymentRecord = { id: genId("pay"), userId, userEmail: requestingUser?.email || "Client", amount: unlockPrice, item: `Unlock Re-access: ${docu.title}`, createdAt: new Date().toISOString() };
    await paymentsRepo.insert(payment);
    await notificationsRepo.notifyAdmins(`Payment Received: $${unlockPrice} from ${payment.userEmail} to unlock "${docu.title}"`);

    const updated = await documentsRepo.updateLockState(req.params.id, { isLocked: false, downloaded: false });
    res.json({ document: updated, payment });
  }));

  // RECORD DIRECT PAY-PER-CASE PAYMENT (Simulating Stripe checkout success)
  app.post("/api/billing/record-case-payment", ah(async (req, res) => {
    const { userId, userEmail, amount, item } = req.body;
    const payment: PaymentRecord = { id: genId("pay"), userId, userEmail, amount, item, createdAt: new Date().toISOString() };
    await paymentsRepo.insert(payment);
    await notificationsRepo.notifyAdmins(`Payment Received: $${amount} from ${userEmail} for "${item}"`);
    res.json(payment);
  }));

  // ADMIN PANEL METRICS
  app.get("/api/admin/metrics", ah(async (req, res) => {
    const [users, payments, documents, apiCosts] = await Promise.all([usersRepo.list(), paymentsRepo.listAll(), documentsRepo.listAll(), apiCostsRepo.listAll()]);
    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalApiCost = apiCosts.reduce((sum, c) => sum + c.cost, 0);
    const subscriptionsByType = {
      free: users.filter((u) => u.planId === "free").length,
      basic: users.filter((u) => u.planId === "basic").length,
      pro: users.filter((u) => u.planId === "pro").length,
      enterprise: users.filter((u) => u.planId === "enterprise").length,
    };
    res.json({
      totalUsers: users.length, totalRevenue, totalDocsGenerated: documents.length, totalApiCost,
      subscriptionsByType, recentPayments: payments.slice(0, 10), apiCosts: apiCosts.slice(0, 20),
    });
  }));

  app.get("/api/admin/users", ah(async (req, res) => { res.json(await usersRepo.list()); }));
  app.get("/api/admin/payments", ah(async (req, res) => { res.json(await paymentsRepo.listAll()); }));

  app.post("/api/admin/users/:id/credits", ah(async (req, res) => {
    const { credits } = req.body;
    const updated = await usersRepo.update(req.params.id, { availableCredits: Number(credits) });
    if (!updated) { res.status(404).json({ error: "User not found" }); return; }
    res.json(updated);
  }));

  app.post("/api/admin/users/:id/expire-plan", ah(async (req, res) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const updated = await usersRepo.update(req.params.id, { planExpiresAt: yesterday.toISOString() });
    if (!updated) { res.status(404).json({ error: "User not found" }); return; }
    res.json(updated);
  }));

  app.post("/api/admin/users/:id/block", ah(async (req, res) => {
    const user = await usersRepo.findById(req.params.id);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    if (user.email.toLowerCase() === "maheenu2317@gmail.com") { res.status(403).json({ error: "The original system administrator cannot be blocked." }); return; }
    const updated = await usersRepo.update(req.params.id, { isBlocked: !user.isBlocked });
    res.json(updated);
  }));

  app.post("/api/admin/add-admin", ah(async (req, res) => {
    const { name, email } = req.body;
    if (!name || !email) { res.status(400).json({ error: "Name and email are required" }); return; }
    const existing = await usersRepo.findByEmail(email);
    if (existing) {
      const updated = await usersRepo.update(existing.id, { role: "admin" });
      res.json(updated);
      return;
    }
    const newAdmin: User = { id: genId("usr"), email, name, role: "admin", password: bcrypt.hashSync(Math.random().toString(36), 10), planId: "pro", availableCredits: 99999, totalCreditsUsed: 0, createdAt: new Date().toISOString(), acceptedTerms: true, matchmakingConsent: false, isBlocked: false } as User;
    await usersRepo.insert(newAdmin);
    res.status(201).json(newAdmin);
  }));

  app.delete("/api/admin/users/:id", ah(async (req, res) => {
    const user = await usersRepo.findById(req.params.id);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    if (user.email.toLowerCase() === "maheenu2317@gmail.com") { res.status(403).json({ error: "The original system administrator cannot be terminated." }); return; }
    await usersRepo.delete(req.params.id); // cascades cases/documents/matches/notifications/payments/api_costs
    res.json({ success: true, message: "User terminated successfully." });
  }));

  app.get("/api/notifications/:userId", ah(async (req, res) => { res.json(await notificationsRepo.listByUser(req.params.userId)); }));
  app.post("/api/notifications/:id/read", ah(async (req, res) => { await notificationsRepo.markRead(req.params.id); res.json({ success: true }); }));

  // ADMIN DATABASE EXPLORER — Postgres-backed, shaped identically to the old sqlite response
  // so src/components/DatabaseExplorer.tsx needs no changes.
  app.get("/api/admin/database/tables", ah(async (req, res) => {
    const { rows: tableRows } = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name"
    );
    const tables = await Promise.all(tableRows.map(async (t) => {
      const tableName = t.table_name;
      const countRes = await pool.query(`SELECT COUNT(*) FROM "${tableName}"`);
      const colRes = await pool.query(
        `SELECT c.ordinal_position, c.column_name, c.data_type, c.is_nullable, c.column_default,
                (pk.column_name IS NOT NULL) AS is_pk
         FROM information_schema.columns c
         LEFT JOIN (
           SELECT kcu.column_name FROM information_schema.table_constraints tc
           JOIN information_schema.key_column_usage kcu
             ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
           WHERE tc.table_schema = 'public' AND tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'
         ) pk ON pk.column_name = c.column_name
         WHERE c.table_schema = 'public' AND c.table_name = $1
         ORDER BY c.ordinal_position`,
        [tableName]
      );
      const columns = colRes.rows.map((c) => ({
        cid: c.ordinal_position - 1, name: c.column_name, type: c.data_type,
        notnull: c.is_nullable === "NO" ? 1 : 0, dflt_value: c.column_default, pk: c.is_pk ? 1 : 0,
      }));
      return { name: tableName, rowCount: Number(countRes.rows[0].count), columns };
    }));
    res.json({ tables });
  }));

  // SELECT/WITH-only, enforced now that real FK cascades make a stray write far more destructive.
  app.post("/api/admin/database/query", ah(async (req, res) => {
    const { query, tableName } = req.body;
    let sql = query;
    if (!sql && tableName) sql = `SELECT * FROM "${tableName}" LIMIT 100`;
    if (!sql) { res.status(400).json({ error: "SQL query or tableName is required." }); return; }
    if (!/^\s*(SELECT|WITH)\b/i.test(sql)) {
      res.status(400).json({ error: "Only SELECT/WITH read queries are permitted from the admin console." });
      return;
    }
    // Reject stacked statements (e.g. "SELECT 1; DROP TABLE users;--") — a semicolon is only
    // allowed, if at all, as the very last non-whitespace character of the query.
    const trimmed = sql.trim();
    const bodyBeforeTrailingSemicolon = trimmed.endsWith(";") ? trimmed.slice(0, -1) : trimmed;
    if (bodyBeforeTrailingSemicolon.includes(";")) {
      res.status(400).json({ error: "Only a single SQL statement is permitted from the admin console." });
      return;
    }
    try {
      // Passing an explicit (empty) values array forces node-postgres to use the extended query
      // protocol, which structurally cannot execute more than one statement per call — a second
      // layer of defense beyond the semicolon check above.
      const result = await pool.query(sql, []);
      const columns = result.fields.map((f) => f.name);
      res.json({ columns, rows: result.rows, rowCount: result.rowCount, sql });
    } catch (e: any) {
      res.status(400).json({ error: e.message || "SQL Execution Error" });
    }
  }));

  app.get("/api/admin/database/export", ah(async (req, res) => {
    const [users, cases, caseFiles, documents, matches, notifications, payments, apiCosts] = await Promise.all([
      usersRepo.list(), casesRepo.listAll(),
      pool.query("SELECT * FROM case_files").then((r) => r.rows),
      documentsRepo.listAll(), matchesRepo.listAll(),
      pool.query("SELECT * FROM notifications").then((r) => r.rows),
      paymentsRepo.listAll(), apiCostsRepo.listAll(),
    ]);
    const data = { users, cases, caseFiles, documents, matches, notifications, payments, apiCosts };
    res.setHeader("Content-Disposition", 'attachment; filename="billslayer_database_dump.json"');
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(data, null, 2));
  }));

  // Vite integration middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => { res.sendFile(path.join(distPath, "index.html")); });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Fatal error during server startup:", err);
  process.exit(1);
});
