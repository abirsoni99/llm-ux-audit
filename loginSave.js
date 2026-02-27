const { chromium } = require('playwright');

(async () => {

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://buyer.indiamart.com/login');

  console.log("Please login manually in the opened browser.");
  console.log("After OTP success, just wait 2 minutes...");

  await page.waitForTimeout(120000);

  await context.storageState({ path: 'auth.json' });

  console.log("Login saved successfully!");

  await browser.close();
})();