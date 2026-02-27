const express = require("express");
const { exec } = require("child_process");
const fs = require("fs");

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("LLM UX Audit Worker Alive");
});

app.post("/run-audit", (req, res) => {
  console.log("Audit triggered...");

  exec("node capture.js", { maxBuffer: 1024 * 1024 * 100 }, (error, stdout, stderr) => {

    if (stderr) {
      console.log("Playwright logs:\n", stderr);
    }

    if (error) {
      console.log("Execution error:", error);
      return res.status(500).json({
        error: "Playwright execution failed"
      });
    }

    try {
      if (!fs.existsSync("result.json")) {
        return res.status(500).json({
          error: "Result file not generated"
        });
      }

      const data = fs.readFileSync("result.json", "utf8");
      const parsed = JSON.parse(data);

      return res.json(parsed);

    } catch (err) {
      console.log("Failed reading result.json:", err);
      return res.status(500).json({
        error: "Capture ran but result parsing failed"
      });
    }
  });
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log("Server listening on port", PORT);
});