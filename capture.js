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
    const AUTH_FILE = config.authFile;

    console.log("Starting capture:", TARGET_URL);

    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage"
      ]
    });

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

    // Faster initial navigation
    await page.goto(TARGET_URL, {
      waitUntil: "commit",
      timeout: 60000
    });

    // Wait until actual content appears (instead of blind 7s delay)
    await page.waitForFunction(() =>
      document.body.innerText.length > 2500,
      { timeout: 20000 }
    );

    // Detect login page
    const loginDetected = await page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      return (
        text.includes("login via otp") ||
        text.includes("enter mobile number") ||
        location.href.includes("login")
      );
    });

    if (loginDetected) {
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

    // Trigger lazy widgets
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollTo(0, 0));

    // -------- CAPTURE VIEWPORT SEGMENTS (faster than fullPage: true) --------

    const viewportHeight = await page.evaluate(() => window.innerHeight);

    // First fold
    await page.screenshot({
      path: path.join(jobDir, "firstFold.png"),
      fullPage: false
    });

    // Second viewport
    await page.screenshot({
      path: path.join(jobDir, "secondFold.png"),
      clip: {
        x: 0,
        y: viewportHeight,
        width: 1366,
        height: viewportHeight
      }
    });

    // Third viewport
    await page.screenshot({
      path: path.join(jobDir, "thirdFold.png"),
      clip: {
        x: 0,
        y: viewportHeight * 2,
        width: 1366,
        height: viewportHeight
      }
    });

    const result = {
      url: TARGET_URL,
      device: DEVICE,
      firstFold: fs.readFileSync(path.join(jobDir, "firstFold.png")).toString("base64"),
      secondFold: fs.readFileSync(path.join(jobDir, "secondFold.png")).toString("base64"),
      thirdFold: fs.readFileSync(path.join(jobDir, "thirdFold.png")).toString("base64")
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