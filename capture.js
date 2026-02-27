const { chromium, devices } = require("playwright");
const fs = require("fs");

(async () => {
  let browser;

  try {
    const jobDir = process.argv[2];
const config = JSON.parse(fs.readFileSync(`${jobDir}/run-config.json`, "utf8"));

    const TARGET_URL = config.url;
    const AUTH_FILE = config.authFile;
    const DEVICE = config.device || "desktop";

    console.error("Launching browser...");
    console.error("Device mode:", DEVICE);

    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu"
      ]
    });

    let context;

    // ---------- MOBILE MODE ----------
    if (DEVICE === "mobile") {
      console.error("Using mobile emulation");

      const iphone = devices["iPhone 13"];

      context = await browser.newContext({
        ...iphone,
        storageState: AUTH_FILE
      });
    }

    // ---------- DESKTOP MODE ----------
    else {
      console.error("Using desktop viewport");

      context = await browser.newContext({
        viewport: { width: 1366, height: 900 },
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121 Safari/537.36",
        storageState: AUTH_FILE
      });
    }

    const page = await context.newPage();

    console.error("Opening:", TARGET_URL);

    await page.goto(TARGET_URL, {
      waitUntil: "domcontentloaded",
      timeout: 120000
    });

    // SPA settle time
    await page.waitForTimeout(7000);

    console.error("Capturing first fold...");
    await page.screenshot({
      path: "first-fold.png",
      fullPage: false
    });

    console.error("Scrolling mid...");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(3000);

    await page.screenshot({
      path: "mid-fold.png",
      fullPage: false
    });

    console.error("Scrolling bottom...");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(3000);

    await page.screenshot({
      path: "full-page.png",
      fullPage: false
    });

    await browser.close();

    const result = {
      url: TARGET_URL,
      device: DEVICE,
      firstFold: fs.readFileSync("first-fold.png").toString("base64"),
      midFold: fs.readFileSync("mid-fold.png").toString("base64"),
      fullPage: fs.readFileSync("full-page.png").toString("base64")
    };

    fs.writeFileSync("${jobDir}/result.json", JSON.stringify(result));

    console.error("Capture complete");

    process.exit(0);

  } catch (err) {
    console.error("CAPTURE FAILED:", err);
    if (browser) await browser.close();
    process.exit(1);
  }
})();