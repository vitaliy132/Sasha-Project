const nodemailer = require("nodemailer");
const sgMail = require("@sendgrid/mail");
const axios = require("axios");

const useSendGrid = !!process.env.SENDGRID_API_KEY;
const useMailerSendAPI = !!process.env.MAILERSEND_API_KEY;
const useMailerSendSMTP = !!process.env.MAILERSEND_SMTP_USER && !!process.env.MAILERSEND_SMTP_PASS;
const FROM_ADDRESS = process.env.MAILERSEND_SMTP_USER || process.env.MAILERSEND_FROM || process.env.SENDGRID_FROM || process.env.SMTP_USER || process.env.CRM_EMAIL;
const FROM_NAME = "ManyChat Leads";

if (!FROM_ADDRESS) {
  throw new Error(
    "Email sender address is not configured. Set MAILERSEND_SMTP_USER, MAILERSEND_FROM, SENDGRID_FROM, SMTP_USER, or CRM_EMAIL."
  );
}

if (useSendGrid) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const smtpTransporter = nodemailer.createTransport({
  host: process.env.MAILERSEND_SMTP_HOST || process.env.SMTP_HOST,
  port: Number(process.env.MAILERSEND_SMTP_PORT || process.env.SMTP_PORT || 587),
  secure: Number(process.env.MAILERSEND_SMTP_PORT || process.env.SMTP_PORT || 587) === 465,
  auth: {
    user: process.env.MAILERSEND_SMTP_USER || process.env.SMTP_USER,
    pass: process.env.MAILERSEND_SMTP_PASS || process.env.SMTP_PASS,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
  tls: {
    rejectUnauthorized: false,
  },
});

exports.verifySmtp = async () => {
  if (useSendGrid || useMailerSendAPI || useMailerSendSMTP) {
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

  if (useMailerSendSMTP) {
    // Use MailerSend SMTP
    const mailOptions = {
      from: `"ManyChat Leads" <${FROM_ADDRESS}>`,
      to: process.env.CRM_EMAIL,
      subject,
      text,
      ...(html ? { html } : {}),
    };
    await smtpTransporter.sendMail(mailOptions);
    return;
  }

  if (useMailerSendAPI) {
    try {
      const response = await axios.post(
        "https://api.mailersend.com/v1/email",
        {
          from: {
            email: FROM_ADDRESS,
            name: FROM_NAME,
          },
          to: [
            {
              email: process.env.CRM_EMAIL,
              name: "Sales Team",
            },
          ],
          subject,
          text,
          html,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.MAILERSEND_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
      return response.data;
    } catch (error) {
      throw new Error(`MailerSend API error: ${error.response?.data?.message || error.message}`);
    }
  }

  if (useSendGrid) {
    await sgMail.send({
      to: process.env.CRM_EMAIL,
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

  const mailOptions = {
    from: `"ManyChat Leads" <${FROM_ADDRESS}>`,
    to: process.env.CRM_EMAIL,
    subject,
    text,
    ...(html ? { html } : {}),
  };

  await smtpTransporter.sendMail(mailOptions);
};
