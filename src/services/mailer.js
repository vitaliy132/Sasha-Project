const nodemailer = require("nodemailer");
const sgMail = require("@sendgrid/mail");

const useSendGrid = !!process.env.SENDGRID_API_KEY;
const FROM_ADDRESS = process.env.SENDGRID_FROM || process.env.SMTP_USER || process.env.CRM_EMAIL;
/** Display name shown in the inbox (SendGrid + SMTP). */
const FROM_NAME = (process.env.SENDGRID_FROM_NAME || "ManyChat Leads").trim() || "ManyChat Leads";

/**
 * Lead mail "To" vs Bcc: when LEAD_EMAIL_TO is set and differs from CRM_EMAIL, the visible To line
 * uses LEAD_EMAIL_TO (e.g. leads@em9990.rvvacations.com) and CRM_EMAIL receives a Bcc copy so a
 * personal inbox address is not shown as the primary recipient.
 */
const getLeadNotificationRecipients = () => {
  const crm = String(process.env.CRM_EMAIL || "").trim();
  const publicTo = String(process.env.LEAD_EMAIL_TO || "").trim();
  const usePublicTo = publicTo.length > 0 && publicTo.toLowerCase() !== crm.toLowerCase();
  return usePublicTo ? { to: publicTo, bcc: crm } : { to: crm, bcc: undefined };
};
exports.getLeadNotificationRecipients = getLeadNotificationRecipients;

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
    from: `"ManyChat Leads" <${FROM_ADDRESS}>`,
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
