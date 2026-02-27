const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

// Redirect ALL console.log to stderr
// Prevents stdout contamination
console.log = (...args) => {
  process.stderr.write(args.join(" ") + "\n");
};

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 700;

      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 800);
    });
  });
}

(async () => {
  let browser;

  try {
    console.error("Launching browser...");

    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu"
      ]
    });

    // ⭐ Inject logged-in session
    const context = await browser.newContext({
      storageState: path.join(__dirname, "auth.json"),
      viewport: { width: 1366, height: 900 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
    });

    const page = await context.newPage();

    console.error("Opening logged-in Buyer dashboard...");

    await page.goto("https://buyer.indiamart.com/", {
      waitUntil: "networkidle",
      timeout: 120000
    });

    console.error("Waiting for hydration...");
    await page.waitForTimeout(12000);

    // First fold
    await page.screenshot({
      path: "first-fold.png",
      fullPage: false
    });

    // Scroll for lazy modules
    await autoScroll(page);
    await page.waitForTimeout(6000);

    // Full page
    await page.screenshot({
      path: "full-page.png",
      fullPage: true
    });

    // Mid section
    await page.evaluate(() =>
      window.scrollTo(0, document.body.scrollHeight / 2)
    );
    await page.waitForTimeout(3000);

    await page.screenshot({
      path: "mid-fold.png",
      fullPage: false
    });

    await browser.close();

    console.error("Encoding screenshots...");

    const result = {
      firstFold: fs.readFileSync("first-fold.png").toString("base64"),
      midFold: fs.readFileSync("mid-fold.png").toString("base64"),
      fullPage: fs.readFileSync("full-page.png").toString("base64")
    };

    // Write JSON to file instead of stdout
    fs.writeFileSync("result.json", JSON.stringify(result));

    process.exit(0);

  } catch (err) {
    console.error("CAPTURE FAILED:", err);

    if (browser) await browser.close();
    process.exit(1);
  }
})();