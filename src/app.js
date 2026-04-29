require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");

const { HTTP_STATUS } = require("./utils/constants");
const logger = require("./utils/logger");
const { verifySmtp } = require("./services/mailer");
const app = express();

const REQUIRED_ENV = ["WEBHOOK_SECRET", "SMTP_HOST", "SMTP_USER", "SMTP_PASS", "CRM_EMAIL"];
const OPTIONAL_ENV = [
  "GOOGLE_SHEET_ID",
  "GOOGLE_PROJECT_ID",
  "GOOGLE_CLIENT_EMAIL",
  "GOOGLE_PRIVATE_KEY",
  "SENDGRID_API_KEY",
  "SENDGRID_FROM",
  "MAILERSEND_API_KEY",
  "MAILERSEND_FROM",
  "MAILERSEND_SMTP_HOST",
  "MAILERSEND_SMTP_PORT",
  "MAILERSEND_SMTP_USER",
  "MAILERSEND_SMTP_PASS",
];
const hasEnv = (key) => !!process.env[key]?.trim();

const missing = REQUIRED_ENV.filter((key) => !hasEnv(key));
if (process.env.SENDGRID_API_KEY && !hasEnv("SENDGRID_FROM")) {
  missing.push("SENDGRID_FROM");
}
if (process.env.MAILERSEND_API_KEY && !hasEnv("MAILERSEND_FROM")) {
  missing.push("MAILERSEND_FROM");
}

if (missing.length) {
  logger.error("Missing required env:", [...new Set(missing)].join(", "));
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
    message: "Lead webhook API for rental calculator",
    activeEndpoints: {
      rentalQuote: "POST /calculate-rental (used by FrontEndSasha)",
      calculatorLead: "POST /submit-lead (used by FrontEndSasha)",
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
  const sendgridConfigured = hasEnv("SENDGRID_API_KEY") && hasEnv("SENDGRID_FROM");
  const mailersendAPIConfigured = hasEnv("MAILERSEND_API_KEY") && hasEnv("MAILERSEND_FROM");
  const mailersendSMTPConfigured = hasEnv("MAILERSEND_SMTP_USER") && hasEnv("MAILERSEND_SMTP_PASS");
  const smtpConfigured = hasEnv("SMTP_HOST") && hasEnv("SMTP_USER") && hasEnv("SMTP_PASS");
  const emailProvider = mailersendSMTPConfigured ? "MailerSend SMTP" : mailersendAPIConfigured ? "MailerSend API" : sendgridConfigured ? "SendGrid" : smtpConfigured ? "SMTP" : "none";
  res.json({
    ok: allRequired,
    required,
    optional,
    emailProvider,
    sendgridConfigured,
    mailersendAPIConfigured,
    mailersendSMTPConfigured,
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
      message: "Set SENDGRID_API_KEY and SENDGRID_FROM environment variables",
    });
  }
  if (!process.env.SENDGRID_FROM) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      ok: false,
      error: "SendGrid from address missing",
      message: "Set SENDGRID_FROM to a verified sender address in SendGrid",
    });
  }
  try {
    const sgMail = require("@sendgrid/mail");
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    await sgMail.send({
      to: process.env.CRM_EMAIL,
      from: process.env.SENDGRID_FROM,
      subject: "SendGrid Configuration Test",
      text: "If you see this, SendGrid is configured correctly.",
      html: "<p>If you see this, SendGrid is configured correctly.</p>",
    });
    return res.json({
      ok: true,
      message: "SendGrid test email sent successfully",
      from: process.env.SENDGRID_FROM,
      to: process.env.CRM_EMAIL,
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

app.get("/api/mailersend-check", async (req, res) => {
  if (!process.env.MAILERSEND_API_KEY) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      ok: false,
      error: "MailerSend not configured",
      message: "Set MAILERSEND_API_KEY and MAILERSEND_FROM environment variables",
    });
  }
  if (!process.env.MAILERSEND_FROM) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      ok: false,
      error: "MailerSend from address missing",
      message: "Set MAILERSEND_FROM to a verified sender address in MailerSend",
    });
  }
  try {
    const axios = require("axios");
    const response = await axios.post(
      "https://api.mailersend.com/v1/email",
      {
        from: {
          email: process.env.MAILERSEND_FROM,
          name: "ManyChat Leads",
        },
        to: [
          {
            email: process.env.CRM_EMAIL,
            name: "Sales Team",
          },
        ],
        subject: "MailerSend Configuration Test",
        text: "If you see this, MailerSend is configured correctly.",
        html: "<p>If you see this, MailerSend is configured correctly.</p>",
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.MAILERSEND_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    return res.json({
      ok: true,
      message: "MailerSend test email sent successfully",
      from: process.env.MAILERSEND_FROM,
      to: process.env.CRM_EMAIL,
      messageId: response.data?.message_id,
    });
  } catch (err) {
    logger.error("MailerSend check failed:", err.response?.data || err.message || err);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      ok: false,
      error: "MailerSend verification failed",
      message: err.response?.data?.message || err.message || "Unknown error",
      details: err.response?.data || null,
    });
  }
});

app.get("/api/mailersend-smtp-check", async (req, res) => {
  if (!process.env.MAILERSEND_SMTP_USER || !process.env.MAILERSEND_SMTP_PASS) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      ok: false,
      error: "MailerSend SMTP not configured",
      message: "Set MAILERSEND_SMTP_USER and MAILERSEND_SMTP_PASS environment variables",
    });
  }
  try {
    const nodemailer = require("nodemailer");
    const testTransporter = nodemailer.createTransport({
      host: process.env.MAILERSEND_SMTP_HOST || "smtp.mailersend.net",
      port: Number(process.env.MAILERSEND_SMTP_PORT || 587),
      secure: Number(process.env.MAILERSEND_SMTP_PORT || 587) === 465,
      auth: {
        user: process.env.MAILERSEND_SMTP_USER,
        pass: process.env.MAILERSEND_SMTP_PASS,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
      tls: {
        rejectUnauthorized: false,
      },
    });

    await testTransporter.verify();
    await testTransporter.sendMail({
      from: `"ManyChat Leads" <${process.env.MAILERSEND_SMTP_USER}>`,
      to: process.env.CRM_EMAIL,
      subject: "MailerSend SMTP Configuration Test",
      text: "If you see this, MailerSend SMTP is configured correctly.",
      html: "<p>If you see this, MailerSend SMTP is configured correctly.</p>",
    });

    return res.json({
      ok: true,
      message: "MailerSend SMTP test email sent successfully",
      from: process.env.MAILERSEND_SMTP_USER,
      to: process.env.CRM_EMAIL,
      host: process.env.MAILERSEND_SMTP_HOST || "smtp.mailersend.net",
      port: process.env.MAILERSEND_SMTP_PORT || 587,
    });
  } catch (err) {
    logger.error("MailerSend SMTP check failed:", err.message || err);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      ok: false,
      error: "MailerSend SMTP verification failed",
      message: err.message || "Unknown error",
      code: err.code || null,
    });
  }
});

app.use("/api/leads", require("./routes/leads"));
// DEPRECATED: /calculate endpoint replaced by /calculate-rental
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
