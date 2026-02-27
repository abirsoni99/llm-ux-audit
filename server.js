const express = require("express");
const { spawn } = require("child_process");
const path = require("path");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Playwright audit service running.");
});

app.post("/run-audit", (req, res) => {
  console.log("Audit API triggered from Lovable...");

  const child = spawn("node", [path.join(__dirname, "capture.js")], {
    stdio: "inherit"
  });

  child.on("close", (code) => {
    console.log("Audit finished with code:", code);
  });

  res.json({
    status: "Audit started"
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});