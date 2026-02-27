function convertCookiesToStorageState(rawCookies, url) {

  const hostname = new URL(url).hostname;
  const baseDomain = hostname.split('.').slice(-2).join('.');

  const playwrightCookies = rawCookies.map(c => {

    // force root domain authentication
    let domain = c.domain || hostname;

    // remove leading dot inconsistencies
    domain = domain.replace(/^\./, '');

    // IMPORTANT FIX: normalize to parent domain
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

  return {
    cookies: playwrightCookies,
    origins: []
  };
}
const express = require("express");
const fs = require("fs");
const { exec } = require("child_process");
const path = require("path");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 8080;

// allow big auth json payload
app.use(express.json({ limit: "100mb" }));

// health check
app.get("/", (req, res) => {
  res.send("UX Audit service alive");
});

app.post("/run-audit", async (req, res) => {
  try {
    console.log("Audit request received");

    const isFrontend = req.body?.is_frontend === true;

    let targetUrl;
    let authFilePath;
    let deviceType = req.body?.device || "desktop";

    // ---------------- FRONTEND MODE ----------------
    if (isFrontend) {
      const { url, auth } = req.body;

      if (!url || !auth) {
        return res.status(400).json({
          status: "failed",
          message: "Missing url or auth"
        });
      }

      targetUrl = url;

      // write session json sent from lovable
      authFilePath = path.join(__dirname, "temp-auth.json");
let storageState;

if (Array.isArray(auth)) {
  // cookie-editor export detected
  storageState = convertCookiesToStorageState(auth, targetUrl);
} else {
  // already storageState
  storageState = auth;
}

fs.writeFileSync(authFilePath, JSON.stringify(storageState));
      console.log("Temporary auth.json created");
    }

    // ---------------- LOCAL MODE ----------------
    else {
      targetUrl = "https://buyer.indiamart.com";
      authFilePath = path.join(__dirname, "auth.json");

      if (!fs.existsSync(authFilePath)) {
        return res.status(500).json({
          status: "failed",
          message: "auth.json not found on server"
        });
      }
    }

    // create runtime config for capture worker
    const runConfigPath = path.join(__dirname, "run-config.json");

    fs.writeFileSync(
      runConfigPath,
      JSON.stringify({
        url: targetUrl,
        authFile: authFilePath,
        device: deviceType
      })
    );

    console.log("run-config.json written");

    // remove old result
    const resultPath = path.join(__dirname, "result.json");
    if (fs.existsSync(resultPath)) fs.unlinkSync(resultPath);

    // ---------------- RUN PLAYWRIGHT ----------------
    exec("node capture.js", { maxBuffer: 1024 * 1024 * 300 }, async (error, stdout, stderr) => {

      if (stderr) console.log(stderr);

      if (error) {
        console.error(error);
        return res.status(500).json({
          status: "failed",
          message: "Playwright execution failed"
        });
      }

      if (!fs.existsSync(resultPath)) {
        return res.status(500).json({
          status: "failed",
          message: "Result file not generated"
        });
      }

      const data = JSON.parse(fs.readFileSync(resultPath, "utf8"));

      // ---------------- OPTIONAL LLM ANALYSIS ----------------
      if (req.body.llm) {
        console.log("Running LLM analysis...");

        const { provider, model, apiKey, prompt } = req.body.llm;

        if (!apiKey || !model) {
          return res.status(400).json({
            status: "failed",
            message: "Missing model or apiKey"
          });
        }

        const images = [
          data.firstFold,
          data.midFold,
          data.fullPage
        ].map(img => ({
          type: "input_image",
          image_url: `data:image/png;base64,${img}`
        }));

        const payload = {
          model: model,
          messages: [
            {
              role: "system",
              content: "You are a senior UX auditor. Provide structured usability and conversion analysis."
            },
            {
              role: "user",
              content: [
                { type: "text", text: prompt || "Audit this UI for usability issues." },
                ...images
              ]
            }
          ]
        };

        try {
          const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
          });

          const llmResult = await response.json();

          // cleanup temp auth
          if (isFrontend && fs.existsSync(authFilePath)) fs.unlinkSync(authFilePath);

          return res.json({
            status: "success",
            url: data.url,
            device: data.device,
            analysis: llmResult
          });

        } catch (e) {
          console.error("LLM error:", e);
          return res.status(500).json({
            status: "failed",
            message: "LLM request failed"
          });
        }
      }

      // ---------------- SCREENSHOT ONLY RESPONSE ----------------
      if (isFrontend && fs.existsSync(authFilePath)) fs.unlinkSync(authFilePath);

      res.json({
        status: "success",
        url: data.url,
        device: data.device,
        screenshots: {
          firstFold: data.firstFold,
          midFold: data.midFold,
          fullPage: data.fullPage
        }
      });

    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: "failed",
      message: "Server error"
    });
  }
});

app.listen(PORT, () => {
  console.log(`UX Audit server running on port ${PORT}`);
});