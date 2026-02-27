const { chromium } = require("playwright");
const fs = require("fs");

(async () => {

  const browser = await chromium.launch({
    headless: false
  });

  const context = await browser.newContext();

  const page = await context.newPage();

  console.log("\n======================================");
  console.log("A browser will open.");
  console.log("Log in manually to the website.");
  console.log("After login completes, DO NOT close it.");
  console.log("Return here and press ENTER.");
  console.log("======================================\n");

  // open site
  await page.goto("https://buyer.indiamart.com/login");

  // wait for you
  process.stdin.once("data", async () => {

    console.log("Saving authenticated session...");

    await context.storageState({ path: "auth.json" });

    console.log("\nSUCCESS: auth.json created");
    console.log("You can now close the browser.");

    await browser.close();
    process.exit();

  });

})();