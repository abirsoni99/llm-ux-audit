const { chromium } = require("playwright");
const fs = require("fs");

// VERY IMPORTANT:
// stdout must contain ONLY JSON
// All logs must go to stderr
console.log = (...args) => {
  process.stderr.write(args.join(" ") + "\n");
};

(async () => {
  let browser;

  try {
    console.error("Launching browser...");

    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled"
      ]
    });

    console.error("Creating authenticated context...");

    const context = await browser.newContext({
      storageState: "./auth.json",
      viewport: { width: 1366, height: 900 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    });

    const page = await context.newPage();

    // Hide automation fingerprint
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => false
      });
    });

    console.error("Opening logged-in Buyer dashboard...");

    // IMPORTANT: DO NOT USE networkidle (IndiaMART never goes idle)
    await page.goto("https://buyer.indiamart.com", {
      waitUntil: "domcontentloaded",
      timeout: 90000
    });

    // Let SPA actually render dashboard
    console.error("Waiting for dashboard UI to render...");
    await page.waitForTimeout(8000);

    // Optional sanity check
    const url = page.url();
    console.error("Current URL:", url);

    // ---------- SCREENSHOTS ----------

    console.error("Capturing first fold...");
    await page.screenshot({
      path: "first-fold.png",
      fullPage: false
    });

    console.error("Scrolling page...");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(3000);

    console.error("Capturing mid section...");
    await page.screenshot({
      path: "mid-fold.png",
      fullPage: false
    });

    console.error("Scrolling to bottom...");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(4000);

    console.error("Capturing full page...");
    await page.screenshot({
      path: "full-page.png",
      fullPage: true
    });

    await browser.close();

    console.error("Encoding screenshots...");

    const result = {
      firstFold: fs.readFileSync("first-fold.png").toString("base64"),
      midFold: fs.readFileSync("mid-fold.png").toString("base64"),
      fullPage: fs.readFileSync("full-page.png").toString("base64")
    };

    // CRITICAL: Only JSON to stdout
    process.stdout.write(JSON.stringify(result));
    process.stdout.end();

  } catch (err) {
    console.error("CAPTURE ERROR:", err);

    if (browser) {
      await browser.close();
    }

    process.exit(1);
  }
})();