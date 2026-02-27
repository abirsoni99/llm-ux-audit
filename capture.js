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
  console.log("Waiting for page to load...");

  // Wait for products/cards instead of page load
  await page.waitForSelector("img", { timeout: 60000 });

  // Wait additional time for lazy data
  await page.waitForTimeout(6000);
}

async function captureSRP() {
  console.log("Launching browser...");

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage"
    ]
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    storageState: path.join(__dirname, "auth.json"),
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
  });

  const page = await context.newPage();

  try {
    console.log("Opening Buyer MY...");

    await page.goto(
      "https://buyer.indiamart.com/",
      { waitUntil: "domcontentloaded", timeout: 90000 }
    );

    // Detect login redirect
    if (page.url().includes("login")) {
      throw new Error("Login session invalid — redirected to login page");
    }

    await waitForRealContent(page);

    console.log("Capturing first fold...");
    await page.screenshot({
      path: "my1_fold1.png",
      fullPage: false
    });

    console.log("Scrolling page...");
    await autoScroll(page);

    console.log("Capturing full page...");
    await page.screenshot({
      path: "my1_full.png",
      fullPage: true
    });

    // capture mid fold
    console.log("Capturing mid section...");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(3000);

    await page.screenshot({
      path: "my1_mid.png",
      fullPage: false
    });

    console.log("Screenshots saved.");

  } catch (err) {
    console.error("Capture failed:", err.message);
  } finally {
    await browser.close();
  }
}

captureSRP();