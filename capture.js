const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 700;

      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 700);
    });
  });
}

async function waitForRealContent(page) {
  console.error("Waiting for real content...");
  await page.waitForSelector("img", { timeout: 60000 });
  await page.waitForTimeout(6000);
}

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    storageState: path.join(__dirname, "auth.json"),
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
  });

  const page = await context.newPage();

  try {
    console.error("Opening Buyer MY...");
    await page.goto(
      "https://buyer.indiamart.com",
      { waitUntil: "domcontentloaded", timeout: 90000 }
    );

    if (page.url().includes("/login")) {
      throw new Error("Session expired — login required");
    }

    await waitForRealContent(page);

    console.error("Capturing first fold...");
    await page.screenshot({
      path: "first-fold.png",
      fullPage: false
    });

    console.error("Scrolling page...");
    await autoScroll(page);

    console.error("Capturing full page...");
    await page.screenshot({
      path: "full-page.png",
      fullPage: true
    });

    console.error("Capturing mid fold...");
    await page.evaluate(() =>
      window.scrollTo(0, document.body.scrollHeight / 2)
    );
    await page.waitForTimeout(3000);

    await page.screenshot({
      path: "mid-fold.png",
      fullPage: false
    });

    await browser.close();

    const result = {
      firstFold: fs.readFileSync("first-fold.png").toString("base64"),
      midFold: fs.readFileSync("mid-fold.png").toString("base64"),
      fullPage: fs.readFileSync("full-page.png").toString("base64")
    };

    // IMPORTANT: Only JSON on stdout
    process.stdout.write(JSON.stringify(result));

    process.exit(0);
  } catch (err) {
    console.error("Capture failed:", err.message);
    await browser.close();
    process.exit(1);
  }
}

run();