// Throwaway Playwright-driven browser walkthrough. Not a permanent test — run manually
// against the live dev server: npx tsx scripts/browser-walkthrough.ts
import { chromium } from "playwright";
import { createCanvas } from "@napi-rs/canvas";
import fs from "fs";
import path from "path";

const BASE = "http://localhost:3000";
const STAMP = Date.now();
const SHOT_DIR = "scripts/.walkthrough-screenshots";
fs.mkdirSync(SHOT_DIR, { recursive: true });

function makeFixtureImage(): Buffer {
  const canvas = createCanvas(900, 400);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, 900, 400);
  ctx.fillStyle = "black";
  ctx.font = "28px sans-serif";
  ctx.fillText("MEDICAL BILLING STATEMENT", 30, 50);
  ctx.font = "20px sans-serif";
  ctx.fillText("Patient: Jane Browser-Test", 30, 100);
  ctx.fillText("99213  Office Visit Level 3           $250.00", 30, 190);
  ctx.fillText("99285  Emergency Room Level 5          $1800.00", 30, 220);
  ctx.fillText("Amount Due: $2050.00", 30, 300);
  return canvas.toBuffer("image/png");
}

const consoleErrors: string[] = [];
const networkFailures: string[] = [];

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  page.on("requestfailed", (req) => networkFailures.push(`${req.method()} ${req.url()} -> ${req.failure()?.errorText}`));
  page.on("response", (res) => { if (res.status() >= 500) networkFailures.push(`${res.request().method()} ${res.url()} -> HTTP ${res.status()}`); });

  console.log("=== 1. Landing page: load + scroll-triggered animations ===");
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${SHOT_DIR}/01-hero.png` });

  for (const [i, frac] of [0.25, 0.45, 0.65, 0.85, 1.0].entries()) {
    await page.evaluate((f) => window.scrollTo(0, document.body.scrollHeight * f), frac);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${SHOT_DIR}/0${2 + i}-scroll-${Math.round(frac * 100)}pct.png` });
  }
  console.log(`Console errors after landing page: ${consoleErrors.length}`);

  console.log("\n=== 2. FAQ accordion ===");
  const faqHeading = page.getByText(/frequently asked/i).first();
  if (await faqHeading.count() > 0) {
    await faqHeading.scrollIntoViewIfNeeded();
    const firstQuestion = page.locator("button, [role=button]").filter({ hasText: "?" }).first();
    if (await firstQuestion.count() > 0) {
      await firstQuestion.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SHOT_DIR}/08-faq-expanded.png` });
    }
  }

  console.log("\n=== 3. Register a client ===");
  const email = `browsertest${STAMP}@example.com`;
  const password = "TestPass123";
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Sign Up" }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOT_DIR}/09-auth-signup-form.png` });

  // NOTE: the password field is a `type="text"` input styled with CSS text-security to look
  // masked (not a real type="password"), so it must be targeted by placeholder, not by type.
  await page.locator('input[placeholder="e.g. Dr. Alexander Mercer"]').fill("Browser Test Client");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[placeholder="e.g. ••••••••"]').first().fill(password);
  await page.locator("#terms").check();
  await page.screenshot({ path: `${SHOT_DIR}/10-auth-filled.png` });
  await page.getByRole("button", { name: /Complete Registration/i }).click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOT_DIR}/11-post-register-dashboard.png` });

  const skipGuide = page.getByText(/Skip Guide/i).first();
  if (await skipGuide.count() > 0) {
    await skipGuide.click();
    await page.waitForTimeout(500);
    console.log("   Dismissed the new-user TourGuide overlay.");
  }
  console.log(`Console errors after registration: ${consoleErrors.length}`);

  console.log("\n=== 4. Create a case + real file upload + OCR status ===");
  const newCaseBtn = page.getByRole("button", { name: /New (Dispute|Case)|Create (Dispute|Case)|\+ New|Audit New Bill|File a Case/i }).first();
  if (await newCaseBtn.count() > 0) {
    await newCaseBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOT_DIR}/12-create-case-modal.png` });

    // The "Dispute Case Title" input's placeholder is an example value ("e.g. Apex Hospital ER
    // Overcharge Audit"), not a descriptive hint, so match on that instead of the label text.
    const titleInput = page.locator('input[placeholder*="Apex Hospital" i], input[placeholder*="Overcharge" i]').first();
    if (await titleInput.count() > 0) await titleInput.fill("Browser Walkthrough Test Case");
    else console.log("   Could not find the case title input.");

    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.count() > 0) {
      const fixturePath = path.join(SHOT_DIR, "fixture-bill.png");
      fs.writeFileSync(fixturePath, makeFixtureImage());
      await fileInput.setInputFiles(fixturePath);
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${SHOT_DIR}/13-file-selected.png` });
    } else {
      console.log("   Could not find a file input in the create-case modal.");
    }

    const submitCaseBtn = page.getByRole("button", { name: /Create|Submit|Save/i }).last();
    if (await submitCaseBtn.count() > 0) {
      await submitCaseBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${SHOT_DIR}/14-case-created.png` });
    }

    console.log("   Waiting up to 30s for OCR/validation status to resolve in the UI...");
    await page.waitForTimeout(15000);
    await page.screenshot({ path: `${SHOT_DIR}/15-ocr-status-after-wait.png` });
  } else {
    console.log("   Could not find a 'New Case' button — screenshotting current dashboard state.");
    await page.screenshot({ path: `${SHOT_DIR}/12-dashboard-no-new-case-button.png` });
  }
  console.log(`Console errors after case/upload flow: ${consoleErrors.length}`);

  console.log("\n=== 5. Generate a document (simulated payment -> deterministic engine) ===");
  const caseCard = page.getByText("Browser Walkthrough Test Case").first();
  if (await caseCard.count() > 0) {
    await caseCard.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SHOT_DIR}/17b-case-selected.png` });
  }
  const generateBtn = page.getByRole("button", { name: /Generate Dispute Document/i }).first();
  if (await generateBtn.count() > 0) {
    await generateBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOT_DIR}/18-payment-modal-or-doc.png` });

    const cardNumberInput = page.locator('input[placeholder*="4242" i]').first();
    if (await cardNumberInput.count() > 0) {
      console.log("   Payment modal appeared — filling simulated card details.");
      const billingEmailInput = page.locator('input[type="email"]').first();
      if (await billingEmailInput.count() > 0) await billingEmailInput.fill(email);
      const allTextInputs = page.locator('form input[type="text"], .fixed input[type="text"]');
      const cardNameCount = await allTextInputs.count();
      if (cardNameCount > 0) await allTextInputs.first().fill("Browser Test Client");
      await cardNumberInput.fill("4242424242424242");
      await page.locator('input[placeholder*="12/29" i], input[placeholder*="MM" i]').first().fill("12/28");
      await page.locator('input[placeholder="e.g. 123"]').first().fill("123");
      await page.screenshot({ path: `${SHOT_DIR}/19-payment-filled.png` });

      const payBtn = page.getByRole("button", { name: /Pay|Confirm|Submit Payment/i }).last();
      if (await payBtn.count() > 0) {
        await payBtn.click();
        await page.waitForTimeout(3000);
        await page.screenshot({ path: `${SHOT_DIR}/20-document-generated.png` });
      }
    } else {
      console.log("   No payment modal detected — document may have generated directly, or hasFiles check blocked it.");
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${SHOT_DIR}/20-document-generated.png` });
    }
  } else {
    console.log("   Could not find the 'Generate Dispute Document' button.");
  }
  console.log(`Console errors after document generation flow: ${consoleErrors.length}`);

  console.log("\n=== 6. Notifications dropdown ===");
  const notifBell = page.getByRole("button", { name: /Recent Activities|Notifications/i }).first();
  if (await notifBell.count() > 0) {
    await notifBell.click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${SHOT_DIR}/21-notifications-dropdown.png` });
    await page.keyboard.press("Escape").catch(() => {});
  }

  console.log("\n=== 7. Lawyer + clinic registration (dashboard load check) ===");
  const logoutForNextRole = page.getByRole("button", { name: /Logout/i }).first();
  if (await logoutForNextRole.count() > 0) { await logoutForNextRole.click(); await page.waitForTimeout(1000); }

  for (const roleInfo of [
    { role: "Injury Lawyer", email: `browserlawyer${STAMP}@example.com`, shot: "22-lawyer-dashboard.png" },
    { role: "Clinic Biller", email: `browserclinic${STAMP}@example.com`, shot: "23-clinic-dashboard.png" },
  ]) {
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Sign Up" }).click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: roleInfo.role, exact: true }).click();
    if (roleInfo.role === "Injury Lawyer") {
      const licenseInput = page.locator('input[placeholder*="BAR-" i]').first();
      if (await licenseInput.count() > 0) await licenseInput.fill(`BAR-TEST-${STAMP}`);
    }
    await page.locator('input[placeholder="e.g. Dr. Alexander Mercer"]').fill(`Browser Test ${roleInfo.role}`);
    // Lawyer/clinic sign-up requires a practice/facility name (frontend `required` attribute).
    const orgNameInput = page.locator('input[placeholder*="Mercer Legal" i], input[placeholder*="Apex Health" i]').first();
    if (await orgNameInput.count() > 0) await orgNameInput.fill(`Browser Test ${roleInfo.role} Practice`);
    await page.locator('input[type="email"]').fill(roleInfo.email);
    await page.locator('input[placeholder="e.g. ••••••••"]').first().fill(password);
    await page.locator("#terms").check();
    await page.getByRole("button", { name: /Complete Registration/i }).click();
    await page.waitForTimeout(2500);
    const skip = page.getByText(/Skip Guide/i).first();
    if (await skip.count() > 0) await skip.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOT_DIR}/${roleInfo.shot}` });
    console.log(`   ${roleInfo.role} dashboard loaded. Console errors so far: ${consoleErrors.length}`);

    const logoutAfterRole = page.getByRole("button", { name: /Logout/i }).first();
    if (await logoutAfterRole.count() > 0) { await logoutAfterRole.click(); await page.waitForTimeout(1000); }
  }

  console.log("\n=== 8. Admin dashboard: metrics + user management + database explorer ===");
  const logoutBtn = page.getByRole("button", { name: /Logout/i }).first();
  if (await logoutBtn.count() > 0) { await logoutBtn.click(); await page.waitForTimeout(1000); }
  await page.getByRole("button", { name: "Login" }).click();
  await page.waitForTimeout(500);
  await page.locator('input[type="email"]').fill("maheenu2317@gmail.com");
  await page.locator('input[placeholder="e.g. ••••••••"]').first().fill("maheen322005");
  const adminRoleBtn = page.getByRole("button", { name: /^Admin$/i }).first();
  if (await adminRoleBtn.count() > 0) await adminRoleBtn.click();
  await page.getByRole("button", { name: /Enter Workspace/i }).click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOT_DIR}/16-admin-dashboard.png` });

  const dbExplorerLink = page.getByText(/Database Explorer|Database/i).first();
  if (await dbExplorerLink.count() > 0) {
    await dbExplorerLink.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOT_DIR}/17-admin-database-explorer.png` });
  } else {
    console.log("   Could not find a Database Explorer nav item.");
  }
  console.log(`Console errors after admin flow: ${consoleErrors.length}`);

  console.log(`\n=== Summary ===`);
  console.log(`Total console errors: ${consoleErrors.length}`);
  consoleErrors.slice(0, 30).forEach((e) => console.log("  console error:", e));
  console.log(`Total network failures/5xx: ${networkFailures.length}`);
  networkFailures.slice(0, 30).forEach((e) => console.log("  network failure:", e));
  console.log(`\nScreenshots saved to ${SHOT_DIR}/`);

  await browser.close();
}

main().catch((err) => {
  console.error("Browser walkthrough crashed:", err);
  console.log(`Console errors so far: ${consoleErrors.length}`);
  consoleErrors.forEach((e) => console.log("  console error:", e));
  process.exit(1);
});
