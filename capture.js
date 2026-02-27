const { chromium } = require("playwright");
const fs = require("fs");

(async () => {
  let browser;

  try {
    // read input configuration from server
    const config = JSON.parse(fs.readFileSync("run-config.json", "utf8"));

    const TARGET_URL = config.url;
    const AUTH_FILE = config.authFile;

    console.error("Launching browser...");

    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    console.error("Loading auth state...");

    const context = await browser.newContext({
      storageState: AUTH_FILE,
      viewport: { width: 1366, height: 900 }
    });

    const page = await context.newPage();

    console.error("Opening page:", TARGET_URL);

    await page.goto(TARGET_URL, {
      waitUntil: "domcontentloaded",
      timeout: 120000
    });

    // wait for SPA dashboards to settle
    await page.waitForTimeout(8000);

    console.error("Capturing first fold...");
    await page.screenshot({
      path: "first-fold.png",
      fullPage: false
    });

    console.error("Scrolling...");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(3000);

    console.error("Capturing mid fold...");
    await page.screenshot({
      path: "mid-fold.png",
      fullPage: false
    });

    console.error("Capturing full page...");
    await page.screenshot({
      path: "full-page.png",
      fullPage: true
    });

    await browser.close();

    const result = {
      url: TARGET_URL,
      firstFold: fs.readFileSync("first-fold.png").toString("base64"),
      midFold: fs.readFileSync("mid-fold.png").toString("base64"),
      fullPage: fs.readFileSync("full-page.png").toString("base64")
    };

    fs.writeFileSync("result.json", JSON.stringify(result));

    process.exit(0);

  } catch (err) {
    console.error("CAPTURE FAILED:", err);
    if (browser) await browser.close();
    process.exit(1);
  }
})();