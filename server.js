const express = require("express");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(express.json({ limit: "50mb" }));

const JOBS_DIR = path.join(__dirname, "jobs");
if (!fs.existsSync(JOBS_DIR)) fs.mkdirSync(JOBS_DIR);

app.get("/", (req, res) => {
  res.send("UX Capture API running");
});



/* --------------------------
   STEP 1 : SUBMIT CAPTURE
---------------------------*/
app.post("/run-audit", async (req, res) => {
  try {
    const { url, device, auth, _is_frontend } = req.body;

    if (!_is_frontend)
      return res.status(400).json({ error: "frontend flag missing" });

    if (!url)
      return res.status(400).json({ error: "url missing" });

    if (!auth)
      return res.status(400).json({ error: "auth.json missing" });

    const jobId = uuidv4();
    const jobDir = path.join(JOBS_DIR, jobId);
    fs.mkdirSync(jobDir);

    /* save auth */
    const authPath = path.join(jobDir, "auth.json");
    fs.writeFileSync(authPath, JSON.stringify(auth, null, 2));

    /* create run config */
    const config = {
      url,
      device: device || "desktop",
      authFile: authPath
    };

    fs.writeFileSync(
      path.join(jobDir, "run-config.json"),
      JSON.stringify(config, null, 2)
    );

    /* launch playwright */
    const child = spawn("node", ["capture.js", jobDir], {
      detached: true,
      stdio: "ignore"
    });

    child.unref();

    return res.json({
      status: "processing",
      jobId
    });

  } catch (e) {
    return res.status(500).json({
      status: "error",
      message: e.message
    });
  }
});



/* --------------------------
   STEP 2 : POLL RESULT
---------------------------*/
app.get("/result/:jobId", async (req, res) => {
  try {
    const jobId = req.params.jobId;
    const jobDir = path.join(JOBS_DIR, jobId);
    const resultPath = path.join(jobDir, "result.json");

    if (!fs.existsSync(jobDir))
      return res.status(404).json({ status: "error", message: "job not found" });

    /* still running */
    if (!fs.existsSync(resultPath))
      return res.json({ status: "processing" });

    const raw = JSON.parse(fs.readFileSync(resultPath, "utf8"));

    /* capture failed */
    if (raw.error) {
      return res.status(500).json({
        status: "error",
        message: raw.message || "capture failed"
      });
    }

    /* Lovable REQUIRES 3 keys */
    const first = raw.firstFold;
    const mid = raw.midFold || raw.firstFold;
    const full = raw.fullPage;

    if (!first || !full) {
      return res.status(500).json({
        status: "error",
        message: "screenshots incomplete"
      });
    }

    /* EXACT RESPONSE CONTRACT */
    return res.json({
      status: "done",
      screenshots: {
        firstFold: "data:image/png;base64," + first,
        midFold: "data:image/png;base64," + mid,
        fullPage: "data:image/png;base64," + full
      }
    });

  } catch (e) {
    return res.status(500).json({
      status: "error",
      message: e.message
    });
  }
});



/* --------------------------
   SERVER START
---------------------------*/
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});