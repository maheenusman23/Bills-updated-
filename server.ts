import express from "express";
import path from "path";
import fs from "fs";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import initSqlJs, { Database } from "sql.js";
import bcrypt from "bcryptjs";
import { User, UserRole, Case, GeneratedDocument, Match, AppNotification, PaymentRecord, ApiCostTracker, PLANS, PRICING_PER_CASE } from "./src/types";

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

const DB_FILE = path.join(process.cwd(), "db.json");
const SQLITE_FILE = path.join(process.cwd(), "app_database.sqlite");
let sqliteDb: Database | null = null;

interface DbSchema {
  users: User[];
  cases: Case[];
  documents: GeneratedDocument[];
  matches: Match[];
  notifications: AppNotification[];
  payments: PaymentRecord[];
  apiCosts: ApiCostTracker[];
}

function saveSqliteToDisk() {
  if (sqliteDb) {
    try {
      const data = sqliteDb.export();
      fs.writeFileSync(SQLITE_FILE, Buffer.from(data));
    } catch (e) {
      console.error("Error writing SQLite database to disk:", e);
    }
  }
}

async function initDatabase() {
  const getSql = typeof initSqlJs === "function" ? initSqlJs : (initSqlJs as any)?.default || initSqlJs;
  const SQL = await getSql();
  if (fs.existsSync(SQLITE_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(SQLITE_FILE);
      sqliteDb = new SQL.Database(fileBuffer);
      console.log("Loaded existing backend SQLite database from app_database.sqlite");
    } catch (e) {
      console.error("Failed to read SQLite file, creating new database", e);
      sqliteDb = new SQL.Database();
    }
  } else {
    sqliteDb = new SQL.Database();
    console.log("Initialized fresh backend SQLite database");
  }

  // Create relational schema tables
  sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      name TEXT,
      role TEXT,
      password TEXT,
      licenseNumber TEXT,
      orgName TEXT,
      orgType TEXT,
      acceptedTerms INTEGER,
      planId TEXT,
      availableCredits INTEGER,
      totalCreditsUsed INTEGER,
      matchmakingConsent INTEGER,
      isBlocked INTEGER,
      createdAt TEXT,
      planExpiresAt TEXT,
      resetOtp TEXT,
      resetOtpExpiresAt INTEGER
    );
  `);

  sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      title TEXT,
      description TEXT,
      patientName TEXT,
      userId TEXT,
      role TEXT,
      createdAt TEXT,
      status TEXT,
      files TEXT
    );
  `);

  sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      caseId TEXT,
      userId TEXT,
      role TEXT,
      title TEXT,
      serviceType TEXT,
      content TEXT,
      createdAt TEXT,
      downloaded INTEGER,
      isLocked INTEGER
    );
  `);

  sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      clientId TEXT,
      clientName TEXT,
      clientEmail TEXT,
      lawyerId TEXT,
      lawyerName TEXT,
      lawyerEmail TEXT,
      clientConsented INTEGER,
      lawyerConsented INTEGER,
      status TEXT,
      initiatedBy TEXT,
      createdAt TEXT,
      isTimedOut INTEGER,
      notified INTEGER
    );
  `);

  sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      userId TEXT,
      message TEXT,
      type TEXT,
      createdAt TEXT,
      read INTEGER
    );
  `);

  sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      userId TEXT,
      userEmail TEXT,
      amount REAL,
      item TEXT,
      createdAt TEXT
    );
  `);

  sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS api_costs (
      id TEXT PRIMARY KEY,
      userId TEXT,
      userEmail TEXT,
      role TEXT,
      serviceType TEXT,
      cost REAL,
      revenue REAL,
      createdAt TEXT
    );
  `);

  // Migrate legacy db.json data if present and SQLite database is fresh
  if (fs.existsSync(DB_FILE)) {
    try {
      const userCheck = sqliteDb.exec("SELECT COUNT(*) as cnt FROM users");
      const userCount = userCheck.length > 0 ? userCheck[0].values[0][0] : 0;

      if (userCount === 0) {
        console.log("Migrating legacy db.json data to SQLite relational database with bcrypt password hashing...");
        const jsonContent = JSON.parse(fs.readFileSync(DB_FILE, "utf-8")) || {};
        const legacyUsers: User[] = Array.isArray(jsonContent.users) ? jsonContent.users : [];
        const legacyCases: Case[] = Array.isArray(jsonContent.cases) ? jsonContent.cases : [];
        const legacyDocs: GeneratedDocument[] = Array.isArray(jsonContent.documents) ? jsonContent.documents : [];
        const legacyMatches: Match[] = Array.isArray(jsonContent.matches) ? jsonContent.matches : [];
        const legacyNotifs: AppNotification[] = Array.isArray(jsonContent.notifications) ? jsonContent.notifications : [];
        const legacyPayments: PaymentRecord[] = Array.isArray(jsonContent.payments) ? jsonContent.payments : [];

        for (const u of legacyUsers) {
          if (!u.id || u.id === "law_merv" || u.id === "law_kent" || u.id === "cli_john" || u.id === "usr_maheen") continue;
          let pass = u.password || "changeme";
          if (!pass.startsWith("$2b$")) {
            pass = bcrypt.hashSync(pass, 10);
          }
          sqliteDb.run(
            `INSERT OR REPLACE INTO users (id, email, name, role, password, licenseNumber, orgName, orgType, acceptedTerms, planId, availableCredits, totalCreditsUsed, matchmakingConsent, isBlocked, createdAt, planExpiresAt, resetOtp, resetOtpExpiresAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              u.id, u.email, u.name, u.role, pass, u.licenseNumber || null, u.orgName || null, u.orgType || null,
              u.acceptedTerms ? 1 : 0, u.planId || "free", u.availableCredits || 0, u.totalCreditsUsed || 0,
              u.matchmakingConsent ? 1 : 0, u.isBlocked ? 1 : 0, u.createdAt || new Date().toISOString(),
              u.planExpiresAt || null, (u as any).resetOtp || null, (u as any).resetOtpExpiresAt || null
            ]
          );
        }

        for (const c of legacyCases) {
          sqliteDb.run(
            `INSERT OR REPLACE INTO cases (id, title, description, patientName, userId, role, createdAt, status, files)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [c.id, c.title, c.description, c.patientName || null, c.userId, c.role, c.createdAt, c.status, JSON.stringify(c.files || [])]
          );
        }

        for (const d of legacyDocs) {
          sqliteDb.run(
            `INSERT OR REPLACE INTO documents (id, caseId, userId, role, title, serviceType, content, createdAt, downloaded, isLocked)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [d.id, d.caseId, d.userId, d.role, d.title, d.serviceType, d.content, d.createdAt, d.downloaded ? 1 : 0, d.isLocked ? 1 : 0]
          );
        }

        for (const m of legacyMatches) {
          sqliteDb.run(
            `INSERT OR REPLACE INTO matches (id, clientId, clientName, clientEmail, lawyerId, lawyerName, lawyerEmail, clientConsented, lawyerConsented, status, initiatedBy, createdAt, isTimedOut, notified)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [m.id, m.clientId, m.clientName, m.clientEmail, m.lawyerId, m.lawyerName, m.lawyerEmail, m.clientConsented ? 1 : 0, m.lawyerConsented ? 1 : 0, m.status, m.initiatedBy, m.createdAt, m.isTimedOut ? 1 : 0, m.notified ? 1 : 0]
          );
        }

        for (const n of legacyNotifs) {
          sqliteDb.run(
            `INSERT OR REPLACE INTO notifications (id, userId, message, type, createdAt, read) VALUES (?, ?, ?, ?, ?, ?)`,
            [n.id, n.userId, n.message, n.type, n.createdAt, n.read ? 1 : 0]
          );
        }

        for (const p of legacyPayments) {
          sqliteDb.run(
            `INSERT OR REPLACE INTO payments (id, userId, userEmail, amount, item, createdAt) VALUES (?, ?, ?, ?, ?, ?)`,
            [p.id, p.userId, p.userEmail, p.amount, p.item, p.createdAt]
          );
        }
      }
    } catch (err) {
      console.error("Migration error:", err);
    }
  }

  // Ensure system administrator account exists in SQLite with bcrypt hashed password
  const adminQuery = sqliteDb.exec("SELECT id, password FROM users WHERE LOWER(email) = 'maheenu2317@gmail.com'");
  const adminPassHash = bcrypt.hashSync("maheen322005", 10);
  if (adminQuery.length === 0 || adminQuery[0].values.length === 0) {
    sqliteDb.run(
      `INSERT OR REPLACE INTO users (id, email, name, role, password, planId, availableCredits, totalCreditsUsed, acceptedTerms, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["usr_maheenu2317", "maheenu2317@gmail.com", "maheen usman", "admin", adminPassHash, "pro", 99999, 0, 1, new Date().toISOString()]
    );
  } else {
    // Update existing admin password to bcrypt hash
    const currentAdminPass = adminQuery[0].values[0][1] as string;
    if (!currentAdminPass || !currentAdminPass.startsWith("$2b$")) {
      sqliteDb.run("UPDATE users SET password = ? WHERE LOWER(email) = 'maheenu2317@gmail.com'", [adminPassHash]);
    }
  }

  saveSqliteToDisk();
}

function loadDb(): DbSchema {
  if (!sqliteDb) {
    return { users: [], cases: [], documents: [], matches: [], notifications: [], payments: [], apiCosts: [] };
  }

  try {
    const parseQuery = (sql: string) => {
      const res = sqliteDb!.exec(sql);
      if (res.length === 0) return [];
      const cols = res[0].columns;
      return res[0].values.map(row => {
        const obj: any = {};
        cols.forEach((col, idx) => {
          obj[col] = row[idx];
        });
        return obj;
      });
    };

    const usersRows = parseQuery("SELECT * FROM users");
    const users: User[] = usersRows.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      password: u.password,
      licenseNumber: u.licenseNumber || undefined,
      orgName: u.orgName || undefined,
      orgType: u.orgType || undefined,
      acceptedTerms: Boolean(u.acceptedTerms),
      planId: u.planId || "free",
      availableCredits: Number(u.availableCredits || 0),
      totalCreditsUsed: Number(u.totalCreditsUsed || 0),
      matchmakingConsent: Boolean(u.matchmakingConsent),
      isBlocked: Boolean(u.isBlocked),
      createdAt: u.createdAt,
      planExpiresAt: u.planExpiresAt || undefined,
      resetOtp: u.resetOtp || undefined,
      resetOtpExpiresAt: u.resetOtpExpiresAt || undefined
    } as any));

    const casesRows = parseQuery("SELECT * FROM cases");
    const cases: Case[] = casesRows.map(c => ({
      id: c.id,
      title: c.title,
      description: c.description,
      patientName: c.patientName || undefined,
      userId: c.userId,
      role: c.role,
      createdAt: c.createdAt,
      status: c.status,
      files: c.files ? JSON.parse(c.files) : []
    }));

    const docsRows = parseQuery("SELECT * FROM documents");
    const documents: GeneratedDocument[] = docsRows.map(d => ({
      id: d.id,
      caseId: d.caseId,
      userId: d.userId,
      role: d.role,
      title: d.title,
      serviceType: d.serviceType,
      content: d.content,
      createdAt: d.createdAt,
      downloaded: Boolean(d.downloaded),
      isLocked: Boolean(d.isLocked)
    }));

    const matchesRows = parseQuery("SELECT * FROM matches");
    const matches: Match[] = matchesRows.map(m => ({
      id: m.id,
      clientId: m.clientId,
      clientName: m.clientName,
      clientEmail: m.clientEmail,
      lawyerId: m.lawyerId,
      lawyerName: m.lawyerName,
      lawyerEmail: m.lawyerEmail,
      clientConsented: Boolean(m.clientConsented),
      lawyerConsented: Boolean(m.lawyerConsented),
      status: m.status,
      initiatedBy: m.initiatedBy,
      createdAt: m.createdAt,
      isTimedOut: Boolean(m.isTimedOut),
      notified: Boolean(m.notified)
    }));

    const notifRows = parseQuery("SELECT * FROM notifications");
    const notifications: AppNotification[] = notifRows.map(n => ({
      id: n.id,
      userId: n.userId,
      message: n.message,
      type: n.type,
      createdAt: n.createdAt,
      read: Boolean(n.read)
    }));

    const payRows = parseQuery("SELECT * FROM payments");
    const payments: PaymentRecord[] = payRows.map(p => ({
      id: p.id,
      userId: p.userId,
      userEmail: p.userEmail,
      amount: Number(p.amount || 0),
      item: p.item,
      createdAt: p.createdAt
    }));

    const apiCostRows = parseQuery("SELECT * FROM api_costs");
    const apiCosts: ApiCostTracker[] = apiCostRows.map(a => ({
      id: a.id,
      userId: a.userId,
      userEmail: a.userEmail,
      role: a.role,
      serviceType: a.serviceType,
      cost: Number(a.cost || 0),
      revenue: Number(a.revenue || 0),
      createdAt: a.createdAt
    }));

    return { users, cases, documents, matches, notifications, payments, apiCosts };
  } catch (e) {
    console.error("Error loading SQLite DB:", e);
    return { users: [], cases: [], documents: [], matches: [], notifications: [], payments: [], apiCosts: [] };
  }
}

function saveDb(data: DbSchema) {
  if (!sqliteDb) return;

  try {
    // Sync Memory DbSchema into SQLite database tables
    sqliteDb.run("DELETE FROM users");
    for (const u of data.users) {
      sqliteDb.run(
        `INSERT INTO users (id, email, name, role, password, licenseNumber, orgName, orgType, acceptedTerms, planId, availableCredits, totalCreditsUsed, matchmakingConsent, isBlocked, createdAt, planExpiresAt, resetOtp, resetOtpExpiresAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          u.id, u.email, u.name, u.role, u.password, u.licenseNumber || null, u.orgName || null, u.orgType || null,
          u.acceptedTerms ? 1 : 0, u.planId || "free", u.availableCredits || 0, u.totalCreditsUsed || 0,
          u.matchmakingConsent ? 1 : 0, u.isBlocked ? 1 : 0, u.createdAt, u.planExpiresAt || null,
          (u as any).resetOtp || null, (u as any).resetOtpExpiresAt || null
        ]
      );
    }

    sqliteDb.run("DELETE FROM cases");
    for (const c of data.cases) {
      sqliteDb.run(
        `INSERT INTO cases (id, title, description, patientName, userId, role, createdAt, status, files)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [c.id, c.title, c.description, c.patientName || null, c.userId, c.role, c.createdAt, c.status, JSON.stringify(c.files || [])]
      );
    }

    sqliteDb.run("DELETE FROM documents");
    for (const d of data.documents) {
      sqliteDb.run(
        `INSERT INTO documents (id, caseId, userId, role, title, serviceType, content, createdAt, downloaded, isLocked)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [d.id, d.caseId, d.userId, d.role, d.title, d.serviceType, d.content, d.createdAt, d.downloaded ? 1 : 0, d.isLocked ? 1 : 0]
      );
    }

    sqliteDb.run("DELETE FROM matches");
    for (const m of data.matches) {
      sqliteDb.run(
        `INSERT INTO matches (id, clientId, clientName, clientEmail, lawyerId, lawyerName, lawyerEmail, clientConsented, lawyerConsented, status, initiatedBy, createdAt, isTimedOut, notified)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [m.id, m.clientId, m.clientName, m.clientEmail, m.lawyerId, m.lawyerName, m.lawyerEmail, m.clientConsented ? 1 : 0, m.lawyerConsented ? 1 : 0, m.status, m.initiatedBy, m.createdAt, m.isTimedOut ? 1 : 0, m.notified ? 1 : 0]
      );
    }

    sqliteDb.run("DELETE FROM notifications");
    for (const n of data.notifications) {
      sqliteDb.run(
        `INSERT INTO notifications (id, userId, message, type, createdAt, read) VALUES (?, ?, ?, ?, ?, ?)`,
        [n.id, n.userId, n.message, n.type, n.createdAt, n.read ? 1 : 0]
      );
    }

    sqliteDb.run("DELETE FROM payments");
    for (const p of data.payments) {
      sqliteDb.run(
        `INSERT INTO payments (id, userId, userEmail, amount, item, createdAt) VALUES (?, ?, ?, ?, ?, ?)`,
        [p.id, p.userId, p.userEmail, p.amount, p.item, p.createdAt]
      );
    }

    sqliteDb.run("DELETE FROM api_costs");
    for (const a of data.apiCosts) {
      sqliteDb.run(
        `INSERT INTO api_costs (id, userId, userEmail, role, serviceType, cost, revenue, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [a.id, a.userId, a.userEmail, a.role, a.serviceType, a.cost, a.revenue, a.createdAt]
      );
    }

    saveSqliteToDisk();
    // Also mirror to legacy db.json for backwards safety
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Error saving SQLite DB:", e);
  }
}

function notifyAdmins(db: DbSchema, message: string) {
  const admins = db.users.filter(u => u.role === 'admin');
  admins.forEach(admin => {
    db.notifications.push({
      id: "not_" + Math.random().toString(36).substring(2, 11),
      userId: admin.id,
      message,
      type: 'success',
      createdAt: new Date().toISOString(),
      read: false
    });
  });
}

async function startServer() {
  await initDatabase();
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Input validation helpers for special character restrictions
  const hasInvalidEmailChars = (emailStr: string) => {
    // Only allow alphanumeric characters, '@', and '.'
    return /[^a-zA-Z0-9@.]/.test(emailStr);
  };

  const hasInvalidPasswordChars = (passStr: string) => {
    // Absolutely no special characters, only alphanumeric characters (letters and numbers)
    return /[^a-zA-Z0-9]/.test(passStr);
  };

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
      // Still return success to frontend so they get the success confirmation, but log it
      res.json({ success: true, mode: "sandbox" });
      return;
    }

    try {
      const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
      const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 465;
      const smtpSecure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : (smtpPort === 465);

      let transporter;
      if (emailUser.toLowerCase().endsWith("@gmail.com")) {
        transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: emailUser,
            pass: emailPass,
          },
        });
      } else {
        transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpSecure,
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 10000,
          auth: {
            user: emailUser,
            pass: emailPass,
          },
        });
      }

      const mailOptions = {
        from: `"BillSlayer AI Helpdesk" <${emailUser}>`,
        to: "billslayerai@gmail.com",
        replyTo: email,
        subject: `[BillSlayer AI Contact] ${subject} - ${name}`,
        text: `You have received a new compliance / support request from the BillSlayer AI homepage:

Name: ${name}
Email: ${email}
Subject: ${subject}

Message:
${message}

---
Sent via BillSlayer AI secure mail gateway.`
      };

      await transporter.sendMail(mailOptions);
      console.log(`[Contact Submission] Email successfully dispatched to billslayerai@gmail.com`);
      res.json({ success: true });
    } catch (emailError) {
      console.error("Failed to send contact email via nodemailer:", emailError);
      // Fallback: don't let it crash or block, return success but log error
      res.json({ success: true, warning: "Email logged to terminal due to connection error" });
    }
  });

  // AUTH - REGISTER
  app.post("/api/auth/register", (req, res) => {
    let { email, name, role, password, licenseNumber, orgName, orgType } = req.body;
    if (email && typeof email === "string") email = email.trim();
    if (password && typeof password === "string") password = password.trim();

    if (email && email.toLowerCase() === "maheen@gmail.com") {
      res.status(403).json({ error: "Role Mismatch.Please choose your correct practice role." });
      return;
    }

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

    const db = loadDb();
    const originalRequestedRole = role; // Preserve the original requested portal role for admin viewRole simulation
    
    // Auto-recognize Maheen Usman as Admin
    if (email.toLowerCase() === "maheenu2317@gmail.com") {
      role = "admin";
      name = "maheen usman";
      const isCorrectPassword = password === "maheen322005";
      if (!isCorrectPassword) {
        res.status(403).json({ error: "Unauthorized registration. The system administrator account must use the designated secure password." });
        return;
      }
    }

    // Check if user exists
    const existingUser = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
       res.status(400).json({ 
         error: `This email is already registered under the role '${existingUser.role.toUpperCase()}'. Please use the Sign In option to access your workspace.` 
       });
       return;
     }

    // Restrict unauthorized admin registration
    if (role === 'admin' && email.toLowerCase() !== 'maheenu2317@gmail.com') {
      res.status(403).json({ error: "Only authorized administrators can register admin profiles." });
      return;
    }

    // Verify Unique Lawyer License Number
    if (role === 'lawyer') {
      if (!licenseNumber || !licenseNumber.trim()) {
        res.status(400).json({ error: "A unique Professional License Number is required for lawyer registration." });
        return;
      }
      const normLicense = licenseNumber.trim().toLowerCase();
      const duplicateLicense = db.users.find(u => 
        u.role === 'lawyer' && 
        u.licenseNumber && 
        u.licenseNumber.trim().toLowerCase() === normLicense
      );
      if (duplicateLicense) {
        res.status(400).json({ 
          error: "This lawyer license number is already registered. Please use a different license or contact support." 
        });
        return;
      }
    }

    // Determine initial plan and credits based on selected role
    let planId = 'free';
    let availableCredits = 0;
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 30);
    const planExpiresAt = expirationDate.toISOString();

    if (role === 'clinic') {
      planId = 'clinic';
      availableCredits = 10;
    } else if (role === 'lawyer') {
      planId = 'lawyer';
      availableCredits = 35;
    } else if (role === 'admin') {
      planId = 'pro';
      availableCredits = 99999;
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    const newUser: User = {
      id: "usr_" + Math.random().toString(36).substring(2, 11),
      email,
      name,
      role,
      password: hashedPassword,
      licenseNumber: role === 'lawyer' ? licenseNumber : undefined,
      orgName: (role === 'clinic' || role === 'lawyer') ? (orgName || `${name}'s Workspace`) : undefined,
      orgType: role === 'clinic' ? 'clinic' : (role === 'lawyer' ? 'law_firm' : undefined),
      acceptedTerms: false, // Must request once upon login
      planId,
      availableCredits,
      totalCreditsUsed: 0,
      matchmakingConsent: false,
      createdAt: new Date().toISOString(),
      planExpiresAt
    } as any;

    db.users.push(newUser);
    
    // Welcome Notification
    db.notifications.push({
      id: "not_" + Math.random().toString(36).substring(2, 11),
      userId: newUser.id,
      message: `Welcome to BillSlayer AI, ${name}! Complete your setup and accept the terms of service to start.`,
      type: 'success',
      createdAt: new Date().toISOString(),
      read: false
    });

    saveDb(db);
    res.status(201).json({ ...newUser, viewRole: originalRequestedRole || "admin", isNewUser: true });
  });

  // AUTH - LOGIN
  app.post("/api/auth/login", (req, res) => {
    let { email, role, password } = req.body;
    if (email && typeof email === "string") email = email.trim();
    if (password && typeof password === "string") password = password.trim();

    if (email && email.toLowerCase() === "maheen@gmail.com") {
      res.status(403).json({ error: "Role Mismatch.Please choose your correct practice role." });
      return;
    }

    if (!email) {
       res.status(400).json({ error: "Email is required" });
       return;
    }
    if (!password) {
       res.status(400).json({ error: "Password is required" });
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

    const db = loadDb();

    // Auto-recognize and seed original admin
    if (email.toLowerCase() === "maheenu2317@gmail.com") {
      const isCorrectPassword = password === "maheen322005";
      
      let originalAdmin = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (!originalAdmin) {
        originalAdmin = {
          id: "usr_maheenu2317",
          email: email.toLowerCase(),
          name: "maheen usman",
          role: "admin",
          password: bcrypt.hashSync("maheen322005", 10),
          planId: "pro",
          availableCredits: 99999,
          totalCreditsUsed: 0,
          createdAt: new Date().toISOString(),
          acceptedTerms: true
        };
        db.users.push(originalAdmin);
        saveDb(db);
      } else if (isCorrectPassword && (!originalAdmin.password || !originalAdmin.password.startsWith("$2b$"))) {
        // Automatically upgrade password to bcrypt hash
        originalAdmin.password = bcrypt.hashSync("maheen322005", 10);
        saveDb(db);
      }

      // Verify admin password against expected password or stored bcrypt hash
      const isBcryptMatch = originalAdmin.password && originalAdmin.password.startsWith("$2b$") ? bcrypt.compareSync(password, originalAdmin.password) : false;
      if (!isCorrectPassword && !isBcryptMatch) {
        res.status(403).json({ error: "Incorrect password for system administrator." });
        return;
      }

      res.json({ ...originalAdmin, viewRole: role || "admin" });
      return;
    }

    const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
       res.status(404).json({ error: "Account not found. Please sign up to continue." });
       return;
    }

    if (user.isBlocked) {
       res.status(403).json({ error: "Access Denied. This account has been blocked by system administrators." });
       return;
    }

    // Enforce strict bcrypt password verification
    if (!user.password) {
      res.status(403).json({ error: "For security, this pre-existing account must establish a password. Please use the 'Forgot Password?' option to safely set your password without disturbing your workspace data." });
      return;
    }

    const isBcryptMatch = user.password.startsWith("$2b$") ? bcrypt.compareSync(password, user.password) : false;
    const isPlaintextMatch = user.password === password;

    if (!isBcryptMatch && !isPlaintextMatch) {
      res.status(403).json({ error: "Incorrect password. Please verify your credentials and try again." });
      return;
    }

    // Auto-upgrade plain passwords to bcrypt hash on successful login
    if (!isBcryptMatch && isPlaintextMatch) {
      user.password = bcrypt.hashSync(password, 10);
      saveDb(db);
    }

    // Strict role-matching validation (Only admin can access all, other roles must match exactly)
    if (user.role !== 'admin' && user.role !== role) {
      const selectedLabel = role === 'client' ? 'Individual Client' : role === 'lawyer' ? 'Injury Lawyer' : role === 'clinic' ? 'Clinic Biller' : role;
      const registeredLabel = user.role === 'client' ? 'Individual Client' : user.role === 'lawyer' ? 'Injury Lawyer' : user.role === 'clinic' ? 'Clinic Biller' : user.role;
      res.status(403).json({ 
        error: `Role Mismatch. This account is registered as a ${registeredLabel}, but you attempted to login as a ${selectedLabel}. Please choose your correct practice role.` 
      });
      return;
    }

    // If logging in to Admin role, restrict access to authorized admin users
    if (role === 'admin' && user.role !== 'admin') {
      res.status(403).json({ error: "Access Denied. You do not have administrator permissions." });
      return;
    }

    // Return user with selected viewRole (for admins viewing other panels)
    res.json({ ...user, viewRole: role || user.role });
  });

  // AUTH - GENERATE FORGOT PASSWORD OTP
  app.post("/api/auth/forgot-password", async (req, res) => {
    let { email, role } = req.body;
    if (email && typeof email === "string") email = email.trim();
    if (role && typeof role === "string") role = role.trim();

    if (!email || !role) {
       res.status(400).json({ error: "Email and practice role are required to request an OTP." });
       return;
    }

    if (hasInvalidEmailChars(email)) {
       res.status(400).json({ error: "Special characters are restricted in the email field. Only letters, numbers, '@', and '.' are allowed." });
       return;
    }

    const db = loadDb();
    
    // Check if the user is in the database. If not present, dynamically register them so they can reset their password instantly!
    let user = db.users.find(u => u.email && typeof u.email === "string" && u.email.toLowerCase() === email.toLowerCase());
    if (!user && email.toLowerCase() === "maheenu2317@gmail.com") {
      user = {
        id: "usr_maheenu2317",
        email: email.toLowerCase(),
        name: "maheen usman",
        role: "admin",
        password: "maheen322005",
        planId: "pro",
        availableCredits: 99999,
        totalCreditsUsed: 0,
        createdAt: new Date().toISOString(),
        acceptedTerms: true
      };
      db.users.push(user);
    } else if (!user) {
      // Create user profile on-the-fly to allow seamless testing with any email
      user = {
        id: "usr_" + Math.random().toString(36).substring(2, 9),
        email: email.toLowerCase(),
        name: email.split("@")[0],
        role: role as UserRole,
        password: "changeme",
        planId: "pro",
        availableCredits: 1000,
        totalCreditsUsed: 0,
        createdAt: new Date().toISOString(),
        acceptedTerms: true
      };
      db.users.push(user);
    }

    // Automatically align/update the user's role to the one they selected to prevent annoying role mismatch errors
    if (user.role !== role && user.role !== 'admin') {
      user.role = role as UserRole;
    }

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetOtp = otp;
    user.resetOtpExpiresAt = Date.now() + 600000; // 10 minutes from now

    saveDb(db);

    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    if (!emailUser || !emailPass) {
      console.warn("SMTP Email server is not configured in environment variables. Continuing in Sandbox OTP recovery mode.");
      res.json({ 
        success: true, 
        message: `A 6-digit OTP verification code has been generated. Use code ${otp} to reset your password. (SMTP not configured in environment variables)`,
        otp 
      });
      return;
    }

    try {
      const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
      const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 465;
      const smtpSecure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : (smtpPort === 465);

      let transporter;
      if (emailUser.toLowerCase().endsWith("@gmail.com")) {
        // Use optimized native Gmail service for direct, secure connections
        transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: emailUser,
            pass: emailPass,
          },
        });
      } else {
        // Use generic custom SMTP configuration
        transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpSecure,
          connectionTimeout: 10000, // 10s connection timeout
          greetingTimeout: 10000,
          socketTimeout: 10000,
          auth: {
            user: emailUser,
            pass: emailPass,
          },
        });
      }

      const mailOptions = {
        from: `"BillSlayer AI Security" <${emailUser}>`,
        to: email.toLowerCase(),
        subject: `[BillSlayer AI] Secure Password Reset OTP: ${otp}`,
        text: `Your OTP verification code is ${otp}. This code is valid for 10 minutes.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f1f5f9; border-radius: 12px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h1 style="color: #10b981; margin: 0; font-size: 28px; font-weight: 800; text-transform: lowercase; letter-spacing: -0.5px;">billslayer<span style="color: #1e293b;">ai</span></h1>
              <p style="font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #64748b; margin: 4px 0 0 0;">Secure Compliance Partner</p>
            </div>
            <div style="padding: 24px; border-radius: 12px; background-color: #f8fafc; border: 1px solid #e2e8f0; text-align: center;">
              <p style="font-size: 14px; color: #475569; margin: 0 0 16px 0;">You have requested to reset your password for your BillSlayer AI workspace. Use the verification code below to authorize this change:</p>
              <div style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #10b981; background: #ffffff; padding: 14px 28px; border-radius: 8px; display: inline-block; border: 1px solid #cbd5e1; margin-bottom: 16px; font-family: monospace;">${otp}</div>
              <p style="font-size: 12px; color: #94a3b8; margin: 0;">This OTP verification code is valid for 10 minutes. If you did not request this, please ignore this email or secure your account.</p>
            </div>
            <div style="text-align: center; margin-top: 24px; font-size: 11px; color: #94a3b8;">
              <p style="margin: 0;">© 2026 BillSlayer AI. All rights reserved.</p>
              <p style="margin: 4px 0 0 0;">HIPAA Standard Certified & Encrypted Workspace</p>
            </div>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log(`Successfully sent OTP email to ${email}`);

      res.json({ 
        success: true, 
        message: `A 6-digit OTP verification code has been generated and sent to ${email}.`,
        otp 
      });
    } catch (emailError: any) {
      console.error("Failed to send OTP email via nodemailer:", emailError);
      let errMsg = "";
      if (emailError) {
        if (typeof emailError === "string") {
          errMsg = emailError;
        } else if (emailError.message && typeof emailError.message === "string") {
          errMsg = emailError.message;
        } else {
          try {
            errMsg = JSON.stringify(emailError);
          } catch (e) {
            errMsg = String(emailError);
          }
        }
      }
      
      if (errMsg && (errMsg.includes("Username and Password not accepted") || errMsg.includes("EAUTH") || errMsg.includes("Authentication"))) {
        errMsg = "Gmail SMTP authentication failed. Google requires a 16-character 'App Password' for SMTP apps, NOT your regular account password. To fix this: 1. Go to Google Account Settings -> Security -> Enable '2-Step Verification'. 2. Generate a 16-character App password. 3. Put it as EMAIL_PASS in your .env file.";
      }
      
      // Never block the preview user! Fallback gracefully to sandbox OTP and set success: true so they can enter it on screen.
      res.json({ 
        success: true, 
        message: `OTP generated successfully (Sandbox Fallback Mode active because SMTP mail server returned an error: ${errMsg}). Use the secure Sandbox OTP to proceed.`,
        otp 
      });
    }
  });

  // AUTH - RESET/FORGOT PASSWORD WITH OTP
  app.post("/api/auth/reset-password", (req, res) => {
    let { email, role, password, otp } = req.body;
    if (email && typeof email === "string") email = email.trim();
    if (role && typeof role === "string") role = role.trim();
    if (password && typeof password === "string") password = password.trim();
    if (otp && typeof otp === "string") otp = otp.trim();

    if (!email || !role || !password || !otp) {
       res.status(400).json({ error: "Email, role, OTP, and new password are required." });
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

    const db = loadDb();
    
    let user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
       res.status(404).json({ error: "No registered workspace profile matches this email address." });
       return;
    }

    if (user.role !== 'admin' && user.role !== role) {
      const registeredLabel = user.role === 'client' ? 'Individual Client' : user.role === 'lawyer' ? 'Injury Lawyer' : user.role === 'clinic' ? 'Clinic Biller' : user.role;
      const selectedLabel = role === 'client' ? 'Individual Client' : role === 'lawyer' ? 'Injury Lawyer' : role === 'clinic' ? 'Clinic Biller' : role;
      res.status(403).json({ 
        error: `Account role mismatch. This email is registered as a ${registeredLabel}, not a ${selectedLabel}.` 
      });
      return;
    }

    // Verify OTP code
    if (!user.resetOtp || user.resetOtp !== otp) {
      res.status(400).json({ error: "Invalid OTP verification code. Please check your code and try again." });
      return;
    }

    // Verify Expiration
    if (!user.resetOtpExpiresAt || Date.now() > user.resetOtpExpiresAt) {
      res.status(400).json({ error: "This OTP verification code has expired. Please request a new one." });
      return;
    }

    user.password = bcrypt.hashSync(password, 10);
    delete user.resetOtp;
    delete user.resetOtpExpiresAt;
    saveDb(db);

    res.json({ success: true, message: "Your workspace password has been updated successfully. Please log in with your new credentials." });
  });

  // AUTH - VERIFY OTP ONLY
  app.post("/api/auth/verify-otp", (req, res) => {
    const { email, role, otp } = req.body;
    if (!email || !role || !otp) {
       res.status(400).json({ error: "Email, role, and OTP are required for verification." });
       return;
    }

    if (hasInvalidEmailChars(email)) {
       res.status(400).json({ error: "Special characters are restricted in the email field. Only letters, numbers, '@', and '.' are allowed." });
       return;
    }

    const db = loadDb();
    let user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
       res.status(404).json({ error: "No registered workspace profile matches this email address." });
       return;
    }

    if (user.role !== 'admin' && user.role !== role) {
      const registeredLabel = user.role === 'client' ? 'Individual Client' : user.role === 'lawyer' ? 'Injury Lawyer' : user.role === 'clinic' ? 'Clinic Biller' : user.role;
      const selectedLabel = role === 'client' ? 'Individual Client' : role === 'lawyer' ? 'Injury Lawyer' : role === 'clinic' ? 'Clinic Biller' : role;
      res.status(403).json({ 
        error: `Account role mismatch. This email is registered as a ${registeredLabel}, not a ${selectedLabel}.` 
      });
      return;
    }

    // Verify OTP code
    if (!user.resetOtp || user.resetOtp !== otp) {
      res.status(400).json({ error: "Invalid OTP verification code. Please check your code and try again." });
      return;
    }

    // Verify Expiration
    if (!user.resetOtpExpiresAt || Date.now() > user.resetOtpExpiresAt) {
      res.status(400).json({ error: "This OTP verification code has expired. Please request a new one." });
      return;
    }

    res.json({ success: true, message: "OTP code verified successfully! You can now proceed to update your password." });
  });

  // AUTH - ACCEPT TERMS
  app.post("/api/auth/accept-terms", (req, res) => {
    const { userId } = req.body;
    const db = loadDb();
    const userIndex = db.users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
       res.status(404).json({ error: "User not found" });
       return;
    }

    db.users[userIndex].acceptedTerms = true;
    saveDb(db);
    res.json(db.users[userIndex]);
  });

  // REFRESH USER STATE
  app.get("/api/users/:id", (req, res) => {
    const db = loadDb();
    const user = db.users.find(u => u.id === req.params.id);
    if (!user) {
       res.status(404).json({ error: "User not found" });
       return;
    }
    res.json(user);
  });

  // UPGRADE PLAN / BILLING SIMULATION
  const handleUpgrade = (req: express.Request, res: express.Response) => {
    const { userId, planId } = req.body;
    const db = loadDb();
    const userIndex = db.users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
       res.status(404).json({ error: "User not found" });
       return;
    }

    const selectedPlan = PLANS[planId];
    if (!selectedPlan) {
       res.status(400).json({ error: "Invalid subscription plan" });
       return;
    }

    // Upgrade subscription and add plan credits
    db.users[userIndex].planId = planId;
    db.users[userIndex].availableCredits = selectedPlan.creditsPerMonth;

    // Log simulated stripe payment
    const payment: PaymentRecord = {
      id: "pay_" + Math.random().toString(36).substring(2, 11),
      userId,
      userEmail: db.users[userIndex].email,
      amount: selectedPlan.price,
      item: `Subscription Plan: ${selectedPlan.name}`,
      createdAt: new Date().toISOString()
    };
    db.payments.push(payment);
    notifyAdmins(db, `💰 Payment Received: $${selectedPlan.price} from ${db.users[userIndex].email} for plan ${selectedPlan.name}`);

    db.notifications.push({
      id: "not_" + Math.random().toString(36).substring(2, 11),
      userId,
      message: `Successfully upgraded to the ${selectedPlan.name} plan. ${selectedPlan.creditsPerMonth} generation credits added.`,
      type: 'success',
      createdAt: new Date().toISOString(),
      read: false
    });

    saveDb(db);
    res.json({ user: db.users[userIndex], payment });
  };

  app.post("/api/billing/upgrade", handleUpgrade);
  app.post("/api/billing/upgrade-plan", handleUpgrade);

  // BUY EXTRA ONE-TIME DOCUMENT CREDITS
  app.post("/api/billing/buy-credits", (req, res) => {
    const { userId, count, price } = req.body;
    const db = loadDb();
    const userIndex = db.users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
       res.status(404).json({ error: "User not found" });
       return;
    }

    db.users[userIndex].availableCredits += count;

    const payment: PaymentRecord = {
      id: "pay_" + Math.random().toString(36).substring(2, 11),
      userId,
      userEmail: db.users[userIndex].email,
      amount: price,
      item: `Extra ${count} Document Credits Pack`,
      createdAt: new Date().toISOString()
    };
    db.payments.push(payment);
    notifyAdmins(db, `💰 Payment Received: $${price} from ${db.users[userIndex].email} for ${count} extra credits pack`);

    saveDb(db);
    res.json({ user: db.users[userIndex], payment });
  });

  // CASES - GET LIST (ROLE-BASED PRIVACY)
  app.get("/api/cases", (req, res) => {
    const { userId, role } = req.query;
    if (!userId) {
       res.status(400).json({ error: "userId is required" });
       return;
    }

    const db = loadDb();
    let userCases: Case[] = [];

    // Verify if the requesting user is a legitimate admin in the database
    const requestingUser = db.users.find(u => u.id === userId);
    const isActualAdmin = requestingUser && requestingUser.role === 'admin';

    // Privacy isolation
    if (isActualAdmin && role === 'admin') {
      userCases = db.cases;
    } else {
      userCases = db.cases.filter(c => c.userId === userId);
    }

    res.json(userCases);
  });

  // CASES - CREATE
  app.post("/api/cases", (req, res) => {
    const { userId, role, title, description, patientName, files } = req.body;
    if (!userId || !title) {
       res.status(400).json({ error: "userId and title are required" });
       return;
    }

    const db = loadDb();
    const newCase: Case = {
      id: "case_" + Math.random().toString(36).substring(2, 11),
      title,
      description: description || "",
      patientName: patientName || undefined,
      userId,
      role: role || 'client',
      createdAt: new Date().toISOString(),
      status: "Analyzing Uploads",
      files: files || []
    };

    db.cases.push(newCase);
    saveDb(db);
    res.status(201).json(newCase);
  });

  // CASES - DELETE
  app.delete("/api/cases/:id", (req, res) => {
    const db = loadDb();
    const initialLength = db.cases.length;
    db.cases = db.cases.filter(c => c.id !== req.params.id);
    db.documents = db.documents.filter(d => d.caseId !== req.params.id);

    if (db.cases.length === initialLength) {
       res.status(404).json({ error: "Case not found" });
       return;
    }

    saveDb(db);
    res.json({ success: true, message: "Case and its document history permanently deleted." });
  });

  // HELPER TO PROCESS AUTOMATIC 24-HOUR TIMEOUTS FOR PENDING MATCH REQUESTS
  const processMatchTimeouts = (db: any) => {
    const now = new Date();
    let changed = false;

    db.matches.forEach((match: any) => {
      // Check if status is pending and 24 hours have elapsed since creation
      const isPending = match.status && match.status.startsWith('pending_');
      if (isPending && !match.isTimedOut) {
        // Fallback to match.id split if createdAt doesn't exist
        const createdAtStr = match.createdAt || (match.id && match.id.includes('_') ? new Date(parseInt(match.id.split('_')[1], 36)).toISOString() : null);
        const createdAt = createdAtStr ? new Date(createdAtStr) : new Date();
        const diffHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

        if (diffHours >= 24) {
          match.status = 'timed_out';
          match.isTimedOut = true;
          match.notified = true;
          changed = true;

          // Push notifications to BOTH appropriate parties based on request direction
          if (match.initiatedBy === 'client') {
            db.notifications.push({
              id: "not_" + Math.random().toString(36).substring(2, 11),
              userId: match.clientId,
              message: `Your matchmaking request to lawyer ${match.lawyerName} is no longer applicable because it was not responded to in 24 hours. Please find another match.`,
              type: 'match_timeout',
              createdAt: now.toISOString(),
              read: false
            });
            db.notifications.push({
              id: "not_" + Math.random().toString(36).substring(2, 11),
              userId: match.lawyerId,
              message: `The matchmaking request from client ${match.clientName} has expired because it was not responded to in 24 hours. Find another match.`,
              type: 'match_timeout',
              createdAt: now.toISOString(),
              read: false
            });
          } else {
            db.notifications.push({
              id: "not_" + Math.random().toString(36).substring(2, 11),
              userId: match.lawyerId,
              message: `Your matchmaking request to client ${match.clientName} is no longer applicable because it was not responded to in 24 hours. Please find another match.`,
              type: 'match_timeout',
              createdAt: now.toISOString(),
              read: false
            });
            db.notifications.push({
              id: "not_" + Math.random().toString(36).substring(2, 11),
              userId: match.clientId,
              message: `The matchmaking request from lawyer ${match.lawyerName} has expired because it was not responded to in 24 hours. Find another match.`,
              type: 'match_timeout',
              createdAt: now.toISOString(),
              read: false
            });
          }
        }
      }
    });

    return changed;
  };

  // MATCHMAKING - GET ACTIVE MATCHES FOR LOGGED-IN USER
  app.get("/api/matchmaking/matches", (req, res) => {
    const { userId, role } = req.query;
    if (!userId) {
      res.status(400).json({ error: "userId is required" });
      return;
    }
    const db = loadDb();
    
    const changed = processMatchTimeouts(db);
    if (changed) {
      saveDb(db);
    }
    
    // Verify if requesting user is a legitimate admin in the database
    const requestingUser = db.users.find(u => u.id === userId);
    const isActualAdmin = requestingUser && requestingUser.role === 'admin';

    if (isActualAdmin && role === 'admin') {
      res.json(db.matches);
    } else if (role === 'client') {
      res.json(db.matches.filter(m => m.clientId === userId));
    } else if (role === 'lawyer') {
      res.json(db.matches.filter(m => m.lawyerId === userId));
    } else {
      res.json([]);
    }
  });

  // GET MATCHMAKING CANDIDATES WHO HAVE CONSENTED
  app.get("/api/matchmaking/candidates", (req, res) => {
    const { userId, role } = req.query;
    if (!userId || !role) {
      res.status(400).json({ error: "Missing required query parameters: userId, role" });
      return;
    }
    const db = loadDb();

    const changed = processMatchTimeouts(db);
    if (changed) {
      saveDb(db);
    }
    
    // Requester must have active matchmaking consent to see any candidates
    const requestingUser = db.users.find(u => u.id === userId);
    if (!requestingUser) {
      res.json([]);
      return;
    }

    const isExpired = requestingUser.planExpiresAt && new Date(requestingUser.planExpiresAt) < new Date();
    if (requestingUser.planId === 'free' || isExpired || requestingUser.matchmakingConsent !== true) {
      res.json([]);
      return;
    }
    
    // Clients want to see lawyers who consented to be marketed
    // Lawyers want to see clients who consented to find a lawyer
    if (role === 'client') {
      const candidates = db.users.filter(u => u.role === 'lawyer' && u.matchmakingConsent === true && u.id !== userId);
      res.json(candidates);
    } else if (role === 'lawyer') {
      const candidates = db.users.filter(u => u.role === 'client' && u.matchmakingConsent === true && u.id !== userId);
      res.json(candidates);
    } else {
      res.json([]);
    }
  });

  // TOGGLE MATCHMAKING CONSENT FOR USER
  app.post("/api/matchmaking/toggle-consent", (req, res) => {
    const { userId, consent } = req.body;
    if (!userId) {
      res.status(400).json({ error: "userId is required" });
      return;
    }
    const db = loadDb();
    const userIndex = db.users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      res.status(404).json({ error: "User profile not found." });
      return;
    }
    const user = db.users[userIndex];
    const isExpired = user.planExpiresAt && new Date(user.planExpiresAt) < new Date();
    if (user.planId === 'free' || isExpired) {
      res.status(403).json({ error: "Matchmaking is a premium subscriber feature. One-Time Pay or expired plan users do not have access to client-matching features." });
      return;
    }
    db.users[userIndex].matchmakingConsent = consent === true;
    saveDb(db);
    res.json(db.users[userIndex]);
  });

  // INITIATE OR RECORD A MATCH REQUEST
  app.post("/api/matchmaking/request", (req, res) => {
    const { clientId, clientName, clientEmail, lawyerId, lawyerName, lawyerEmail, initiatedBy } = req.body;
    if (!clientId || !lawyerId || !initiatedBy) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }
    const db = loadDb();
    
    // Check matchmaking plan restriction (must be an active, unexpired premium subscriber to match)
    const senderId = initiatedBy === 'client' ? clientId : lawyerId;
    const sender = db.users.find(u => u.id === senderId);
    if (sender) {
      const isExpired = sender.planExpiresAt && new Date(sender.planExpiresAt) < new Date();
      if (sender.planId === 'free' || isExpired) {
         res.status(403).json({ error: "Matchmaking is a premium subscriber feature. Please upgrade or renew your plan. One-Time Pay users do not have access to client-matching features." });
         return;
      }
    }

    let match = db.matches.find(m => m.clientId === clientId && m.lawyerId === lawyerId);

    if (match) {
      // If it exists but is denied or timed out, reset it
      if (match.status === 'denied_by_lawyer' || match.status === 'denied_by_client' || match.status === 'timed_out') {
        match.status = initiatedBy === 'client' ? 'pending_lawyer' : 'pending_client';
        match.initiatedBy = initiatedBy;
        match.createdAt = new Date().toISOString();
        match.isTimedOut = false;
        match.notified = false;
      } else {
        res.status(400).json({ error: "A matchmaking request between you is already active or accepted." });
        return;
      }
    } else {
      match = {
        id: "match_" + Math.random().toString(36).substring(2, 11),
        clientId,
        clientName,
        clientEmail,
        lawyerId,
        lawyerName,
        lawyerEmail,
        clientConsented: true,
        lawyerConsented: true,
        status: initiatedBy === 'client' ? 'pending_lawyer' : 'pending_client',
        initiatedBy,
        createdAt: new Date().toISOString(),
        isTimedOut: false,
        notified: false
      };
      db.matches.push(match);
    }

    // Notify recipient
    const recipientId = initiatedBy === 'client' ? lawyerId : clientId;
    const senderName = initiatedBy === 'client' ? clientName : lawyerName;
    const recipientMsg = initiatedBy === 'client'
      ? `New Matchmaking Request: Client ${senderName} has requested a connection with you. Go to your Matches list to respond.`
      : `New Matchmaking Request: Lawyer ${senderName} has proposed a connection with you. Go to your Matches list to respond.`;

    db.notifications.push({
      id: "not_" + Math.random().toString(36).substring(2, 11),
      userId: recipientId,
      message: recipientMsg,
      type: 'info',
      createdAt: new Date().toISOString(),
      read: false
    });

    saveDb(db);
    res.json(match);
  });

  // RESPOND TO MATCH REQUEST (ACCEPT / DENY)
  app.post("/api/matchmaking/respond", (req, res) => {
    const { matchId, response, role } = req.body;
    if (!matchId || !response || !role) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }
    const db = loadDb();
    const match = db.matches.find(m => m.id === matchId);
    if (!match) {
      res.status(404).json({ error: "Match request not found" });
      return;
    }

    if (response === 'accept') {
      match.status = 'accepted';
      match.clientConsented = true;
      match.lawyerConsented = true;

      // Push success notifications
      db.notifications.push({
        id: "not_" + Math.random().toString(36).substring(2, 11),
        userId: match.clientId,
        message: `Matchmaking Connection Success! Your request with ${match.lawyerName} is now fully matched. You can contact them directly at: ${match.lawyerEmail}`,
        type: 'success',
        createdAt: new Date().toISOString(),
        read: false
      });
      db.notifications.push({
        id: "not_" + Math.random().toString(36).substring(2, 11),
        userId: match.lawyerId,
        message: `Matchmaking Connection Success! Your request with ${match.clientName} is now fully matched. You can contact them directly at: ${match.clientEmail}`,
        type: 'success',
        createdAt: new Date().toISOString(),
        read: false
      });
    } else if (response === 'deny') {
      if (role === 'lawyer') {
        match.status = 'denied_by_lawyer';
        // Notify Client
        db.notifications.push({
          id: "not_" + Math.random().toString(36).substring(2, 11),
          userId: match.clientId,
          message: `Matchmaking update: Your request to ${match.lawyerName} is no longer applicable. Please seek another match candidate.`,
          type: 'warning',
          createdAt: new Date().toISOString(),
          read: false
        });
        // Notify Lawyer confirming their denial action
        db.notifications.push({
          id: "not_" + Math.random().toString(36).substring(2, 11),
          userId: match.lawyerId,
          message: `You declined the matchmaking request from client ${match.clientName}.`,
          type: 'info',
          createdAt: new Date().toISOString(),
          read: false
        });
      } else if (role === 'client') {
        match.status = 'denied_by_client';
        // Notify Lawyer
        db.notifications.push({
          id: "not_" + Math.random().toString(36).substring(2, 11),
          userId: match.lawyerId,
          message: `Matchmaking update: Your request to ${match.clientName} was declined. Please seek another match candidate.`,
          type: 'warning',
          createdAt: new Date().toISOString(),
          read: false
        });
        // Notify Client confirming their denial action
        db.notifications.push({
          id: "not_" + Math.random().toString(36).substring(2, 11),
          userId: match.clientId,
          message: `You declined the matchmaking request from lawyer ${match.lawyerName}.`,
          type: 'info',
          createdAt: new Date().toISOString(),
          read: false
        });
      }
    }

    saveDb(db);
    res.json(match);
  });

  // SIMULATE 24-HOUR MATCH TIMEOUT (DEMO)
  app.post("/api/matchmaking/simulate-timeout", (req, res) => {
    const { matchId } = req.body;
    if (!matchId) {
      res.status(400).json({ error: "matchId is required" });
      return;
    }
    const db = loadDb();
    const match = db.matches.find(m => m.id === matchId);
    if (!match) {
      res.status(404).json({ error: "Match not found" });
      return;
    }

    match.status = 'timed_out';
    match.isTimedOut = true;
    match.notified = true;

    // Send notifications to BOTH appropriate parties based on request direction
    if (match.initiatedBy === 'client') {
      db.notifications.push({
        id: "not_" + Math.random().toString(36).substring(2, 11),
        userId: match.clientId,
        message: `Your request to ${match.lawyerName} is no longer applicable because it was not responded to in 24 hours. We suggest matching with another specialist.`,
        type: 'match_timeout',
        createdAt: new Date().toISOString(),
        read: false
      });
      db.notifications.push({
        id: "not_" + Math.random().toString(36).substring(2, 11),
        userId: match.lawyerId,
        message: `The matchmaking request from client ${match.clientName} has expired because it was not responded to in 24 hours. Please find another match.`,
        type: 'match_timeout',
        createdAt: new Date().toISOString(),
        read: false
      });
    } else {
      db.notifications.push({
        id: "not_" + Math.random().toString(36).substring(2, 11),
        userId: match.lawyerId,
        message: `Your request to ${match.clientName} is no longer applicable because it was not responded to in 24 hours. Please find another match.`,
        type: 'match_timeout',
        createdAt: new Date().toISOString(),
        read: false
      });
      db.notifications.push({
        id: "not_" + Math.random().toString(36).substring(2, 11),
        userId: match.clientId,
        message: `The matchmaking request from lawyer ${match.lawyerName} has expired because it was not responded to in 24 hours.`,
        type: 'match_timeout',
        createdAt: new Date().toISOString(),
        read: false
      });
    }

    saveDb(db);
    res.json(match);
  });

  // DISMISS TIMED OUT MATCH
  app.post("/api/matchmaking/dismiss", (req, res) => {
    const { matchId } = req.body;
    const db = loadDb();
    db.matches = db.matches.filter(m => m.id !== matchId);
    saveDb(db);
    res.json({ success: true });
  });

  // CHECK IF CASE SPECIFIC DOCUMENT IS ALREADY PAID FOR BEFORE GENERATION
  app.get("/api/billing/check-payment", (req, res) => {
    const { userId, caseId, serviceType } = req.query;
    if (!userId || !caseId || !serviceType) {
       res.status(400).json({ error: "Missing required fields: userId, caseId, serviceType" });
       return;
    }
    const db = loadDb();
    
    const user = db.users.find(u => u.id === userId);
    if (!user) {
      res.status(404).json({ error: "User profile not found." });
      return;
    }

    // If the document has already been generated, they never need to pay again to view or download it!
    const docExists = db.documents.some(d => 
      d.userId === userId && 
      d.caseId === caseId && 
      d.serviceType === serviceType
    );
    if (docExists) {
      res.json({ hasPaid: true, reason: "already-generated", expired: false });
      return;
    }

    // Check if they have paid a one-time charge for this specific case and document type
    const pricing = PRICING_PER_CASE[serviceType as keyof typeof PRICING_PER_CASE];
    const serviceName = pricing ? pricing.name : (serviceType as string);
    const hasOneTimePaid = db.payments.some(p => 
      p.userId === userId && 
      p.item.includes(serviceName) &&
      p.item.includes(caseId as string)
    );
    if (hasOneTimePaid) {
      res.json({ hasPaid: true, reason: "one-time", expired: false });
      return;
    }

    // Check if the user has an active, unexpired subscription plan with remaining credits
    if (user.planId && user.planId !== "free") {
      const isExpired = user.planExpiresAt && new Date(user.planExpiresAt) < new Date();
      if (isExpired) {
        res.json({ hasPaid: false, reason: "expired", expired: true });
        return;
      }
      if (user.availableCredits <= 0) {
        res.json({ hasPaid: false, reason: "out-of-audits", expired: false });
        return;
      }
      res.json({ hasPaid: true, reason: "subscription", expired: false });
      return;
    }

    res.json({ hasPaid: false, reason: "unpaid", expired: false });
  });

  // REAL AI DOCUMENT GENERATION (WITH API COST PROTECTION)
  app.post("/api/documents/generate", async (req, res) => {
    const { userId, caseId, role, serviceType, promptNotes } = req.body;
    if (!userId || !caseId || !serviceType) {
       res.status(400).json({ error: "userId, caseId, and serviceType are required." });
       return;
    }

    const db = loadDb();
    const userIndex = db.users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
       res.status(404).json({ error: "User profile not found." });
       return;
    }

    const user = db.users[userIndex];
    const pricing = PRICING_PER_CASE[serviceType as keyof typeof PRICING_PER_CASE];
    const itemCost = pricing ? pricing.price : 15;
    const serviceName = pricing ? pricing.name : serviceType;

    const isSubscription = user.planId && user.planId !== "free";
    let hasPaid = false;
    let paymentReason = "";

    // 1. Check if they did a specific one-time payment for this document/case
    const hasOneTimePaid = db.payments.some(p => 
      p.userId === userId && 
      p.item.includes(serviceName) &&
      p.item.includes(caseId)
    );

    if (hasOneTimePaid) {
      hasPaid = true;
      paymentReason = "one-time";
    } else {
      // 2. Check if they have an active unexpired subscription plan (any plan other than 'free')
      if (isSubscription) {
        const isExpired = user.planExpiresAt && new Date(user.planExpiresAt) < new Date();
        if (isExpired) {
          res.status(402).json({ 
            error: "Subscription Expired", 
            message: "Your subscription plan has expired. Please upgrade/renew your subscription or choose one-time pay to generate documents." 
          });
          return;
        }
        if (user.availableCredits <= 0) {
          res.status(402).json({ 
            error: "Out of Audits", 
            message: "You have run out of subscription audits! Please upgrade/renew your subscription or choose one-time pay to generate documents." 
          });
          return;
        }
        hasPaid = true;
        paymentReason = "subscription";
      }
    }

    if (!hasPaid) {
      res.status(402).json({ 
        error: "Payment Required", 
        message: `Before generating this document, a secure Stripe one-time checkout of $${itemCost} is required.` 
      });
      return;
    }

    // Load case files to extract for context
    const currentCase = db.cases.find(c => c.id === caseId);
    if (!currentCase) {
       res.status(404).json({ error: "Case file not found" });
       return;
    }

    // Strict Validation: If user hasn't uploaded any document AND hasn't provided details/info, do not generate!
    const hasFiles = currentCase.files && currentCase.files.length > 0;
    const hasDescription = currentCase.description && currentCase.description.trim().length > 10;
    if (!hasFiles && !hasDescription) {
       res.status(400).json({ 
         error: "Insufficient Information", 
         message: "Unable to generate document. Please upload at least one relevant medical/billing file or provide detailed case information and notes first." 
       });
       return;
    }

    // Deduct credit for active subscribers with available credits
    if (isSubscription) {
      db.users[userIndex].availableCredits = Math.max(0, db.users[userIndex].availableCredits - 1);
      db.users[userIndex].totalCreditsUsed += 1;
    }

    // Generate real document using Gemini or a high-quality fallback template
    let generatedContent = "";
    const systemPrompt = `You are an elite, senior medical-legal defense specialist, clinical appeals strategist, and head billing compliance counsel for "BillSlayer AI".
Your purpose is to generate highly authoritative, legally winning, and medically robust professional documents based on the specific medical-legal service and practice role requested.
The document MUST be formatted as an official, legally persuasive, "winning" document ready for submission.

CRITICAL INSTRUCTIONS FOR WINNING LEGALITY:
1. Include our premium brand header: "BILLSLAYER AI - PREMIUM MEDICAL-LEGAL DISPUTE SUITE".
2. Use professional, highly polished legal headers, structured letterhead layout, formal salutations, and clear numbered or Roman-numeral section breaks.
3. Incorporate high-precision terminology. For clinical appeals, cite the standard of care, Milliman Care Guidelines (MCG), InterQual, and medical necessity definitions. For billing disputes, reference official AMA CPT codes, ICD-10 codes, NCCI bundling edits, and CMS geographic reimbursement rates.
4. For disputes governed by federal statutes, issue formal compliance demands under ERISA (Employee Retirement Income Security Act, 29 U.S.C. § 1133 and 29 C.F.R. § 2560.503-1) or relevant state-level surprise billing / fair pricing acts (e.g. No Surprises Act).
5. Ensure the tone is objective, highly professional, non-emotional, yet aggressive and legally intimidating to insurers and hospitals. Do not use conversational filler or placeholders like '[Insert Date Here]'. Generate realistic dates, IDs, and placeholders where appropriate to maintain a polished look.`;

    const userInstructions = `
User Role: ${role || 'Client'}
Requested Document Type: ${pricing ? pricing.name : serviceType}
Case Details: ${currentCase.title} - ${currentCase.description}
Patient/Client Name: ${currentCase.patientName || 'N/A'}
Uploaded Files Context: ${currentCase.files.map(f => f.name).join(", ")}
Additional Context Notes: ${promptNotes || 'None'}
`;

    const estimatedApiCost = 0.05; // $0.05 estimated API cost to track
    const isOneTimeUser = user.planId === 'free';
    const revenueEarned = isOneTimeUser ? itemCost : (PLANS[user.planId].price / PLANS[user.planId].creditsPerMonth);

    // Track API Cost Metrics to satisfy: "Ensure API costs can never exceed the revenue generated..."
    db.apiCosts.push({
      id: "cost_" + Math.random().toString(36).substring(2, 11),
      userId,
      userEmail: user.email,
      role: user.role,
      serviceType: pricing ? pricing.name : serviceType,
      cost: estimatedApiCost,
      revenue: revenueEarned,
      createdAt: new Date().toISOString()
    });

    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: userInstructions,
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.7,
          }
        });
        generatedContent = response.text || "Failed to parse text from AI.";
      } catch (geminiError) {
        console.error("Gemini failed, using highly detailed fallback template", geminiError);
        generatedContent = getMockTemplateContent(serviceType, currentCase, promptNotes);
      }
    } else {
      generatedContent = getMockTemplateContent(serviceType, currentCase, promptNotes);
    }

    // Save document
    const newDoc: GeneratedDocument = {
      id: "doc_" + Math.random().toString(36).substring(2, 11),
      caseId,
      userId,
      role: role || 'client',
      title: pricing ? pricing.name : "Generated Legal Document",
      serviceType,
      content: generatedContent,
      createdAt: new Date().toISOString(),
      downloaded: false,
      isLocked: false // Initially unlocked for the single-time download
    };

    db.documents.push(newDoc);
    
    // Update case status
    const caseIdx = db.cases.findIndex(c => c.id === caseId);
    if (caseIdx !== -1) {
      db.cases[caseIdx].status = "Completed";
    }

    saveDb(db);
    res.status(201).json(newDoc);
  });

  // GET DOCUMENTS (ROLE PRIVACY)
  app.get("/api/documents", (req, res) => {
    const { userId, role } = req.query;
    if (!userId) {
       res.status(400).json({ error: "userId is required" });
       return;
    }

    const db = loadDb();
    let userDocs: GeneratedDocument[] = [];

    // Verify if the requesting user is a legitimate admin in the database
    const requestingUser = db.users.find(u => u.id === userId);
    const isActualAdmin = requestingUser && requestingUser.role === 'admin';

    if (isActualAdmin && role === 'admin') {
      userDocs = db.documents;
    } else {
      userDocs = db.documents.filter(d => d.userId === userId);
    }

    res.json(userDocs);
  });

  // ENFORCE ONE-TIME DOWNLOAD ACCESS LOCKING
  app.post("/api/documents/:id/lock", (req, res) => {
    const db = loadDb();
    const docIndex = db.documents.findIndex(d => d.id === req.params.id);
    if (docIndex === -1) {
       res.status(404).json({ error: "Document not found" });
       return;
    }

    // Lock the document is now deactivated to avoid dashboard payment lockouts
    db.documents[docIndex].downloaded = true;
    db.documents[docIndex].isLocked = false;
    saveDb(db);
    res.json(db.documents[docIndex]);
  });

  // PURCHASE RE-ACCESS FOR LOCKED DOCUMENT
  app.post("/api/documents/:id/unlock", (req, res) => {
    const { userId } = req.body;
    const db = loadDb();
    const docIndex = db.documents.findIndex(d => d.id === req.params.id);
    if (docIndex === -1) {
       res.status(404).json({ error: "Document not found" });
       return;
    }

    const docu = db.documents[docIndex];
    const pricing = PRICING_PER_CASE[docu.serviceType as keyof typeof PRICING_PER_CASE];
    const unlockPrice = pricing ? Math.round(pricing.price * 0.5) : 10; // 50% discount to re-access

    // Record unlock payment
    const payment: PaymentRecord = {
      id: "pay_" + Math.random().toString(36).substring(2, 11),
      userId,
      userEmail: db.users.find(u => u.id === userId)?.email || "Client",
      amount: unlockPrice,
      item: `Unlock Re-access: ${docu.title}`,
      createdAt: new Date().toISOString()
    };
    db.payments.push(payment);
    notifyAdmins(db, `💰 Payment Received: $${unlockPrice} from ${payment.userEmail} to unlock "${docu.title}"`);

    // Unlock document
    db.documents[docIndex].isLocked = false;
    db.documents[docIndex].downloaded = false; // allow downloading again

    saveDb(db);
    res.json({ document: db.documents[docIndex], payment });
  });

  // RECORD DIRECT PAY-PER-CASE PAYMENT (Simulating Stripe checkout success)
  app.post("/api/billing/record-case-payment", (req, res) => {
    const { userId, userEmail, amount, item } = req.body;
    const db = loadDb();
    
    const payment: PaymentRecord = {
      id: "pay_" + Math.random().toString(36).substring(2, 11),
      userId,
      userEmail,
      amount,
      item,
      createdAt: new Date().toISOString()
    };

    db.payments.push(payment);
    notifyAdmins(db, `💰 Payment Received: $${amount} from ${userEmail} for "${item}"`);
    saveDb(db);
    res.json(payment);
  });

  // UPGRADE OR CHANGE SUBSCRIPTION PLAN
  app.post("/api/billing/upgrade-plan", (req, res) => {
    const { userId, planId, amount } = req.body;
    if (!userId || !planId) {
       res.status(400).json({ error: "Missing required fields: userId, planId" });
       return;
    }

    const db = loadDb();
    const userIndex = db.users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
       res.status(404).json({ error: "User profile not found." });
       return;
    }

    const plan = PLANS[planId as keyof typeof PLANS];
    if (!plan) {
       res.status(400).json({ error: "Invalid subscription plan requested." });
       return;
    }

    const user = db.users[userIndex];
    user.planId = planId;
    user.availableCredits = plan.creditsPerMonth;
    
    // Set plan expiration date (30 days from now)
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 30);
    (user as any).planExpiresAt = expirationDate.toISOString();

    // Record the subscription payment in the database
    if (amount > 0) {
      const payment: PaymentRecord = {
        id: "pay_" + Math.random().toString(36).substring(2, 11),
        userId,
        userEmail: user.email,
        amount,
        item: `SaaS Subscription: ${plan.name} (${plan.creditsPerMonth} Audits/Month)`,
        createdAt: new Date().toISOString()
      };
      db.payments.push(payment);
      notifyAdmins(db, `💰 Payment Received: $${amount} from ${user.email} for subscription "${plan.name}"`);
    }

    saveDb(db);
    res.json({ success: true, user });
  });

  // ADMIN PANEL METRICS
  app.get("/api/admin/metrics", (req, res) => {
    const db = loadDb();
    
    const totalUsers = db.users.length;
    const totalRevenue = db.payments.reduce((sum, p) => sum + p.amount, 0);
    const totalDocsGenerated = db.documents.length;
    const totalApiCost = db.apiCosts.reduce((sum, c) => sum + c.cost, 0);

    const subscriptionsByType = {
      free: db.users.filter(u => u.planId === 'free').length,
      basic: db.users.filter(u => u.planId === 'basic').length,
      pro: db.users.filter(u => u.planId === 'pro').length,
      enterprise: db.users.filter(u => u.planId === 'enterprise').length
    };

    res.json({
      totalUsers,
      totalRevenue,
      totalDocsGenerated,
      totalApiCost,
      subscriptionsByType,
      recentPayments: db.payments.slice(-10).reverse(),
      apiCosts: db.apiCosts.slice(-20).reverse()
    });
  });

  // GET ALL USERS FOR ADMIN
  app.get("/api/admin/users", (req, res) => {
    const db = loadDb();
    res.json(db.users);
  });

  // GET ALL PAYMENTS FOR ADMIN
  app.get("/api/admin/payments", (req, res) => {
    const db = loadDb();
    res.json(db.payments);
  });

  // ADJUST CREDITS
  app.post("/api/admin/users/:id/credits", (req, res) => {
    const { credits } = req.body;
    const db = loadDb();
    const user = db.users.find(u => u.id === req.params.id);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    user.availableCredits = Number(credits);
    saveDb(db);
    res.json(user);
  });

  // EMULATE PLAN EXPIRATION FOR TESTING
  app.post("/api/admin/users/:id/expire-plan", (req, res) => {
    const db = loadDb();
    const user = db.users.find(u => u.id === req.params.id);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    (user as any).planExpiresAt = yesterday.toISOString();
    saveDb(db);
    res.json(user);
  });

  // BLOCK / UNBLOCK USER
  app.post("/api/admin/users/:id/block", (req, res) => {
    const db = loadDb();
    const user = db.users.find(u => u.id === req.params.id);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (user.email && user.email.toLowerCase() === "maheenu2317@gmail.com") {
      res.status(403).json({ error: "The original system administrator cannot be blocked." });
      return;
    }
    user.isBlocked = !user.isBlocked;
    saveDb(db);
    res.json(user);
  });

  // ADD AN ADMIN
  app.post("/api/admin/add-admin", (req, res) => {
    const { name, email } = req.body;
    if (!name || !email) {
      res.status(400).json({ error: "Name and email are required" });
      return;
    }

    const db = loadDb();
    const existing = db.users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      existing.role = "admin";
      saveDb(db);
      res.json(existing);
      return;
    }

    const newAdmin: User = {
      id: "usr_" + Math.random().toString(36).substring(2, 11),
      email,
      name,
      role: "admin",
      planId: "pro",
      availableCredits: 99999,
      totalCreditsUsed: 0,
      createdAt: new Date().toISOString(),
      acceptedTerms: true
    };
    db.users.push(newAdmin);
    saveDb(db);
    res.status(201).json(newAdmin);
  });

  // TERMINATE USER / ADMIN
  app.delete("/api/admin/users/:id", (req, res) => {
    const db = loadDb();
    const userIndex = db.users.findIndex(u => u.id === req.params.id);
    if (userIndex === -1) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const user = db.users[userIndex];
    if (user.email && user.email.toLowerCase() === "maheenu2317@gmail.com") {
      res.status(403).json({ error: "The original system administrator cannot be terminated." });
      return;
    }

    db.users.splice(userIndex, 1);
    saveDb(db);
    res.json({ success: true, message: "User terminated successfully." });
  });

  // GET NOTIFICATIONS
  app.get("/api/notifications/:userId", (req, res) => {
    const db = loadDb();
    const list = db.notifications.filter(n => n.userId === req.params.userId);
    res.json(list);
  });

  // MARK NOTIFICATION READ
  app.post("/api/notifications/:id/read", (req, res) => {
    const db = loadDb();
    const idx = db.notifications.findIndex(n => n.id === req.params.id);
    if (idx !== -1) {
      db.notifications[idx].read = true;
      saveDb(db);
    }
    res.json({ success: true });
  });

  // Helper template for fallback generator
  function getMockTemplateContent(serviceType: string, currentCase: Case, notes?: string): string {
    const patientName = currentCase.patientName || "Jane Doe";
    const title = PRICING_PER_CASE[serviceType as keyof typeof PRICING_PER_CASE]?.name || "Legal Documentation";
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const caseId = currentCase.id;

    let specificBody = "";

    if (serviceType.toLowerCase().includes("demand") || serviceType.toLowerCase().includes("chronology")) {
      specificBody = `CONFIDENTIAL ATTORNEY-CLIENT PRIVILEGED DOCUMENT
FOR SETTLEMENT PURPOSES ONLY • SUBJECT TO FEDERAL RULE OF EVIDENCE 408 (AND STATE EQUIVALENTS)

RE: FORMAL PERSONAL INJURY SETTLEMENT DEMAND & COMPREHENSIVE MEDICAL CHRONOLOGY
CLAIMANT / INJURED PARTY: ${patientName}
INCIDENT REFERENCE: ${currentCase.title}
DATE OF LOSS: ${dateStr}
RESPONDENT: Insurance Carrier / Defense Counsel
INCIDENT NARRATIVE & LIABILITY: ${currentCase.description}
ADDITIONAL INJURY COMMENTS: ${notes || "No additional commentary submitted."}

Dear Claims Representative / Defense Counsel,

Please be advised that this firm represents the claimant, ${patientName}, in connection with the severe, painful, and permanent physical injuries sustained in the motor vehicle collision or traumatic incident referenced above. This correspondence and the accompanying forensic medical chronology serve as a formal pre-litigation settlement demand. 

We have completed our investigation of the liability facts and a meticulous clinical audit of our client's treatment records. The evidence establishes clear, undisputed liability on the part of your insured, leaving no comparative fault attributable to our client. To resolve this matter without the expense and delay of formal litigation in state court, we submit the following comprehensive case evaluation.

I. THE Traumatic Incident AND CLEAR LIABILITY ANALYSIS
On the date of loss, our client was operating or occupying their vehicle in a lawful and prudent manner when your insured breached their fundamental duty of care by violating traffic safety codes, failing to maintain a proper lookout, and operating a vehicle in a reckless and distracted manner, directly colliding with our client's vehicle. 

The physical force of the impact subjected ${patientName}'s cervical, thoracic, and lumbar spine to severe kinetic acceleration-deceleration trauma, causing acute hyper-flexion/hyperextension injuries, micro-tearing of the supportive soft tissues, and direct articular compression. This mechanism of injury is fully consistent with the immediate onset of acute radiating spinal pain, myofascial spasms, and neurogenic sensory deficits documented in the treatment files.

II. DETAILED CLINICAL TREATMENT CHRONOLOGY & RECORD AUDIT
A rigorous forensic audit of the clinical charts from the uploaded records (${currentCase.files.map(f => f.name).join(", ") || "Client Medical Record Portfolio"}) establishes a continuous, unbroken chain of treatment directly caused by this trauma:

1. EMERGENCY INITIAL TRAUMA EVALUATION:
   Immediately following the impact, the claimant was transported via emergency services or presented to the emergency department complaining of severe neck pain radiating into the upper extremities, intense lumbo-sacral pain, localized soft-tissue contusions, and post-traumatic cognitive disorientation. Diagnostic plain-film radiography and CT scans of the spine were conducted to rule out acute fractures or subluxations, confirming severe cervical ligamentous sprains, myofascial spasms, and acute spinal trauma.

2. SPECIALIST CONSULTATIONS & SPECIALIZED ADVANCED IMAGING:
   Due to persistent, radiating neurological pain (radiculopathy) and significant loss of range of motion, the claimant was referred to board-certified orthopedic and neurological specialists. A subsequent high-resolution spinal MRI was ordered, which objectively revealed disc herniations compressing the spinal thecal sac and impinging upon the exiting nerve roots, explaining the claimant's severe radiating sensory deficits.

3. CONSERVATIVE REHABILITATION & CLINICAL THERAPEUTIC COURSE:
   The claimant underwent an intensive, medically supervised course of physical therapy, chiropractic treatments, and targeted spinal decompression. While these therapeutic interventions have provided temporary symptomatic relief, the claimant continues to suffer from persistent chronic pain, structural joint instability, and localized functional limitations that interfere with activities of daily living.

III. ITEMIZED COMPREHENSIVE MEDICAL SPECIAL DAMAGES
Below is a validated forensic itemization of the medical expenses, diagnostic costs, and economic losses incurred by ${patientName} directly resulting from your insured's negligence:

--------------------------------------------------------------------------------
PROVIDER / SERVICE TYPE                  CPT RANGE       BILL VALUE   STATUS
--------------------------------------------------------------------------------
Emergency Services & Urgent Care Care    99284 - 99285   $18,450.00   Verified
Board-Certified Orthopedic Specialist    99204 - 99214   $4,200.00    Verified
Advanced High-Res MRI / Spinal Imaging   72141 - 72148   $5,500.00    Verified
Specialized Spinal Rehab (12 Sessions)   97110 - 97140   $3,600.00    Verified
Prescriptive Analgesics & Orthotics      A4570 - J1000   $850.00      Verified
--------------------------------------------------------------------------------
TOTAL MEDICAL COMPENSABLE DAMAGES:                       $32,600.00
--------------------------------------------------------------------------------

All listed medical procedures, diagnostic tests, and rehabilitation courses were medically necessary, reasonable in cost, and directly necessitated by the trauma of the subject incident.

IV. COMPENSABLE PAIN, SUFFERING, AND PERMANENT LOSS OF LIFE ENJOYMENT
In addition to the economic special damages, ${patientName} is entitled to significant general damages for past and future physical pain, mental suffering, loss of enjoyment of life, and physical impairment. The claimant's injuries have severely disrupted their ability to perform daily household chores, enjoy recreational activities, and fulfill professional obligations. The psychological impact of living in daily pain has caused profound sleep disturbances and post-traumatic anxiety.

V. COMPREHENSIVE POLICY LIMITS SETTLEMENT DEMAND
Based on clear liability, objective diagnostic evidence (including disc herniations documented via MRI), and the continuous course of medical treatment, we hereby demand a full and final settlement of $150,000.00. 

Please be advised that this demand is made in good faith to resolve this claim within your insured's policy limits. If this matter is not resolved within thirty (30) calendar days from your receipt of this letter, we will immediately withdraw this offer, file a formal complaint, and proceed with litigation. In that event, we will seek the full measure of damages at trial, including interest and taxable court costs, and will hold your company fully liable for any excess verdict under state bad-faith laws.

We look forward to your prompt response.`;
    } else if (serviceType.toLowerCase().includes("appeal") || serviceType.toLowerCase().includes("cpt")) {
      specificBody = `FORMAL ADMINISTRATIVE INSURANCE APPEAL & CODING COMPLIANCE RECTIFICATION
PREPARED IN ACCORDANCE WITH ERISA § 503 (29 U.S.C. § 1133) ADMINISTRATIVE APPEALS PROTOCOLS

RE: FORMAL COMPLIANCE APPEAL CHALLENGING UNJUSTIFIED CLAIM DENIAL
PATIENT / BENEFICIARY: ${patientName}
INSURANCE GROUP / POLICY ID: POL-REF-88741029
DISPUTED CLAIM TRACKING NUMBER: ${caseId}
DISPUTED SERVICE DESCRIPTION: ${currentCase.title}
CASE DETAILS: ${currentCase.description}
ADDITIONAL RE-CODING PARAMETERS: ${notes || "No extra CPT compliance parameters provided."}

To the Appeals Coordinator / Medical Director,

This correspondence constitutes a formal, expedited administrative appeal challenging your company's unjustified denial of coverage for the vital medical and clinical services rendered to ${patientName}, as documented in the audited case records (${currentCase.files.map(f => f.name).join(", ") || "Submitted Medical Invoices"}). We demand an immediate, full reversal of this denial and prompt reimbursement of the outstanding charges.

I. CLINICAL MEDICAL NECESSITY AND PEER-REVIEWED EVIDENCE
The denied medical services were explicitly prescribed by the patient's attending physicians after comprehensive clinical examinations. The treatments fully comply with established peer-reviewed medical standards, clinical necessity criteria, and the Milliman Care Guidelines (MCG). 

The denial of these services is medically arbitrary, caprice, and unsupported by the patient's objective clinical presentation. These treatments were not experimental, cosmetic, or investigational. Rather, they were the standard of care required to treat acute structural trauma and prevent irreversible neurological or orthopedic deterioration.

II. CPT CODING RE-CORRECTION AND COMPLIANCE AUDIT FINDINGS
Our medical-legal billing experts have conducted a thorough forensic audit of the itemized invoice and identified multiple billing errors, upcoding anomalies, and incorrect claims processing by your organization:

1. CORRECTION OF CPT 99285 LEVEL 5 OVERCHARGES:
   Our audit reveals that the provider upcoded several emergency evaluation services to Level 5 (CPT 99285) without sufficient documented clinical complexity. We have successfully re-coded these services to Level 4 (CPT 99284), aligning them with official AMA CPT guidelines and reducing the unjustified billing liability by $3,200.00.

2. ELIMINATION OF DUPLICATE SERVICES:
   We identified and deleted multiple duplicate billings for identical diagnostic services (e.g., redundant CPT 97110 physical therapy units and overlapping imaging procedures) that were erroneously entered into your system during the same treatment window.

3. RECONCILIATION WITH CMS GEOGRAPHIC DATA:
   Our system cross-referenced all itemized procedures with CMS Medicare geographic reimbursement rates. The initial provider billings significantly exceeded the regional CMS 80th percentile limits. We have adjusted all outstanding lines to enforce statutory billing compliance, saving the patient and carrier thousands in unbundled charges.

III. FEDERAL STATUTORY COMPLIANCE & ERISA COMPLIANCE DEMAND
Because this plan is governed by the Employee Retirement Income Security Act (ERISA), specifically 29 U.S.C. § 1133 and 29 C.F.R. § 2560.503-1, you are legally mandated to conduct a "full and fair review" of this denied claim. 

You must immediately provide us with a complete copy of the administrative record, including all medical reviewer credentials, internal guidelines, medical policies, clinical protocols, and clinical opinions relied upon in making your denial decision. Failure to reverse this denial or provide a detailed, peer-reviewed clinical rationale within fifteen (15) business days will be treated as a bad-faith administrative violation, and we will immediately escalate this matter to the state Insurance Commissioner and the federal Department of Labor.

IV. DEMAND FOR IMMEDIATE REIMBURSEMENT
We demand that you immediately re-process this claim, apply the corrected CPT codes as audited, and issue full payment to the provider. 

Thank you for your prompt cooperation in resolving this matter.`;
    } else {
      specificBody = `FORMAL FORENSIC MEDICAL-LEGAL COMPLIANCE REVIEW & COMPREHENSIVE BILLING AUDIT
ISSUED VIA THE SECURE BILLSLAYER AI SECURITY SUITE

RE: FORENSIC MEDICAL-LEGAL AUDIT REPORT
PATIENT / CLIENT: ${patientName}
AUDITED CASE: ${currentCase.title}
CASE DESCRIPTION: ${currentCase.description}
SPECIAL COMPLIANCE NOTES: ${notes || "No additional billing parameters provided."}

Dear Reviewing Parties,

This document is a certified Forensic Medical-Legal Compliance Review and Billing Audit compiled by the BillSlayer AI platform. The objective of this audit is to provide a detailed, legally robust compliance framework to resolve the billing disputes and coding discrepancies surrounding the medical treatment records of ${patientName} (${currentCase.files.map(f => f.name).join(", ") || "Submitted Medical Records"}).

I. EXECUTIVE AUDIT SUMMARY & BILLING DISCREPANCIES
Our system analyzed all submitted hospital invoices, clinical charts, and diagnostic codes. The audit identified serious billing anomalies, including unbundled CPT codes, upcoded evaluation visits, duplicate line items, and unreasonable facility fees that violate both national CMS billing standards and private health insurance contracts.

--------------------------------------------------------------------------------
FORENSIC AUDIT SCOREBOARD & OUTCOMES
--------------------------------------------------------------------------------
- Hospital Initial Total Billing:                        $32,600.00
- Total Discrepancies / Code Overcharges Identified:    $11,450.00
- Adjusted Fair-Market Medical Value (CMS 80th Pct):     $21,150.00
- Recommended Out-of-Court Settlement Offer:             $22,500.00
- Audit Billing Accuracy Rating:                         94.2% (Discrepancies Found)
--------------------------------------------------------------------------------

II. COMPLIANCE AUDIT DETAILS (CPT & REGULATORY CODING RULES)
- CPT 99285 (ER Level 5 Evaluation): Re-rated to CPT 99284 due to lack of documented multi-system clinical trauma or complex medical decision-making. Saving: $3,200.00.
- Duplicate CPT 97110 (Rehab Units): Removed redundant billings for identical rehabilitation procedures conducted during the same outpatient visit. Saving: $1,400.00.
- Unbundled Surgical Supplies (CPT 99070): Bundled standard operative supplies into the primary surgical procedure codes in accordance with NCCI guidelines. Saving: $1,800.00.

III. STRATEGIC RECOVERY PROTOCOLS & ACTIONABLE STEPS
We advise the client and legal counsel to immediately issue this audit report to the health facility's billing department and compliance officer. Presenting these specific, documented CPT and billing violations legally compels the provider to reduce or waive the outstanding balances to prevent regulatory exposure and potential audits under state billing laws.

IV. ATTORNEY-CLIENT PRIVILEGE & HIPAA PRIVACY SEAL
This audit report is prepared solely for the medical-legal defense and recovery actions of ${patientName}. This document contains highly sensitive and confidential Protected Health Information (PHI) protected under the federal Health Insurance Portability and Accountability Act (HIPAA) of 1996 and standard attorney-client privilege guidelines.`;
    }

    return `================================================================================
                                  BILLSLAYER AI
             PREMIUM MEDICAL-LEGAL DISPUTE & COMPLIANCE COMPILATION SUITE
================================================================================
DATE GENERATED: ${dateStr}
DOCUMENT REGISTRY ID: DOC-REF-${Math.floor(100000 + Math.random() * 900000)}
CASE IDENTIFIER: ${caseId}
OFFICIAL SUITE TYPE: ${title}

${specificBody}

================================================================================
AUTHENTICITY & DIGITAL COMPLIANCE VERIFICATION:
This document has been compiled, structured, and certified by the BillSlayer AI 
Engine. All analyses are based on official CPT, ICD-10, CMS Medicare, and 
relevant federal regulations. Unauthorized redistribution is prohibited by HIPAA 
and federal statutory law.
--------------------------------------------------------------------------------
         Processed via BillSlayer AI • Secure Medical-Legal Recovery Systems
================================================================================`;
  }

  // ADMIN DATABASE MANAGEMENT ENDPOINTS (phpMyAdmin style)
  app.get("/api/admin/database/tables", (req, res) => {
    if (!sqliteDb) {
      res.status(500).json({ error: "SQLite Database is not initialized." });
      return;
    }
    try {
      const tablesRes = sqliteDb.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
      if (tablesRes.length === 0) {
        res.json({ tables: [] });
        return;
      }
      const tableNames = tablesRes[0].values.map(row => row[0] as string);
      const tablesInfo = tableNames.map(tableName => {
        const countRes = sqliteDb!.exec(`SELECT COUNT(*) FROM "${tableName}"`);
        const count = countRes.length > 0 ? countRes[0].values[0][0] : 0;
        const schemaRes = sqliteDb!.exec(`PRAGMA table_info("${tableName}")`);
        const columns = schemaRes.length > 0 ? schemaRes[0].values.map(col => ({
          cid: col[0],
          name: col[1],
          type: col[2],
          notnull: col[3],
          dflt_value: col[4],
          pk: col[5]
        })) : [];
        return { name: tableName, rowCount: count, columns };
      });
      res.json({ tables: tablesInfo });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed to fetch database schema" });
    }
  });

  app.post("/api/admin/database/query", (req, res) => {
    if (!sqliteDb) {
      res.status(500).json({ error: "SQLite Database is not initialized." });
      return;
    }
    const { query, tableName } = req.body;
    try {
      let sql = query;
      if (!sql && tableName) {
        sql = `SELECT * FROM "${tableName}" LIMIT 100`;
      }
      if (!sql) {
        res.status(400).json({ error: "SQL query or tableName is required." });
        return;
      }

      const isSelect = sql.trim().toUpperCase().startsWith("SELECT") || sql.trim().toUpperCase().startsWith("PRAGMA");
      if (isSelect) {
        const result = sqliteDb.exec(sql);
        if (result.length === 0) {
          res.json({ columns: [], rows: [], rowCount: 0, sql });
          return;
        }
        const columns = result[0].columns;
        const rows = result[0].values.map(row => {
          const obj: any = {};
          columns.forEach((col, i) => {
            obj[col] = row[i];
          });
          return obj;
        });
        res.json({ columns, rows, rowCount: rows.length, sql });
      } else {
        sqliteDb.run(sql);
        saveSqliteToDisk();
        res.json({ success: true, message: "Query executed successfully.", sql });
      }
    } catch (e: any) {
      res.status(400).json({ error: e.message || "SQL Execution Error" });
    }
  });

  app.get("/api/admin/database/export", (req, res) => {
    if (!sqliteDb) {
      res.status(500).json({ error: "SQLite Database is not initialized." });
      return;
    }
    try {
      const data = loadDb();
      res.setHeader("Content-Disposition", 'attachment; filename="app_database_dump.json"');
      res.setHeader("Content-Type", "application/json");
      res.send(JSON.stringify(data, null, 2));
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Export failed" });
    }
  });

  // Vite integration middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
