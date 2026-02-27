const { exec } = require("child_process");

function runAudit() {
  console.log("Running Playwright audit...");

  exec("node capture.js", (error, stdout, stderr) => {
    if (error) {
      console.error("Audit error:", error);
      return;
    }

    console.log(stdout);
    console.log("Audit finished.");
  });
}

// run once after startup (important)
setTimeout(runAudit, 15000);

// run every 6 hours
setInterval(runAudit, 6 * 60 * 60 * 1000);

// keep container alive
setInterval(() => {
  console.log("Worker heartbeat alive...");
}, 60000);