const express = require("express");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json({ limit: "100mb" }));

// ---------------- HEALTH CHECK ----------------
app.get("/", (req, res) => {
  res.send("Capture service alive");
});

// ---------------- COOKIE → PLAYWRIGHT CONVERSION ----------------
function convertCookiesToStorageState(rawCookies, url) {

  const hostname = new URL(url).hostname;
  const baseDomain = hostname.split('.').slice(-2).join('.');

  const playwrightCookies = rawCookies.map(c => {

    let domain = c.domain || hostname;
    domain = domain.replace(/^\./, '');

    if (!domain.endsWith(baseDomain)) {
      domain = baseDomain;
    }

    return {
      name: c.name,
      value: c.value,
      domain: "." + baseDomain,
      path: c.path || "/",
      expires: c.expirationDate
        ? Math.floor(c.expirationDate)
        : Math.floor(Date.now() / 1000) + 86400 * 3,
      httpOnly: c.httpOnly ?? true,
      secure: true,
      sameSite:
        c.sameSite === "no_restriction"
          ? "None"
          : c.sameSite === "lax"
          ? "Lax"
          : "Lax"
    };
  });

  return {
    cookies: playwrightCookies,
    origins: [
      {
        origin: `https://${hostname}`,
        localStorage: []
      }
    ]
  };
}

// ---------------- START CAPTURE ----------------
app.post("/run-audit", async (req, res) => {

  try {

    const jobId = uuidv4();
    const jobDir = path.join(__dirname, "jobs", jobId);
    fs.mkdirSync(jobDir, { recursive: true });

    const isFrontend = req.body?.is_frontend === true;
    const deviceType = req.body?.device || "desktop";

    let targetUrl;
    let authFilePath;

    if (isFrontend) {

      const { url, auth } = req.body;

      if (!url || !auth) {
        return res.status(400).json({
          status: "error",
          message: "Missing url or auth"
        });
      }

      targetUrl = url;

      // convert cookie export → storageState
      const storageState = Array.isArray(auth)
        ? convertCookiesToStorageState(auth, url)
        : auth;

      authFilePath = path.join(jobDir, "auth.json");
      fs.writeFileSync(authFilePath, JSON.stringify(storageState));

    } else {
      targetUrl = "https://buyer.indiamart.com";
      authFilePath = path.join(__dirname, "auth.json");
    }

    // write runtime config
    fs.writeFileSync(
      path.join(jobDir, "run-config.json"),
      JSON.stringify({
        url: targetUrl,
        authFile: authFilePath,
        device: deviceType,
        jobDir: jobDir
      })
    );

    // start background capture
    exec(`node capture.js ${jobDir}`, { detached: true });

    return res.json({
      status: "processing",
      jobId: jobId
    });

  } catch (e) {
    console.error(e);
    res.status(500).json({
      status: "error",
      message: "Failed to start capture"
    });
  }
});

// ---------------- RESULT POLLING ----------------
app.get("/result/:jobId", (req, res) => {

  const jobDir = path.join(__dirname, "jobs", req.params.jobId);
  const resultPath = path.join(jobDir, "result.json");

  if (!fs.existsSync(jobDir))
    return res.status(404).json({ status: "invalid_job" });

  if (!fs.existsSync(resultPath))
    return res.json({ status: "processing" });

  try {
    const result = JSON.parse(fs.readFileSync(resultPath, "utf8"));
    return res.json({
      status: "done",
      data: result
    });
  } catch {
    return res.status(500).json({ status: "error" });
  }
});

app.listen(PORT, () => {
  console.log(`Capture server running on port ${PORT}`);
});