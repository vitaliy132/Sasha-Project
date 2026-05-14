require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");

const { HTTP_STATUS } = require("./utils/constants");
const logger = require("./utils/logger");
const {
  DEFAULT_FROM_NAME,
  DEFAULT_SENDGRID_FROM,
  validateSendGridFrom,
} = require("./services/emailConfig");
const app = express();

const hasEnv = (key) => !!process.env[key]?.trim();
const BASE_REQUIRED_ENV = ["WEBHOOK_SECRET", "CRM_EMAIL"];
const SMTP_REQUIRED_ENV = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"];
const REQUIRED_ENV = hasEnv("SENDGRID_API_KEY")
  ? BASE_REQUIRED_ENV
  : [...BASE_REQUIRED_ENV, ...SMTP_REQUIRED_ENV];
const OPTIONAL_ENV = [
  "GOOGLE_SHEET_ID",
  "GOOGLE_PROJECT_ID",
  "GOOGLE_CLIENT_EMAIL",
  "GOOGLE_PRIVATE_KEY",
  "SENDGRID_API_KEY",
  "SENDGRID_FROM",
  "SENDGRID_FROM_NAME",
  "LEAD_EMAIL_TO",
];

const missing = REQUIRED_ENV.filter((key) => !hasEnv(key));
const sendGridFromError = validateSendGridFrom();

if (missing.length) {
  logger.error("Missing required env:", [...new Set(missing)].join(", "));
  process.exit(1);
}
if (sendGridFromError) {
  logger.error(sendGridFromError);
  process.exit(1);
}

const { verifySmtp, getLeadNotificationRecipients } = require("./services/mailer");

app.use(helmet());
app.use(cors());
app.use(morgan("combined"));
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    name: "sasha-project",
    status: "ok",
    message: "Lead webhook API for rental calculator",
    activeEndpoints: {
      rentalQuote: "POST /calculate-rental (used by FrontEndSasha)",
      rentalOptions: "GET /rental-options (vehicle choices and calculator policy)",
      calculatorLead:
        "POST /submit-lead — name, email, phone, address, quote; optional calculator fields (vehicleType, vehicleModel, vehicleModelLabel, startDate, endDate, add-ons as /calculate-rental, personalKitPeople or beddingKitPeople, additionalNotes, rentalDetails, quoteBreakdown). CRM email includes a full “Rental calculator selections” lead block with dates, vehicle, waiver/coverage/kits, km packages, extra-km copy, and generator option.",
      manychatWebhook: "POST /api/leads/manychat",
    },
    debugEndpoints: {
      health: "GET /health",
      envCheck: "GET /api/env-check",
      smtpCheck: "GET /api/smtp-check (requires ENABLE_SMTP_DEBUG=1)",
      sendgridCheck: "GET /api/sendgrid-check (validates SendGrid config if in use)",
    },
    deprecatedEndpoints: {
      pricingCalculator: "POST /calculate (deprecated - use /calculate-rental instead)",
    },
  });
});

app.get("/health", (req, res) => res.status(HTTP_STATUS.OK).send("OK"));

app.get("/api/env-check", (req, res) => {
  const required = Object.fromEntries(REQUIRED_ENV.map((key) => [key, hasEnv(key)]));
  const optional = Object.fromEntries(OPTIONAL_ENV.map((key) => [key, hasEnv(key)]));
  const allRequired = REQUIRED_ENV.every((key) => required[key]);
  const sendgridConfigured = hasEnv("SENDGRID_API_KEY") && !validateSendGridFrom();
  const smtpConfigured = hasEnv("SMTP_HOST") && hasEnv("SMTP_USER") && hasEnv("SMTP_PASS");
  const emailProvider = sendgridConfigured ? "SendGrid" : smtpConfigured ? "SMTP" : "none";
  res.json({
    ok: allRequired,
    required,
    optional,
    emailProvider,
    sendgridConfigured,
    smtpConfigured,
    sheetsConfigured: OPTIONAL_ENV.slice(0, 4).every((key) => optional[key]),
  });
});

app.get("/api/smtp-check", async (req, res) => {
  if (process.env.ENABLE_SMTP_DEBUG !== "1") {
    return res.status(HTTP_STATUS.NOT_FOUND).json({ error: "Not found" });
  }
  try {
    await verifySmtp();
    return res.json({ ok: true });
  } catch (err) {
    logger.error("SMTP verify failed:", err.message || err);
    if (err.code) logger.error("SMTP error code:", err.code);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      ok: false,
      error: err.message || "SMTP verification failed",
      code: err.code || null,
    });
  }
});

app.get("/api/sendgrid-check", async (req, res) => {
  if (!process.env.SENDGRID_API_KEY) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      ok: false,
      error: "SendGrid not configured",
      message: "Set SENDGRID_API_KEY. SENDGRID_FROM defaults to the verified domain sender.",
    });
  }
  const fromError = validateSendGridFrom();
  if (fromError) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      ok: false,
      error: "SendGrid from address invalid",
      message: fromError,
    });
  }
  try {
    const sgMail = require("@sendgrid/mail");
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    const fromEmail = process.env.SENDGRID_FROM?.trim() || DEFAULT_SENDGRID_FROM;
    const fromName = (process.env.SENDGRID_FROM_NAME || DEFAULT_FROM_NAME).trim() || DEFAULT_FROM_NAME;
    const { to, bcc } = getLeadNotificationRecipients();
    await sgMail.send({
      to,
      ...(bcc ? { bcc } : {}),
      from: { email: fromEmail, name: fromName },
      subject: "SendGrid Configuration Test",
      text: "If you see this, SendGrid is configured correctly.",
      html: "<p>If you see this, SendGrid is configured correctly.</p>",
    });
    return res.json({
      ok: true,
      message: "SendGrid test email sent successfully",
      from: fromEmail,
      fromName,
      to,
      ...(bcc ? { bcc } : {}),
    });
  } catch (err) {
    logger.error("SendGrid check failed:", err.message || err);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      ok: false,
      error: "SendGrid verification failed",
      message: err.message || "Unknown error",
      details: err.code || err.response?.body || null,
    });
  }
});

app.use("/api/leads", require("./routes/leads"));
// DEPRECATED: /calculate endpoint replaced by /calculate-rental
app.use("/rental-options", require("./routes/rentalOptions"));
app.use("/calculate-rental", require("./routes/rental"));
app.use("/submit-lead", require("./routes/submitLead"));
app.use("/api", require("./routes/availability"));

app.use((req, res) => {
  res.status(HTTP_STATUS.NOT_FOUND).json({ error: "Not found", path: req.path });
});

const port = process.env.PORT || 3000;
if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    logger.info("Lead service running on port", port);
  });
}
module.exports = app;
