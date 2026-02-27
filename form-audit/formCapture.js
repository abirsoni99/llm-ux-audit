const { chromium } = require('playwright');

async function capture(page, name) {
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: `step_${name}.png`,
    fullPage: true
  });
  console.log(`Captured: ${name}`);
}

(async () => {

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 }
  });

  const page = await context.newPage();

  // STEP 1 — open landing page
  await page.goto('https://single-page-b2b-rfq-6iby.bolt.host/', { waitUntil: 'domcontentloaded' });

  // STEP 2 — click Get Started
  await page.waitForSelector('text=Get Started', { timeout: 15000 });
  await page.click('text=Get Started');

  // modal appears
  await page.waitForSelector('input[type="text"]');
  await capture(page, "01_modal_open");

  // STEP 3 — enter product
  await page.fill('input[type="text"]', 'diesel generator');
  await page.keyboard.press('Enter');
  await capture(page, "02_product_entered");

  // STEP 4 — Continue
  await page.waitForSelector('text=Continue');
  await page.click('text=Continue');

  // STEP 5 — ISQ page 1
  await page.waitForSelector('text=Power (kVA)');
  await capture(page, "03_isq_page1");

  console.log("Waiting 60 seconds...");
  await page.waitForTimeout(60000);

  await page.click('text=Next');

  // STEP 6 — ISQ page 2
  await page.waitForSelector('text=Fuel Tank Capacity');
  await capture(page, "04_isq_page2");

  await page.click('text=Next');

  // STEP 7 — location page
  await page.waitForSelector('text=Location');
  await capture(page, "05_location");

  // STEP 8 — submit
  await page.waitForSelector('text=Submit');
  await page.click('text=Submit');

  await page.waitForTimeout(4000);
  await capture(page, "06_submitted");

  await browser.close();

})();