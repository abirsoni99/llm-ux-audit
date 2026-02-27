const { chromium } = require("playwright");
const fs = require("fs");

process.setMaxListeners(0);

/*
CRITICAL RULE:
stdout MUST contain ONLY JSON
Everything else goes to stderr
*/
console.log = (...args) => {
  process.stderr.write(args.join(" ") + "\n");
};

(async () => {
  let browser;

  try {
    const TARGET_URL =
      process.argv[2] || "https://buyer.indiamart.com";

    console.error("Launching browser...");

    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-features=IsolateOrigins,site-per-process",
        "--disable-background-networking",
        "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding",
        "--disable-extensions",
        "--disable-sync",
        "--metrics-recording-only",
        "--mute-audio",
        "--no-zygote",
        "--single-process"
      ]
    });

    console.error("Loading stored login session (auth.json)...");

    const context = await browser.newContext({
      storageState: fs.existsSync("auth.json") ? "auth.json" : undefined,
      viewport: { width: 1366, height: 900 }
    });

    const page = await context.newPage();

    console.error("Opening:", TARGET_URL);

    await page.goto(TARGET_URL, {
      waitUntil: "domcontentloaded",
      timeout: 120000
    });

    /*
    UNIVERSAL WAIT STRATEGY
    We wait until:
    - DOM exists
    - Page height stabilizes
    - Network quiets down enough
    */

    console.error("Waiting for page render stabilization...");

    await page.waitForTimeout(5000);

    // wait for DOM body
    await page.waitForSelector("body", { timeout: 60000 });

    // wait for page height stabilization (SPA friendly)
    let previousHeight = 0;
    let stableCount = 0;

    for (let i = 0; i < 20; i++) {
      const height = await page.evaluate(
        () => document.body.scrollHeight
      );

      if (height === previousHeight) {
        stableCount++;
      } else {
        stableCount = 0;
      }

      previousHeight = height;

      if (stableCount >= 3) break;

      await page.waitForTimeout(2000);
    }

    console.error("Page stabilized. Starting screenshots...");

    // -------- First Fold --------
    await page.screenshot({
      path: "first-fold.png",
      fullPage: false
    });

    // -------- Mid Scroll --------
    await page.evaluate(() =>
      window.scrollTo(0, document.body.scrollHeight / 2)
    );
    await page.waitForTimeout(3000);

    await page.screenshot({
      path: "mid-fold.png",
      fullPage: false
    });

    // -------- Bottom --------
    await page.evaluate(() =>
      window.scrollTo(0, document.body.scrollHeight)
    );
    await page.waitForTimeout(3000);

    await page.screenshot({
      path: "full-page.png",
      fullPage: false
    });

    console.error("Encoding screenshots...");

    const result = {
      url: TARGET_URL,
      timestamp: Date.now(),
      firstFold: fs.readFileSync("first-fold.png").toString("base64"),
      midFold: fs.readFileSync("mid-fold.png").toString("base64"),
      fullPage: fs.readFileSync("full-page.png").toString("base64")
    };

    await browser.close();

    // ONLY JSON OUTPUT
    process.stdout.write(JSON.stringify(result));
    process.stdout.end();

  } catch (err) {
    console.error("CAPTURE FAILED:", err);

    if (browser) await browser.close();

    process.exit(1);
  }
})();