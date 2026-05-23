const nodemailer = require("nodemailer");
const sgMail = require("@sendgrid/mail");
const {
  DEFAULT_FROM_NAME,
  resolveFromAddress,
  validateSendGridFrom,
} = require("./emailConfig");
const { getLeadNotificationRecipients } = require("./leadRecipients");

const useSendGrid = !!process.env.SENDGRID_API_KEY?.trim();
const FROM_ADDRESS = resolveFromAddress();
/** Display name shown in the inbox (SendGrid + SMTP). */
const FROM_NAME = (process.env.SENDGRID_FROM_NAME || DEFAULT_FROM_NAME).trim() || DEFAULT_FROM_NAME;

exports.getLeadNotificationRecipients = getLeadNotificationRecipients;

const sendGridFromError = validateSendGridFrom();
if (sendGridFromError) {
  throw new Error(sendGridFromError);
}

if (!FROM_ADDRESS) {
  throw new Error(
    "Email sender address is not configured. Set SENDGRID_FROM, SMTP_USER, or CRM_EMAIL."
  );
}

if (useSendGrid) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const smtpTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

exports.verifySmtp = async () => {
  if (useSendGrid) {
    return true;
  }
  return smtpTransporter.verify();
};

exports.sendLeadEmail = async (body, lead) => {
  const isStringBody = typeof body === "string";
  const subject = isStringBody
    ? `New Lead | ${lead.first_name} ${lead.last_name}`.trim()
    : body.subject || `New Lead | ${lead.first_name || ""} ${lead.last_name || ""}`.trim();
  const text = isStringBody ? body : body.text;
  const html = isStringBody ? undefined : body.html;

  const { to, bcc } = getLeadNotificationRecipients();

  const mailOptions = {
    from: `"${FROM_NAME}" <${FROM_ADDRESS}>`,
    to,
    ...(bcc ? { bcc } : {}),
    subject,
    text,
    ...(html ? { html } : {}),
  };

  if (useSendGrid) {
    await sgMail.send({
      to,
      ...(bcc ? { bcc } : {}),
      from: {
        email: FROM_ADDRESS,
        name: FROM_NAME,
      },
      subject,
      text,
      ...(html ? { html } : {}),
    });
    return;
  }

  await smtpTransporter.sendMail(mailOptions);
};
