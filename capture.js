const { chromium, devices } = require("playwright");
const fs = require("fs");
const path = require("path");

(async () => {
  let browser;

  try {

    const jobDir = process.argv[2];
    const configPath = path.join(jobDir, "run-config.json");

    if (!fs.existsSync(configPath)) {
      throw new Error("Missing run-config.json");
    }

    const config = JSON.parse(
      fs.readFileSync(configPath, "utf8")
    );

    const TARGET_URL = config.url;
    const AUTH_FILE = config.authFile;
    const DEVICE = config.device || "desktop";

    console.log("Starting capture for:", TARGET_URL);

    // ---------------- BROWSER ----------------
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage"
      ]
    });

    // ---------------- CONTEXT ----------------
    let context;

    if (DEVICE === "mobile") {
      const iphone = devices["iPhone 13"];
      context = await browser.newContext({
        ...iphone,
        storageState: AUTH_FILE
      });
    } else {
      context = await browser.newContext({
        viewport: { width: 1366, height: 900 },
        locale: "en-IN",
        timezoneId: "Asia/Kolkata",
        storageState: AUTH_FILE
      });
    }

    const page = await context.newPage();

    // ---------------- NAVIGATE ----------------
    await page.goto(TARGET_URL, {
      waitUntil: "domcontentloaded",
      timeout: 90000
    });

    // Wait for dashboard scripts to render
    await page.waitForTimeout(8000);

    // ---------------- LOGIN DETECTION ----------------
    const currentUrl = page.url();

    if (
      currentUrl.toLowerCase().includes("login") ||
      currentUrl.toLowerCase().includes("signin")
    ) {

      console.log("Auth failed — login detected");

      fs.writeFileSync(
        path.join(jobDir, "result.json"),
        JSON.stringify({
          error: "AUTH_FAILED",
          message: "Session expired or invalid cookies"
        })
      );

      await browser.close();
      return;
    }

    // ---------------- SCREENSHOTS ----------------

    await page.screenshot({
      path: path.join(jobDir, "firstFold.png"),
      fullPage: false
    });

    await page.screenshot({
      path: path.join(jobDir, "fullPage.png"),
      fullPage: true
    });

    console.log("Encoding screenshots...");

    const result = {
      url: TARGET_URL,
      device: DEVICE,
      firstFold: fs
        .readFileSync(path.join(jobDir, "firstFold.png"))
        .toString("base64"),
      fullPage: fs
        .readFileSync(path.join(jobDir, "fullPage.png"))
        .toString("base64")
    };

    fs.writeFileSync(
      path.join(jobDir, "result.json"),
      JSON.stringify(result)
    );

    await browser.close();

    console.log("Capture complete");

  } catch (err) {

    console.error("CAPTURE FAILED:", err);

    try {
      fs.writeFileSync(
        path.join(process.argv[2], "result.json"),
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