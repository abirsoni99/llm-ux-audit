const express = require("express");
const fs = require("fs");
const { exec } = require("child_process");
const path = require("path");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json({ limit: "100mb" }));

app.get("/", (req, res) => {
  res.send("UX Audit service alive");
});

app.post("/run-audit", async (req, res) => {
  try {
    console.log("Audit request received");

    const isFrontend = req.body?.is_frontend === true;

    let targetUrl;
    let authFilePath;

    // ---------------- Frontend Mode ----------------
    if (isFrontend) {
      const { url, auth } = req.body;

      if (!url || !auth) {
        return res.status(400).json({ error: "Missing url or auth" });
      }

      targetUrl = url;
      authFilePath = path.join(__dirname, "temp-auth.json");
      fs.writeFileSync(authFilePath, JSON.stringify(auth));
    } else {
      targetUrl = "https://buyer.indiamart.com";
      authFilePath = path.join(__dirname, "auth.json");
    }

    // Write config for capture.js
    fs.writeFileSync(
      path.join(__dirname, "run-config.json"),
      JSON.stringify({
        url: targetUrl,
        authFile: authFilePath
      })
    );

    // Remove old result
    if (fs.existsSync("result.json")) fs.unlinkSync("result.json");

    // Run Playwright capture
    exec("node capture.js", { maxBuffer: 1024 * 1024 * 300 }, async (error, stdout, stderr) => {

      if (stderr) console.log(stderr);

      if (error) {
        console.error(error);
        return res.status(500).json({ error: "Playwright execution failed" });
      }

      if (!fs.existsSync("result.json")) {
        return res.status(500).json({ error: "Result file not generated" });
      }

      const data = JSON.parse(fs.readFileSync("result.json", "utf8"));

      // ---------------- LLM PART ----------------
      if (req.body.llm) {
        console.log("LLM analysis requested");

        const { provider, model, apiKey, prompt } = req.body.llm;

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
              content: "You are a senior UX auditor. Provide structured usability analysis."
            },
            {
              role: "user",
              content: [
                { type: "text", text: prompt || "Audit this UI." },
                ...images
              ]
            }
          ]
        };

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        const llmResult = await response.json();

        return res.json({
          status: "success",
          url: data.url,
          analysis: llmResult
        });
      }

      // If no LLM requested, just send screenshots
      res.json({
        status: "success",
        url: data.url,
        screenshots: data
      });

      // cleanup temp auth
      if (isFrontend && fs.existsSync(authFilePath)) {
        fs.unlinkSync(authFilePath);
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`UX Audit server running on port ${PORT}`);
});