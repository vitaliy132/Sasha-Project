require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");

const logger = require("./utils/logger");
const { verifySmtp } = require("./services/mailer");
const app = express();

const REQUIRED_ENV = ["WEBHOOK_SECRET", "SMTP_HOST", "SMTP_USER", "SMTP_PASS", "CRM_EMAIL"];
const OPTIONAL_ENV = [
  "GOOGLE_SHEET_ID",
  "GOOGLE_PROJECT_ID",
  "GOOGLE_CLIENT_EMAIL",
  "GOOGLE_PRIVATE_KEY",
];
const hasEnv = (key) => !!process.env[key]?.trim();

const missing = REQUIRED_ENV.filter((key) => !hasEnv(key));
if (missing.length) {
  logger.error("Missing required env:", missing.join(", "));
  process.exit(1);
}

app.use(helmet());
app.use(cors());
app.use(morgan("combined"));
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    name: "sasha-project",
    status: "ok",
    message: "Lead webhook API. Use POST /api/leads/manychat with x-webhook-secret.",
    health: "/health",
    envCheck: "/api/env-check",
    smtpCheck: "/api/smtp-check",
  });
});

app.get("/health", (req, res) => res.status(200).send("OK"));

app.get("/api/env-check", (req, res) => {
  const required = Object.fromEntries(REQUIRED_ENV.map((key) => [key, hasEnv(key)]));
  const optional = Object.fromEntries(OPTIONAL_ENV.map((key) => [key, hasEnv(key)]));
  const allRequired = REQUIRED_ENV.every((key) => required[key]);
  res.json({
    ok: allRequired,
    required,
    optional,
    sheetsConfigured: OPTIONAL_ENV.every((key) => optional[key]),
  });
});

app.get("/api/smtp-check", async (req, res) => {
  if (process.env.ENABLE_SMTP_DEBUG !== "1") {
    return res.status(404).json({ error: "Not found" });
  }
  try {
    await verifySmtp();
    return res.json({ ok: true });
  } catch (err) {
    logger.error("SMTP verify failed:", err.message || err);
    if (err.code) logger.error("SMTP error code:", err.code);
    return res.status(500).json({
      ok: false,
      error: err.message || "SMTP verification failed",
      code: err.code || null,
    });
  }
});

app.use("/api/leads", require("./routes/leads"));

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
