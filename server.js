const express = require("express");
const fs = require("fs");
const { exec } = require("child_process");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;

// Allow large payload (auth.json can be big)
app.use(express.json({ limit: "50mb" }));

// Health check for Railway
app.get("/", (req, res) => {
  res.send("UX Audit service alive");
});

/*
  MAIN ENDPOINT
  Supports:
  - Local mode (default auth.json + fixed URL)
  - Frontend mode (dynamic URL + auth from Lovable)
*/
app.post("/run-audit", async (req, res) => {
  try {
    console.log("Audit request received...");

    const isFrontend = req.body?.is_frontend === true;

    let targetUrl;
    let authFilePath;

    // =============================
    // FRONTEND MODE (Lovable)
    // =============================
    if (isFrontend) {
      console.log("Frontend mode enabled");

      const { url, auth } = req.body;

      if (!url || !auth) {
        return res.status(400).json({
          status: "failed",
          message: "Missing url or auth in request body"
        });
      }

      targetUrl = url;

      // Write temporary auth file
      authFilePath = path.join(__dirname, "temp-auth.json");
      fs.writeFileSync(authFilePath, JSON.stringify(auth));

      console.log("Temporary auth written");
    }

    // =============================
    // DEFAULT LOCAL MODE
    // =============================
    else {
      console.log("Local mode enabled");

      targetUrl = "https://buyer.indiamart.com";
      authFilePath = path.join(__dirname, "auth.json");

      if (!fs.existsSync(authFilePath)) {
        return res.status(500).json({
          status: "failed",
          message: "auth.json not found on server"
        });
      }
    }

    // =============================
    // Prepare config for capture.js
    // =============================
    const runConfigPath = path.join(__dirname, "run-config.json");

    fs.writeFileSync(
      runConfigPath,
      JSON.stringify({
        url: targetUrl,
        authFile: authFilePath
      })
    );

    console.log("Run config written");

    // Remove previous result file if exists
    const resultPath = path.join(__dirname, "result.json");
    if (fs.existsSync(resultPath)) {
      fs.unlinkSync(resultPath);
    }

    // =============================
    // Execute Playwright
    // =============================
    exec(
      "node capture.js",
      { maxBuffer: 1024 * 1024 * 200 }, // allow large output
      (error, stdout, stderr) => {

        if (stderr) {
          console.error("Playwright stderr:", stderr);
        }

        if (error) {
          console.error("Playwright execution error:", error);

          return res.status(500).json({
            status: "failed",
            message: "Playwright execution failed"
          });
        }

        if (!fs.existsSync(resultPath)) {
          console.error("Result file not generated");

          return res.status(500).json({
            status: "failed",
            message: "Result file not generated"
          });
        }

        let data;
        try {
          data = JSON.parse(fs.readFileSync(resultPath, "utf8"));
        } catch (parseErr) {
          console.error("Result parse error:", parseErr);

          return res.status(500).json({
            status: "failed",
            message: "Failed to parse result file"
          });
        }

        console.log("Capture successful, returning response");

        res.json({
          status: "success",
          url: data.url,
          capturedAt: new Date().toISOString(),
          screenshots: {
            firstFold: data.firstFold,
            midFold: data.midFold,
            fullPage: data.fullPage
          }
        });

        // Optional cleanup of temp auth
        if (isFrontend && fs.existsSync(authFilePath)) {
          fs.unlinkSync(authFilePath);
          console.log("Temporary auth cleaned");
        }
      }
    );

  } catch (err) {
    console.error("Server error:", err);

    res.status(500).json({
      status: "failed",
      message: "Server error"
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`UX Audit server running on port ${PORT}`);
});