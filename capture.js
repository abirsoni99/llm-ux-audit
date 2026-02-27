const { chromium } = require('playwright');

/* ================== CHANGE ONLY THIS ================== */
const TARGET_URL = "https://buyer.indiamart.com/";
/* ====================================================== */


/* ---------- HUMAN SCROLL (CRITICAL FOR LAZY LOAD) ---------- */
async function humanScroll(page) {

  console.log("Starting full page human scroll...");

  let previousHeight = 0;

  while (true) {

    const pageHeight = await page.evaluate(() => document.body.scrollHeight);

    // scroll gradually to trigger lazy loading
    for (let y = 0; y < pageHeight; y += 450) {
      await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
      await page.waitForTimeout(700);
    }

    // wait for API calls that load more cards/orders
    await page.waitForTimeout(3500);

    const newHeight = await page.evaluate(() => document.body.scrollHeight);

    if (newHeight === previousHeight) {
      break;
    }

    previousHeight = newHeight;
  }

  console.log("Reached end of dashboard content.");

  // scroll back to top for clean screenshot
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(2000);
}
/* ----------------------------------------------------------- */


(async () => {

  console.log("Launching browser using saved login session...");

  const browser = await chromium.launch({
    headless: true
  });

  const context = await browser.newContext({
    storageState: 'auth.json', // uses cookies saved from loginSave.js
    viewport: { width: 1440, height: 900 }
  });

  const page = await context.newPage();

  console.log("Opening buyer dashboard...");
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

  console.log("Waiting for dashboard UI to appear...");

  // IMPORTANT: wait for real UI, not network idle
  await page.waitForSelector('text=Dashboard', { timeout: 60000 });

  // give React widgets time to mount
  await page.waitForTimeout(5000);

  // check if session expired
  const currentURL = page.url();
  if (currentURL.includes("login")) {
    console.log("\n❌ You are logged out.");
    console.log("Run this first:");
    console.log("node loginSave.js\n");
    await browser.close();
    return;
  }

  // SCROLL THE ENTIRE PAGE
  await humanScroll(page);

  console.log("Taking full page screenshot...");

  await page.screenshot({
    path: "fullpage.png",
    fullPage: true
  });

  console.log("✅ Screenshot saved as fullpage.png");

  await browser.close();

})();