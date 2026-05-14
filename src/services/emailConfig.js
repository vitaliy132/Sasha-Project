const DEFAULT_SENDGRID_FROM = "quote@rvvacations.com";
const DEFAULT_FROM_NAME = "ManyChat Leads";

const trim = (value) => String(value || "").trim();

const resolveFromAddress = (env = process.env) => {
  if (trim(env.SENDGRID_API_KEY)) {
    return trim(env.SENDGRID_FROM) || DEFAULT_SENDGRID_FROM;
  }

  return trim(env.SENDGRID_FROM) || trim(env.SMTP_USER) || trim(env.CRM_EMAIL);
};

const validateSendGridFrom = (env = process.env) => {
  if (!trim(env.SENDGRID_API_KEY)) return null;

  const fromAddress = resolveFromAddress(env);
  if (!fromAddress) {
    return "Email sender address is not configured.";
  }

  return null;
};

module.exports = {
  DEFAULT_FROM_NAME,
  DEFAULT_SENDGRID_FROM,
  resolveFromAddress,
  validateSendGridFrom,
};
