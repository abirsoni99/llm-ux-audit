const { chromium, devices } = require("playwright");
const fs = require("fs");
const path = require("path");

(async () => {
  let browser;

  try {

    const jobDir = process.argv[2];
    const config = JSON.parse(
      fs.readFileSync(path.join(jobDir, "run-config.json"), "utf8")
    );

    const TARGET_URL = config.url;
    const AUTH_FILE = config.authFile;
    const DEVICE = config.device || "desktop";

    console.log("Starting capture for:", TARGET_URL);
    console.log("Device:", DEVICE);

    // ---------- launch browser ----------
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-background-networking",
        "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding",
        "--disable-extensions"
      ]
    });

    // ---------- create context ----------
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
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121 Safari/537.36",
        storageState: AUTH_FILE
      });
    }

    const page = await context.newPage();

    // ---------- go to page ----------
    await page.goto(TARGET_URL, {
      waitUntil: "domcontentloaded",
      timeout: 90000
    });

    // ---------- SMART WAIT ----------
    // Wait for network to calm instead of blind timeouts
    try {
      await page.waitForLoadState("networkidle", { timeout: 20000 });
    } catch {
      console.log("Network never fully idle — continuing");
    }

    // Ensure body exists
    await page.waitForSelector("body", { timeout: 20000 });

    // ---------- detect login failure ----------
    const urlNow = page.url();
    if (urlNow.toLowerCase().includes("login")) {
      console.log("LOGIN DETECTED — auth failed");

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

    // ---------- FIRST FOLD ----------
    await page.screenshot({
      path: path.join(jobDir, "first-fold.png"),
      fullPage: false
    });

    // ---------- FULL PAGE ----------
    await page.screenshot({
      path: path.join(jobDir, "full-page.png"),
      fullPage: true
    });

    console.log("Encoding screenshots...");

    const result = {
      url: TARGET_URL,
      device: DEVICE,
      firstFold: fs
        .readFileSync(path.join(jobDir, "first-fold.png"))
        .toString("base64"),
      fullPage: fs
        .readFileSync(path.join(jobDir, "full-page.png"))
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

    if (browser) await browser.close();

    try {
      fs.writeFileSync(
        path.join(process.argv[2], "result.json"),
        JSON.stringify({
          error: "CAPTURE_FAILED",
          message: err.message
        })
      );
    } catch {}

    process.exit(1);
  }
})();