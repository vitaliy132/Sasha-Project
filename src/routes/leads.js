// Lead routes
const express = require("express");
const router = express.Router();

const schema = require("../validators/lead.schema");
const { sendLeadEmail } = require("../services/mailer");
const { formatLeadEmail } = require("../services/formatter");
const logger = require("../utils/logger");

router.post("/manychat", async (req, res) => {
  try {
    // 🔐 Verify webhook secret
    if (req.headers["x-webhook-secret"] !== process.env.WEBHOOK_SECRET) {
      return res.status(401).send("Unauthorized");
    }

    // ✅ Validate data
    const { error, value } = schema.validate(req.body);
    if (error) {
      logger.error("Validation error:", error.details);
      return res.status(400).send("Invalid lead data");
    }

    // 🧩 Format email
    const emailBody = formatLeadEmail(value);

    // 📧 Send email
    await sendLeadEmail(emailBody, value);

    return res.status(200).send("Lead accepted");
  } catch (err) {
    logger.error("Lead processing error:", err);
    return res.status(500).send("Server error");
  }
});

module.exports = router;
