const { chromium, devices } = require("playwright");
const fs = require("fs");
const path = require("path");

(async () => {
  let browser;

  try {
    /* ------------------------- VALIDATE ARGUMENT ------------------------- */

    const jobDir = process.argv[2];

    if (!jobDir) {
      throw new Error("capture.js requires a job directory argument");
    }

    const configPath = path.join(jobDir, "run-config.json");

    if (!fs.existsSync(configPath)) {
      throw new Error("Missing run-config.json inside job directory");
    }

    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

    const TARGET_URL = config.url;
    const DEVICE = config.device || "desktop";
    const AUTH_FILE = path.resolve(jobDir, config.authFile);

    if (!TARGET_URL) throw new Error("No url provided");
    if (!fs.existsSync(AUTH_FILE)) throw new Error("auth.json not found");

    console.error("Capture starting for:", TARGET_URL);

    /* ------------------------- LAUNCH BROWSER ------------------------- */

    browser = await chromium.launch({
      headless: true, // IMPORTANT: Railway must stay headless
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled"
      ]
    });

    /* ------------------------- CONTEXT (DEVICE) ------------------------- */

    let context;

    if (DEVICE === "mobile") {
      const iphone = devices["iPhone 13"];
      context = await browser.newContext({
        ...iphone,
        storageState: AUTH_FILE,
        locale: "en-IN",
        timezoneId: "Asia/Kolkata"
      });
    } else {
      context = await browser.newContext({
        viewport: { width: 1366, height: 900 },
        storageState: AUTH_FILE,
        locale: "en-IN",
        timezoneId: "Asia/Kolkata"
      });
    }

    const page = await context.newPage();

    /* ------------------------- NAVIGATION ------------------------- */

    console.error("Opening page...");
    await page.goto(TARGET_URL, {
      waitUntil: "domcontentloaded",
      timeout: 90000
    });

    await page.waitForSelector("body", { timeout: 60000 });

    /* ------------------------- WAIT FOR REAL LOAD ------------------------- */
    // IndiaMART loads content AFTER initial render

    console.error("Waiting for dashboard to load...");

    // wait text density (real content)
    await page.waitForFunction(() => {
      return document.body.innerText.length > 3000;
    }, { timeout: 90000 });

    // scroll to trigger lazy widgets
    await page.evaluate(async () => {
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise(r => setTimeout(r, 3000));
      window.scrollTo(0, 0);
    });

    /* ------------------------- LOGIN DETECTION ------------------------- */

    const loginDetected = await page.evaluate(() => {
      const t = document.body.innerText.toLowerCase();
      return (
        t.includes("login via otp") ||
        t.includes("enter mobile number") ||
        t.includes("verify mobile") ||
        t.includes("sign in")
      );
    });

    if (loginDetected) {
      console.error("LOGIN PAGE DETECTED — cookies invalid");

      fs.writeFileSync(
        path.join(jobDir, "result.json"),
        JSON.stringify({
          error: "AUTH_FAILED",
          message: "Cookies invalid or expired"
        })
      );

      await browser.close();
      return;
    }

    /* ------------------------- SCREENSHOTS ------------------------- */

    console.error("Taking screenshots...");

    const firstFoldPath = path.join(jobDir, "firstFold.png");
    const fullPagePath = path.join(jobDir, "fullPage.png");

    // first fold
    await page.screenshot({
      path: firstFoldPath,
      fullPage: false
    });

    // full page
    await page.screenshot({
      path: fullPagePath,
      fullPage: true
    });

    /* ------------------------- VERIFY FILES ------------------------- */

    if (!fs.existsSync(firstFoldPath) || !fs.existsSync(fullPagePath)) {
      throw new Error("Screenshots were not generated");
    }

    /* ------------------------- ENCODE RESULT ------------------------- */

    console.error("Encoding screenshots...");

    const result = {
      url: TARGET_URL,
      device: DEVICE,
      firstFold: fs.readFileSync(firstFoldPath).toString("base64"),
      fullPage: fs.readFileSync(fullPagePath).toString("base64")
    };

    fs.writeFileSync(
      path.join(jobDir, "result.json"),
      JSON.stringify(result)
    );

    console.error("Capture successful");
    await browser.close();

  } catch (err) {

    console.error("CAPTURE FAILED:", err.message);

    try {
      const jobDir = process.argv[2] || ".";
      fs.writeFileSync(
        path.join(jobDir, "result.json"),
        JSON.stringify({
          error: "CAPTURE_FAILED",
          message: err.message
        })
      );
    } catch {}

    if (browser) await browser.close();
    process.exit(1);
  }
})();