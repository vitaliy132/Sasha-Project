// Lead routes
const express = require("express");
const router = express.Router();

const schema = require("../validators/lead.schema");
const { sendLeadEmail } = require("../services/mailer");
const { formatLeadEmail } = require("../services/formatter");
const logger = require("../utils/logger");

// ManyChat may do a GET when you paste/test the URL in the UI.
// Keep GET simple so the URL looks healthy in a browser,
// while POST is used for the actual webhook.
router.get("/manychat", (req, res) => {
  return res.status(200).json({
    message: "ManyChat leads endpoint is live. Use POST with JSON body.",
    method: "POST",
    path: "/api/leads/manychat",
  });
});

// Simple protected test endpoint: sends a test email with body "123"
router.post("/test", async (req, res) => {
  try {
    if (req.headers["x-webhook-secret"] !== process.env.WEBHOOK_SECRET) {
      return res.status(401).send("Unauthorized");
    }

    const testLead = {
      first_name: "Test",
      last_name: "Lead",
      email: process.env.CRM_EMAIL,
      phone: "",
      platform: "manual-test",
    };

    const body = "123";
    await sendLeadEmail(body, testLead);

    return res.status(200).send("Test email sent");
  } catch (err) {
    logger.error("Test email error:", err.message || err);
    if (err.code) logger.error("Error code:", err.code);
    return res.status(500).json({ error: "Server error", message: "Test email failed." });
  }
});

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
    logger.error("Lead processing error:", err.message || err);
    if (err.code) logger.error("Error code:", err.code);
    return res.status(500).json({ error: "Server error", message: "Lead could not be sent." });
  }
});

module.exports = router;
