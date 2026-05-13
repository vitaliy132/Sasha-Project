const VERIFIED_SENDGRID_DOMAIN = "em9990.rvvacations.com";
const DEFAULT_SENDGRID_FROM = `leads@${VERIFIED_SENDGRID_DOMAIN}`;
const DEFAULT_FROM_NAME = "ManyChat Leads";

const trim = (value) => String(value || "").trim();

const getEmailDomain = (email) => {
  const parts = trim(email).toLowerCase().split("@");
  return parts.length === 2 ? parts[1] : "";
};

const isOnVerifiedSendGridDomain = (email) =>
  getEmailDomain(email) === VERIFIED_SENDGRID_DOMAIN;

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

  if (!isOnVerifiedSendGridDomain(fromAddress)) {
    return `SENDGRID_FROM must use the verified SendGrid domain ${VERIFIED_SENDGRID_DOMAIN}. Set it to an address like ${DEFAULT_SENDGRID_FROM}.`;
  }

  return null;
};

module.exports = {
  DEFAULT_FROM_NAME,
  DEFAULT_SENDGRID_FROM,
  VERIFIED_SENDGRID_DOMAIN,
  isOnVerifiedSendGridDomain,
  resolveFromAddress,
  validateSendGridFrom,
};
