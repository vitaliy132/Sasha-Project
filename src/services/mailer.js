const nodemailer = require("nodemailer");
const sgMail = require("@sendgrid/mail");

const useSendGrid = !!process.env.SENDGRID_API_KEY;
const FROM_ADDRESS = process.env.SENDGRID_FROM || process.env.SMTP_USER || process.env.CRM_EMAIL;

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
  const subject = `New Lead | ${lead.first_name} ${lead.last_name}`;

  if (useSendGrid) {
    await sgMail.send({
      to: process.env.CRM_EMAIL,
      from: FROM_ADDRESS,
      subject,
      text: body,
    });
    return;
  }

  await smtpTransporter.sendMail({
    from: `"ManyChat Leads" <${process.env.SMTP_USER}>`,
    to: process.env.CRM_EMAIL,
    subject,
    text: body,
  });
};
