// Throwaway Playwright script covering: (1) mobile/responsive rendering of the landing page
// and a dashboard, (2) the full matchmaking request/accept flow through the real UI between
// a client and a lawyer, (3) lawyer-side document generation.
// Run: npx tsx scripts/mobile-and-matchmaking-test.ts
import { chromium } from "playwright";
import { createCanvas } from "@napi-rs/canvas";
import fs from "fs";
import path from "path";

const BASE = "http://localhost:3000";
const STAMP = Date.now();
const SHOT_DIR = "scripts/.walkthrough-screenshots";
fs.mkdirSync(SHOT_DIR, { recursive: true });
const password = "TestPass123";

function makeFixtureImage(): Buffer {
  const canvas = createCanvas(900, 400);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, 900, 400);
  ctx.fillStyle = "black";
  ctx.font = "24px sans-serif";
  ctx.fillText("MEDICAL BILLING STATEMENT", 30, 50);
  ctx.fillText("99213  Office Visit Level 3    $250.00", 30, 150);
  ctx.fillText("99285  Emergency Room Level 5   $1800.00", 30, 190);
  return canvas.toBuffer("image/png");
}

const consoleErrors: string[] = [];
const networkFailures: string[] = [];

function wireLogging(page: any, label: string) {
  page.on("console", (msg: any) => { if (msg.type() === "error") consoleErrors.push(`[${label}] ${msg.text()}`); });
  page.on("requestfailed", (req: any) => networkFailures.push(`[${label}] ${req.method()} ${req.url()} -> ${req.failure()?.errorText}`));
  page.on("response", (res: any) => { if (res.status() >= 500) networkFailures.push(`[${label}] ${res.request().method()} ${res.url()} -> HTTP ${res.status()}`); });
}

async function loginAsRole(page: any, role: "Client" | "Injury Lawyer" | "Clinic Biller", email: string) {
  // Full logout + fresh login (not page.reload()) — the app caches the session in localStorage
  // and only refetches on explicit actions, so a plain reload would still show the stale
  // pre-upgrade planId. A real user's own "Confirm & Pay" flow updates state directly instead;
  // this simulates a returning user picking up a plan change made through another channel (e.g.
  // an admin console) which is exactly what page.reload() does NOT do.
  const logoutBtn = page.getByRole("button", { name: /Logout/i }).first();
  if (await logoutBtn.count() > 0) { await logoutBtn.click(); await page.waitForTimeout(800); }
  else await page.goto(BASE, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Login" }).click();
  await page.waitForTimeout(400);
  if (role !== "Client") await page.getByRole("button", { name: role, exact: true }).click();
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[placeholder="e.g. ••••••••"]').first().fill(password);
  await page.getByRole("button", { name: /Enter Workspace/i }).click();
  await page.waitForTimeout(1500);
}

async function registerAndDismissTour(page: any, role: "Client" | "Injury Lawyer" | "Clinic Biller", name: string, email: string, extra?: { license?: string; org?: string }) {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Sign Up" }).click();
  await page.waitForTimeout(400);
  if (role !== "Client") await page.getByRole("button", { name: role, exact: true }).click();
  if (extra?.license) await page.locator('input[placeholder*="BAR-" i]').first().fill(extra.license);
  await page.locator('input[placeholder="e.g. Dr. Alexander Mercer"]').fill(name);
  if (role !== "Client") {
    const orgInput = page.locator('input[placeholder*="Mercer Legal" i], input[placeholder*="Apex Health" i]').first();
    if (await orgInput.count() > 0) await orgInput.fill(extra?.org || `${name} Practice`);
  }
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[placeholder="e.g. ••••••••"]').first().fill(password);
  await page.locator("#terms").check();
  await page.getByRole("button", { name: /Complete Registration/i }).click();
  await page.waitForTimeout(2000);
  const skip = page.getByText(/Skip Guide/i).first();
  if (await skip.count() > 0) { await skip.click(); await page.waitForTimeout(400); }
}

async function upgradeViaApi(email: string, role: string, planId: string) {
  // Upgrading via the real API mirrors what "Confirm & Pay" does client-side (calls the same
  // endpoint) — used here to unlock matchmaking without re-driving the payment modal for the
  // third time in this test suite; the payment modal itself was already UI-tested separately.
  const rLogin = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, role }) }).catch((e) => { console.log("   [debug] login fetch threw:", e.message); return null; });
  console.log(`   [debug] login status for ${email}: ${rLogin?.status}`);
  const user = rLogin ? await rLogin.json() : null;
  if (!user?.id) { console.log("   [debug] login response body:", JSON.stringify(user)); return null; }
  const rUpg = await fetch(`${BASE}/api/billing/upgrade-plan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id, planId }) });
  console.log(`   [debug] upgrade status for ${email}: ${rUpg.status}`, await rUpg.text());
  return user.id;
}

async function main() {
  const browser = await chromium.launch();

  console.log("=== PART A: Mobile/responsive rendering ===");
  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 }, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15" });
  wireLogging(mobilePage, "mobile");
  await mobilePage.goto(BASE, { waitUntil: "networkidle" });
  await mobilePage.screenshot({ path: `${SHOT_DIR}/m01-landing-mobile.png` });
  for (const frac of [0.3, 0.6, 1.0]) {
    await mobilePage.evaluate((f) => window.scrollTo(0, document.body.scrollHeight * f), frac);
    await mobilePage.waitForTimeout(500);
    await mobilePage.screenshot({ path: `${SHOT_DIR}/m02-landing-mobile-scroll-${Math.round(frac * 100)}.png` });
  }
  const bodyOverflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  console.log(`   Horizontal overflow on landing page (mobile): ${bodyOverflow ? "YES — BUG" : "no, clean"}`);

  const mobileEmail = `mobiletest${STAMP}@example.com`;
  await registerAndDismissTour(mobilePage, "Client", "Mobile Test Client", mobileEmail);
  await mobilePage.screenshot({ path: `${SHOT_DIR}/m03-dashboard-mobile.png` });
  const dashOverflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  console.log(`   Horizontal overflow on client dashboard (mobile): ${dashOverflow ? "YES — BUG" : "no, clean"}`);
  console.log(`   Console errors so far: ${consoleErrors.length}`);
  await mobilePage.close();

  console.log("\n=== PART B: Full matchmaking flow (client <-> lawyer) through the real UI ===");
  const clientPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  wireLogging(clientPage, "client");
  const lawyerPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  wireLogging(lawyerPage, "lawyer");

  const clientEmail = `matchclient${STAMP}@example.com`;
  const lawyerEmail = `matchlawyer${STAMP}@example.com`;

  console.log("   Registering client + lawyer...");
  await registerAndDismissTour(clientPage, "Client", "Match Test Client", clientEmail);
  await registerAndDismissTour(lawyerPage, "Injury Lawyer", "Match Test Lawyer", lawyerEmail, { license: `BAR-MATCH-${STAMP}` });

  console.log("   Upgrading both to paid plans via API (unlocks matchmaking; payment modal itself already UI-tested)...");
  await upgradeViaApi(clientEmail, "client", "clinic"); // any non-free plan unlocks matching per server logic
  await upgradeViaApi(lawyerEmail, "lawyer", "lawyer");
  await loginAsRole(clientPage, "Client", clientEmail);
  await loginAsRole(lawyerPage, "Injury Lawyer", lawyerEmail);

  console.log("   Enabling matchmaking consent on both sides...");
  const clientEnableBtn = clientPage.getByRole("button", { name: /Enable Matchmaking/i }).first();
  if (await clientEnableBtn.count() > 0) { await clientEnableBtn.click(); await clientPage.waitForTimeout(1000); }
  const lawyerEnableBtn = lawyerPage.getByRole("button", { name: /Enable Marketplace Listing/i }).first();
  if (await lawyerEnableBtn.count() > 0) { await lawyerEnableBtn.click(); await lawyerPage.waitForTimeout(1000); }
  await clientPage.screenshot({ path: `${SHOT_DIR}/mm01-client-consent-enabled.png` });
  await lawyerPage.screenshot({ path: `${SHOT_DIR}/mm02-lawyer-consent-enabled.png` });

  console.log("   Client sends a match request to the lawyer...");
  await clientPage.reload({ waitUntil: "networkidle" });
  await clientPage.waitForTimeout(1000);
  // Target the exact lawyer created in this run by license number — the candidates list can
  // otherwise contain leftover test accounts from other runs with the same display name.
  const lawyerLicense = `BAR-MATCH-${STAMP}`;
  const candidateCard = clientPage.locator(`text=${lawyerLicense}`).locator("xpath=ancestor::*[.//button[contains(., 'Send Match Request')]][1]");
  const sendRequestBtn = candidateCard.getByRole("button", { name: /Send Match Request/i }).first();
  if (await sendRequestBtn.count() > 0) {
    await sendRequestBtn.click();
    await clientPage.waitForTimeout(1500);
    await clientPage.screenshot({ path: `${SHOT_DIR}/mm03-client-request-sent.png` });
    console.log("   Match request sent.");
  } else {
    console.log("   Could not find 'Send Match Request' button — candidate may not have appeared yet.");
    await clientPage.screenshot({ path: `${SHOT_DIR}/mm03-no-candidates.png` });
  }

  console.log("   Lawyer accepts the request...");
  await lawyerPage.reload({ waitUntil: "networkidle" });
  await lawyerPage.waitForTimeout(1000);
  await lawyerPage.screenshot({ path: `${SHOT_DIR}/mm04-lawyer-incoming-request.png` });
  const acceptBtn = lawyerPage.getByRole("button", { name: /Accept (Request|Connection)/i }).first();
  if (await acceptBtn.count() > 0) {
    await acceptBtn.click();
    await lawyerPage.waitForTimeout(1500);
    await lawyerPage.screenshot({ path: `${SHOT_DIR}/mm05-lawyer-accepted.png` });
    console.log("   Lawyer accepted the match.");
  } else {
    console.log("   Could not find 'Accept Request' button on the lawyer side.");
  }

  console.log("   Verifying match shows as 'Assigned' on the client side...");
  await clientPage.reload({ waitUntil: "networkidle" });
  await clientPage.waitForTimeout(1000);
  await clientPage.screenshot({ path: `${SHOT_DIR}/mm06-client-match-assigned.png` });
  const assignedText = clientPage.getByText(/Assigned/i).first();
  console.log(`   Client sees 'Assigned' status: ${(await assignedText.count()) > 0 ? "YES" : "NO — check screenshot"}`);

  console.log(`\nConsole errors so far: ${consoleErrors.length}`);

  console.log("\n=== PART C: Lawyer-side case + document generation via UI ===");
  const newCaseBtn = lawyerPage.getByRole("button", { name: /Create Litigation Case File|New (Dispute|Case)/i }).first();
  if (await newCaseBtn.count() > 0) {
    await newCaseBtn.click();
    await lawyerPage.waitForTimeout(500);
    const titleInput = lawyerPage.locator('input[placeholder*="Apex Hospital" i], input[placeholder*="Overcharge" i], input[placeholder*="Miller v." i]').first();
    if (await titleInput.count() > 0) await titleInput.fill("Lawyer UI Test Case");
    // Unlike the client dashboard (patientName defaults to the logged-in user's own name), the
    // lawyer's case modal requires an explicit "Injured Client Full Name" with no default.
    const clientNameInput = lawyerPage.locator('input[placeholder*="Alice Miller" i]').first();
    if (await clientNameInput.count() > 0) await clientNameInput.fill("Alice Test Patient");
    const fileInput = lawyerPage.locator('input[type="file"]').first();
    if (await fileInput.count() > 0) {
      const fixturePath = path.join(SHOT_DIR, "fixture-bill-lawyer.png");
      fs.writeFileSync(fixturePath, makeFixtureImage());
      await fileInput.setInputFiles(fixturePath);
      await lawyerPage.waitForTimeout(1000);
    }
    await lawyerPage.screenshot({ path: `${SHOT_DIR}/lw00-before-submit.png` });
    const submitBtn = lawyerPage.getByRole("button", { name: /Create|Submit|Save|Establish/i }).last();
    if (await submitBtn.count() > 0) {
      await submitBtn.click({ timeout: 5000 }).catch(async (e) => {
        console.log("   [debug] submit click failed:", e.message.split("\n")[0]);
        await lawyerPage.screenshot({ path: `${SHOT_DIR}/lw00b-submit-blocked.png` });
      });
      await lawyerPage.waitForTimeout(2000);
    }
    console.log("   Waiting for OCR/validation...");
    await lawyerPage.waitForTimeout(15000);
    await lawyerPage.screenshot({ path: `${SHOT_DIR}/lw01-lawyer-case-created.png` });

    const caseCard = lawyerPage.getByText("Lawyer UI Test Case").first();
    if (await caseCard.count() > 0) { await caseCard.click(); await lawyerPage.waitForTimeout(800); }
    const generateBtn = lawyerPage.getByRole("button", { name: /Generate/i }).first();
    if (await generateBtn.count() > 0) {
      await generateBtn.click();
      await lawyerPage.waitForTimeout(1500);
      await lawyerPage.screenshot({ path: `${SHOT_DIR}/lw02-lawyer-generate-clicked.png` });
      // Lawyer plan has monthly credits included — may skip the payment modal entirely.
      const payBtn = lawyerPage.getByRole("button", { name: /Pay|Confirm|Submit Payment/i }).last();
      if (await payBtn.count() > 0 && await payBtn.isVisible().catch(() => false)) {
        const cardNumberInput = lawyerPage.locator('input[placeholder*="4242" i]').first();
        if (await cardNumberInput.count() > 0) {
          await lawyerPage.locator('input[type="text"]').first().fill("Match Test Lawyer");
          await cardNumberInput.fill("4242424242424242");
          await lawyerPage.locator('input[placeholder*="12/29" i]').first().fill("12/28");
          await lawyerPage.locator('input[placeholder="e.g. 123"]').first().fill("123");
          await payBtn.click();
          await lawyerPage.waitForTimeout(3000);
        }
      }
      await lawyerPage.screenshot({ path: `${SHOT_DIR}/lw03-lawyer-document-generated.png` });
      console.log("   Lawyer document generation flow completed.");
    } else {
      console.log("   Could not find a Generate button on lawyer dashboard.");
    }
  } else {
    console.log("   Could not find a 'Create Litigation Case File' button.");
  }
  console.log(`Console errors so far: ${consoleErrors.length}`);

  console.log(`\n=== Summary ===`);
  console.log(`Total console errors: ${consoleErrors.length}`);
  consoleErrors.forEach((e) => console.log("  console error:", e));
  console.log(`Total network failures/5xx: ${networkFailures.length}`);
  networkFailures.forEach((e) => console.log("  network failure:", e));

  await browser.close();
}

main().catch((err) => {
  console.error("Test crashed:", err);
  console.log(`Console errors so far: ${consoleErrors.length}`);
  consoleErrors.forEach((e) => console.log("  console error:", e));
  process.exit(1);
});
