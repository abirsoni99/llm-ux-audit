const { spawn } = require("child_process");
const path = require("path");

console.log("Worker process booted.");

/*
  This function runs the screenshot audit.
  We use spawn (not exec) because Playwright outputs a lot of logs
  and exec can silently die in cloud containers.
*/
function runAudit() {
  console.log("Starting Playwright audit...");

  const child = spawn("node", [path.join(__dirname, "capture.js")], {
    stdio: "inherit"
  });

  child.on("close", (code) => {
    console.log("Playwright audit finished with code:", code);
  });

  child.on("error", (err) => {
    console.error("Failed to start audit:", err);
  });
}

/* -------- RUN ON STARTUP -------- */
/* Wait 20 seconds so container + chromium dependencies fully settle */
setTimeout(() => {
  runAudit();
}, 20000);


/* -------- KEEP CONTAINER ALIVE -------- */
/* Railway will sleep containers that are quiet */
setInterval(() => {
  console.log("Worker heartbeat alive...");
}, 60000);


/* -------- SCHEDULED RUNS -------- */
/*
   Run every 6 hours.
   (You can later change to 1 hour if you want continuous monitoring)
*/
setInterval(() => {
  console.log("Scheduled audit triggered...");
  runAudit();
}, 6 * 60 * 60 * 1000);