// Main application entry point
require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");

const logger = require("./utils/logger");
const app = express();

const requiredEnv = ["WEBHOOK_SECRET", "SMTP_HOST", "SMTP_USER", "SMTP_PASS", "CRM_EMAIL"];
const missing = requiredEnv.filter((key) => !process.env[key]?.trim());
if (missing.length) {
  logger.error("Missing required env:", missing.join(", "));
  process.exit(1);
}

app.use(helmet());
app.use(cors());
app.use(morgan("combined"));
app.use(express.json());

// Root: so visiting the site in a browser doesn't error
app.get("/", (req, res) => {
  res.json({
    name: "sasha-project",
    status: "ok",
    message: "Lead webhook API. Use POST /api/leads/manychat with x-webhook-secret.",
    health: "/health",
    envCheck: "/api/env-check",
  });
});

app.get("/health", (req, res) => res.status(200).send("OK"));

// Env check: confirms required keys are set (no values exposed)
app.get("/api/env-check", (req, res) => {
  const required = ["WEBHOOK_SECRET", "SMTP_HOST", "SMTP_USER", "SMTP_PASS", "CRM_EMAIL"];
  const status = Object.fromEntries(
    required.map((key) => [key, !!process.env[key]?.trim()])
  );
  const allSet = required.every((key) => status[key]);
  res.json({ ok: allSet, keys: status });
});

app.use("/api/leads", require("./routes/leads"));

// 404
app.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.path });
});

const port = process.env.PORT || 3000;
if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    logger.info("Lead service running on port", port);
  });
}
module.exports = app;
