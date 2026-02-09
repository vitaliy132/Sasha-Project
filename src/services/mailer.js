// Mailer service
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

exports.sendLeadEmail = async (body, lead) => {
  await transporter.sendMail({
    from: `"ManyChat Leads" <${process.env.SMTP_USER}>`,
    to: process.env.CRM_EMAIL,
    subject: `New Lead | ${lead.first_name} ${lead.last_name}`,
    text: body,
  });
};
