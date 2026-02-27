const express = require("express");
const { spawn } = require("child_process");
const path = require("path");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

app.get("/", (req, res) => {
  res.send("Playwright audit service running.");
});

app.post("/run-audit", (req, res) => {
  console.log("Audit API triggered from Lovable...");

  const child = spawn("node", [path.join(__dirname, "capture.js")]);

  let output = "";

  child.stdout.on("data", (data) => {
    output += data.toString();
  });

  child.stderr.on("data", (data) => {
    console.error("stderr:", data.toString());
  });

  child.on("close", (code) => {
    if (code === 0) {
      try {
        const parsed = JSON.parse(output);
        res.json(parsed);
      } catch (err) {
        res.status(500).json({
          error: "Audit ran but failed to parse output"
        });
      }
    } else {
      res.status(500).json({
        error: "Playwright audit failed"
      });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});