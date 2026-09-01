// Throwaway end-to-end smoke test for BillSlayer AI's backend. Not a permanent test suite —
// run manually against a live dev server: `npm run dev` in one terminal, then in another:
//   npx tsx scripts/smoke-test.ts
// Preconditions: DATABASE_URL points at a real Postgres with the schema loaded (db/init/001_schema.sql),
// and bin/minio.exe is running (see bin/README.md).
import { createCanvas } from "@napi-rs/canvas";

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const STAMP = Date.now();
let passed = 0;
let failed = 0;

function ok(label: string) { passed++; console.log(`✓ ${label}`); }
function fail(label: string, err: any) { failed++; console.error(`✗ ${label}: ${err?.message || err}`); }

async function step(label: string, fn: () => Promise<void>) {
  try {
    await fn();
    ok(label);
  } catch (err) {
    fail(label, err);
  }
}

function assert(cond: any, msg: string) {
  if (!cond) throw new Error(msg);
}

async function json(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, init);
  let body: any = null;
  try { body = await res.json(); } catch { /* no body */ }
  return { res, body };
}

function makeFixtureImage(): Buffer {
  const canvas = createCanvas(900, 400);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, 900, 400);
  ctx.fillStyle = "black";
  ctx.font = "28px sans-serif";
  ctx.fillText("MEDICAL BILLING STATEMENT", 30, 50);
  ctx.font = "20px sans-serif";
  ctx.fillText("Patient: Jane Smoke-Test", 30, 100);
  ctx.fillText("Provider: General Hospital", 30, 130);
  ctx.fillText("99213  Office Visit Level 3           $250.00", 30, 190);
  ctx.fillText("99285  Emergency Room Level 5          $1800.00", 30, 220);
  ctx.fillText("97110  Therapeutic Exercise            $120.00", 30, 250);
  ctx.fillText("Insurance Claim #A12345  Diagnosis: sprain", 30, 300);
  ctx.fillText("Amount Due: $2170.00", 30, 340);
  return canvas.toBuffer("image/png");
}

async function main() {
  console.log(`Running smoke test against ${BASE}\n`);

  await step("preflight: Postgres reachable via /api/health", async () => {
    const { res } = await json("/api/health");
    assert(res.ok, `health check failed with status ${res.status}`);
  });

  // NOTE: the app restricts emails to [a-zA-Z0-9@.] only (no underscores/dashes) — see
  // hasInvalidEmailChars in server.ts — so these must avoid special characters entirely.
  const client = { email: `smoketestclient${STAMP}@example.com`, password: "TestPass123" };
  const lawyer = { email: `smoketestlawyer${STAMP}@example.com`, password: "TestPass123" };
  let clientUser: any, lawyerUser: any;

  await step("register client", async () => {
    const { res, body } = await json("/api/auth/register", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: client.email, name: "Smoke Client", role: "client", password: client.password }),
    });
    assert(res.status === 201, `expected 201, got ${res.status}: ${JSON.stringify(body)}`);
    clientUser = body;
  });

  await step("register lawyer", async () => {
    const { res, body } = await json("/api/auth/register", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: lawyer.email, name: "Smoke Lawyer", role: "lawyer", password: lawyer.password, licenseNumber: `LIC${STAMP}` }),
    });
    assert(res.status === 201, `expected 201, got ${res.status}: ${JSON.stringify(body)}`);
    lawyerUser = body;
  });

  await step("login client", async () => {
    const { res, body } = await json("/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: client.email, role: "client", password: client.password }),
    });
    assert(res.ok, `login failed: ${JSON.stringify(body)}`);
  });

  await step("forgot-password + OTP verify + reset round trip", async () => {
    const { res: fpRes, body: fp } = await json("/api/auth/forgot-password", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: client.email, role: "client" }),
    });
    assert(fpRes.ok, `forgot-password failed: ${JSON.stringify(fp)}`);
    // The API intentionally does NOT return the OTP when a real email was sent (returning it
    // would let anyone who knows the victim's address skip email access entirely and reset the
    // password directly — see server.ts). Read it back from the DB instead, which only a real
    // backend/admin actor can do, mirroring how a legitimate test harness (not an attacker)
    // would verify this flow.
    const { body: dbResult } = await json("/api/admin/database/query", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: `SELECT reset_otp FROM users WHERE email = '${client.email}'` }),
    });
    const otp = dbResult?.rows?.[0]?.reset_otp;
    assert(otp, "no OTP found in database after forgot-password");
    const { res: verifyRes } = await json("/api/auth/verify-otp", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: client.email, role: "client", otp }),
    });
    assert(verifyRes.ok, "OTP verification failed");
    const { res: resetRes } = await json("/api/auth/reset-password", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: client.email, role: "client", otp, password: "NewPass123" }),
    });
    assert(resetRes.ok, "password reset failed");
    client.password = "NewPass123";
  });

  await step("accept-terms", async () => {
    const { res } = await json("/api/auth/accept-terms", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: clientUser.id }),
    });
    assert(res.ok, "accept-terms failed");
  });

  let caseId: string;
  await step("create case (no inline files)", async () => {
    const { res, body } = await json("/api/cases", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: clientUser.id, role: "client", title: "Smoke Test Case", description: "Auto-generated smoke test case for a billing dispute.", patientName: "Jane Smoke-Test" }),
    });
    assert(res.status === 201, `expected 201, got ${res.status}: ${JSON.stringify(body)}`);
    assert(body.files === undefined, "Case response should not include a legacy files array");
    caseId = body.id;
  });

  let fileId: string;
  await step("upload fixture image -> case_files row", async () => {
    const buf = makeFixtureImage();
    const fd = new FormData();
    fd.append("file", new Blob([buf], { type: "image/png" }), "fixture-bill.png");
    fd.append("userId", clientUser.id);
    const res = await fetch(`${BASE}/api/cases/${caseId!}/files`, { method: "POST", body: fd as any });
    const body = await res.json();
    assert(res.status === 201, `expected 201, got ${res.status}: ${JSON.stringify(body)}`);
    fileId = body.id;
  });

  await step("reject invalid upload (wrong file type)", async () => {
    const fd = new FormData();
    fd.append("file", new Blob([Buffer.from("not a real file")], { type: "text/plain" }), "notes.txt");
    fd.append("userId", clientUser.id);
    const res = await fetch(`${BASE}/api/cases/${caseId!}/files`, { method: "POST", body: fd as any });
    assert(res.status === 400, `expected 400 for unsupported file type, got ${res.status}`);
  });

  await step("poll until OCR completes and content is validated", async () => {
    const deadline = Date.now() + 40000;
    let last: any = null;
    while (Date.now() < deadline) {
      const { body } = await json(`/api/cases/${caseId!}/files?userId=${clientUser.id}`);
      last = body.find((f: any) => f.id === fileId);
      if (last && (last.ocrStatus === "done" || last.ocrStatus === "failed")) break;
      await new Promise((r) => setTimeout(r, 2000));
    }
    assert(last, "file record not found while polling");
    assert(last.ocrStatus === "done", `OCR did not complete (status: ${last?.ocrStatus})`);
    assert(last.ocrText && last.ocrText.length > 0, "no OCR text extracted");
    assert(last.validationStatus === "valid", `expected content-relevance validation to pass, got: ${last.validationStatus} (${last.rejectionReason})`);
    console.log(`    OCR extracted ${last.ocrText.length} chars, sample CPT match check: ${/99213|99285|97110/.test(last.ocrText)}`);
  });

  await step("generate document (deterministic engine, no API key)", async () => {
    const { res: payRes } = await json("/api/billing/record-case-payment", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: clientUser.id, userEmail: client.email, amount: 10, item: `One-Time Case Payment: Medical Billing Audit (Case: ${caseId!})` }),
    });
    assert(payRes.ok, "failed to record payment");
    const { res, body } = await json("/api/documents/generate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: clientUser.id, caseId: caseId!, role: "client", serviceType: "billing_audit" }),
    });
    assert(res.status === 201, `expected 201, got ${res.status}: ${JSON.stringify(body)}`);
    assert(body.content.includes("BILLSLAYER AI"), "document content missing expected header");
    assert(body.content.includes("99213") || body.content.includes("99285"), "document should reference an extracted CPT code, not a generic template");
    assert(!body.content.toLowerCase().includes("gemini"), "document should never mention Gemini — no AI API is used");
  });

  await step("matchmaking: consent, candidates, request, respond", async () => {
    await json("/api/billing/upgrade-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: clientUser.id, planId: "clinic", amount: 0 }) });
    await json("/api/billing/upgrade-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: lawyerUser.id, planId: "lawyer", amount: 0 }) });
    await json("/api/matchmaking/toggle-consent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: clientUser.id, consent: true }) });
    await json("/api/matchmaking/toggle-consent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: lawyerUser.id, consent: true }) });

    const { body: candidates } = await json(`/api/matchmaking/candidates?userId=${clientUser.id}&role=client`);
    assert(Array.isArray(candidates) && candidates.some((c: any) => c.id === lawyerUser.id), "expected lawyer to appear in client's candidate list (vector-ranked or flat-filter fallback)");

    const { res: reqRes, body: match } = await json("/api/matchmaking/request", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: clientUser.id, clientName: "Smoke Client", clientEmail: client.email, lawyerId: lawyerUser.id, lawyerName: "Smoke Lawyer", lawyerEmail: lawyer.email, initiatedBy: "client" }),
    });
    assert(reqRes.ok, `match request failed: ${JSON.stringify(match)}`);

    const { res: respRes, body: accepted } = await json("/api/matchmaking/respond", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId: match.id, response: "accept", role: "lawyer" }),
    });
    assert(respRes.ok && accepted.status === "accepted", `match accept failed: ${JSON.stringify(accepted)}`);
  });

  await step("bio update triggers user embedding (no error even without a case embedding yet)", async () => {
    const { res } = await json(`/api/users/${lawyerUser.id}/bio`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bio: "Personal injury and medical billing dispute specialist." }),
    });
    assert(res.ok, "bio update failed");
  });

  await step("admin: metrics, users, payments, database explorer, SELECT-only enforcement", async () => {
    const { res: m } = await json("/api/admin/metrics");
    assert(m.ok, "admin metrics failed");
    const { res: u } = await json("/api/admin/users");
    assert(u.ok, "admin users failed");
    const { res: p } = await json("/api/admin/payments");
    assert(p.ok, "admin payments failed");
    const { res: t, body: tables } = await json("/api/admin/database/tables");
    assert(t.ok && Array.isArray(tables.tables) && tables.tables.length >= 9, `expected >=9 tables, got: ${JSON.stringify(tables)}`);
    const { res: q1 } = await json("/api/admin/database/query", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "SELECT 1 as ok" }) });
    assert(q1.ok, "SELECT query should be allowed");
    const { res: q2 } = await json("/api/admin/database/query", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "DELETE FROM users" }) });
    assert(q2.status === 400, `expected DELETE to be rejected with 400, got ${q2.status}`);
  });

  await step("notifications: list + mark read", async () => {
    const { body: notifs } = await json(`/api/notifications/${clientUser.id}`);
    assert(Array.isArray(notifs) && notifs.length > 0, "expected at least the welcome notification");
    const { res } = await json(`/api/notifications/${notifs[0].id}/read`, { method: "POST" });
    assert(res.ok, "mark-read failed");
  });

  await step("cleanup: delete smoke test users (cascades cases/documents/matches/notifications/payments)", async () => {
    await json(`/api/admin/users/${clientUser.id}`, { method: "DELETE" });
    await json(`/api/admin/users/${lawyerUser.id}`, { method: "DELETE" });
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});
