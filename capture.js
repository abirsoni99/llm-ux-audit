—-

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
    const DEVICE = config.device || "desktop";
    const AUTH_FILE = config.authFile; // provided by server.js

    console.log("Starting capture:", TARGET_URL);

    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage"
      ]
    });

    // -------- context --------
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

    // -------- open page --------
    await page.goto(TARGET_URL, {
      waitUntil: "domcontentloaded",
      timeout: 90000
    });

    // give dashboard APIs time
    await page.waitForTimeout(7000);

    // -------- login detection --------
    const loginDetected = await page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      return (
        text.includes("login via otp") ||
        text.includes("enter mobile number") ||
        location.href.includes("login")
      );
    });

    if (loginDetected) {
      console.log("AUTH FAILED");

      fs.writeFileSync(
        path.join(jobDir, "result.json"),
        JSON.stringify({
          error: "AUTH_FAILED",
          message: "Session invalid or expired"
        })
      );

      await browser.close();
      return;
    }

    // wake lazy widgets
    await page.evaluate(async () => {
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise(r => setTimeout(r, 2500));
      window.scrollTo(0, 0);
      await new Promise(r => setTimeout(r, 1500));
    });

    // -------- screenshots --------
    await page.screenshot({
      path: path.join(jobDir, "firstFold.png"),
      fullPage: false
    });

    await page.screenshot({
      path: path.join(jobDir, "fullPage.png"),
      fullPage: true
    });

    const result = {
      url: TARGET_URL,
      device: DEVICE,
      firstFold: fs.readFileSync(path.join(jobDir, "firstFold.png")).toString("base64"),
      fullPage: fs.readFileSync(path.join(jobDir, "fullPage.png")).toString("base64")
    };

    fs.writeFileSync(path.join(jobDir, "result.json"), JSON.stringify(result));

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