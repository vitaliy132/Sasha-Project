/**
 * Environment variable validation utility
 */

const logger = require("./logger");

/**
 * List of required environment variables that must be present
 */
const REQUIRED_ENV = [
  "WEBHOOK_SECRET",
  "SMTP_HOST",
  "SMTP_USER",
  "SMTP_PASS",
  "CRM_EMAIL",
];

/**
 * List of optional environment variables
 */
const OPTIONAL_ENV = [
  "GOOGLE_SHEET_ID",
  "GOOGLE_PROJECT_ID",
  "GOOGLE_CLIENT_EMAIL",
  "GOOGLE_PRIVATE_KEY",
  "SENDGRID_API_KEY",
  "SENDGRID_FROM",
];

/**
 * Check if an environment variable exists and has a non-empty trimmed value
 */
const hasEnv = (key) => !!process.env[key]?.trim();

/**
 * Validate that all required environment variables are configured
 * @throws {Error} If any required env vars are missing
 */
function validateRequiredEnv() {
  const missing = REQUIRED_ENV.filter((key) => !hasEnv(key));

  // Special validation: if SendGrid is configured, SENDGRID_FROM is required
  if (process.env.SENDGRID_API_KEY && !hasEnv("SENDGRID_FROM")) {
    missing.push("SENDGRID_FROM");
  }

  if (missing.length) {
    const uniqueMissing = [...new Set(missing)];
    const message = `Missing required environment variables: ${uniqueMissing.join(", ")}`;
    logger.error(message);
    throw new Error(message);
  }
}

/**
 * Get a summary of the environment configuration (for API responses).
 * `required` values are booleans; `optional` values are "configured" | "not set".
 * `ok` reflects required vars plus SendGrid-from rule (aligned with startup validation).
 */
function getEnvSummary() {
  const required = {};
  REQUIRED_ENV.forEach((key) => {
    required[key] = hasEnv(key);
  });

  const optional = {};
  OPTIONAL_ENV.forEach((key) => {
    optional[key] = hasEnv(key) ? "configured" : "not set";
  });

  let ok = REQUIRED_ENV.every((key) => required[key]);
  if (process.env.SENDGRID_API_KEY && !hasEnv("SENDGRID_FROM")) {
    ok = false;
  }

  const sendgridConfigured = hasEnv("SENDGRID_API_KEY") && hasEnv("SENDGRID_FROM");
  const smtpConfigured =
    hasEnv("SMTP_HOST") && hasEnv("SMTP_USER") && hasEnv("SMTP_PASS");
  const emailProvider = sendgridConfigured
    ? "SendGrid"
    : smtpConfigured
      ? "SMTP"
      : "none";

  const sheetsKeys = OPTIONAL_ENV.slice(0, 4);
  const sheetsConfigured = sheetsKeys.every((key) => hasEnv(key));

  return {
    ok,
    required,
    optional,
    emailProvider,
    sendgridConfigured,
    smtpConfigured,
    sheetsConfigured,
  };
}

module.exports = {
  validateRequiredEnv,
  getEnvSummary,
  REQUIRED_ENV,
  OPTIONAL_ENV,
};
