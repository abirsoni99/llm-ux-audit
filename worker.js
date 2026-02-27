const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

function runAudit() {
  console.log("Running Playwright audit...");

  exec("node capture.js", (error, stdout, stderr) => {
    if (error) {
      console.error("Error:", error);
      return;
    }
    console.log(stdout);

    uploadResults();
  });
}

async function uploadResults() {
  console.log("Screenshots ready. Uploading...");

  const files = fs.readdirSync("./").filter(f => f.endsWith(".png"));

  for (const file of files) {
    console.log("Ready:", file);
    // we will connect Lovable here
  }
}

runAudit();

// run every 6 hours
setInterval(runAudit, 6 * 60 * 60 * 1000);