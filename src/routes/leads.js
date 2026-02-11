// Lead routes
const express = require("express");
const router = express.Router();

const schema = require("../validators/lead.schema");
const { sendLeadEmail } = require("../services/mailer");
const { formatLeadEmail } = require("../services/formatter");
const logger = require("../utils/logger");

const isAuthorized = (providedSecret) => providedSecret === process.env.WEBHOOK_SECRET;

const buildTestLead = () => ({
  first_name: "Test",
  last_name: "Lead",
  email: process.env.CRM_EMAIL,
  phone: "",
  platform: "manual-test",
});

/**
 * Shared helper to send the fixed test email body "123" to the CRM address,
 * and standardize success / error handling for the test endpoints.
 */
const sendTestEmailResponse = async (res, { successText, failureText, logPrefix }) => {
  try {
    await sendLeadEmail("123", buildTestLead());
    return res.status(200).send(successText);
  } catch (err) {
    logger.error(logPrefix, err.message || err);
    if (err.code) logger.error("Error code:", err.code);
    return res.status(500).json({ error: "Server error", message: failureText });
  }
};

// Normalize ManyChat-style payloads into our internal lead shape.
// Accepts:
// - phone
// - home_phone / cell_phone (ManyChat example you sent)
// and fills optional fields with sensible defaults.
const normalizeLeadPayload = (payload) => {
  const phone = payload.phone || payload.cell_phone || payload.home_phone || "";

  return {
    first_name: payload.first_name,
    last_name: payload.last_name,
    ...(payload.email && { email: payload.email }),
    ...(phone && { phone }),
    ...(payload.interest && { interest: payload.interest }),
    ...(payload.notes && { notes: payload.notes }),
    ...(payload.platform && { platform: payload.platform }),
    ...(payload.campaign && { campaign: payload.campaign }),
  };
};

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
// POST is for tools / scripts (header-based secret).
router.post("/test", async (req, res) => {
  if (!isAuthorized(req.headers["x-webhook-secret"])) {
    return res.status(401).send("Unauthorized");
  }

  return sendTestEmailResponse(res, {
    successText: "Test email sent",
    failureText: "Test email failed.",
    logPrefix: "Test email error:",
  });
});

// GET variant for quick manual testing from a browser:
// https://.../api/leads/test?secret=YOUR_WEBHOOK_SECRET
router.get("/test", async (req, res) => {
  if (!isAuthorized(req.query.secret)) {
    return res.status(401).send("Unauthorized");
  }

  return sendTestEmailResponse(res, {
    successText: "Test email sent (GET)",
    failureText: "Test email (GET) failed.",
    logPrefix: "Test email (GET) error:",
  });
});

router.post("/manychat", async (req, res) => {
  try {
    // 🔐 Verify webhook secret
    if (!isAuthorized(req.headers["x-webhook-secret"])) {
      return res.status(401).send("Unauthorized");
    }

    // ✅ Normalize incoming payload (ManyChat) and validate
    const normalized = normalizeLeadPayload(req.body || {});
    const { error, value } = schema.validate(normalized);
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
