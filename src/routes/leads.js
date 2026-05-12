const express = require("express");
const router = express.Router();

const { processLead } = require("../services/leadProcessor");
const { sendLeadEmail } = require("../services/mailer");
const { asyncHandler, validateWebhookSecret } = require("../middleware/auth");
const logger = require("../utils/logger");

const isAuthorized = (providedSecret) => providedSecret === process.env.WEBHOOK_SECRET;
const buildTestLead = () => ({
  first_name: "Test",
  last_name: "Lead",
  /** Placeholder only — do not mirror CRM_EMAIL here or it appears in the lead "Email" row. */
  email: "test-lead@example.com",
  phone: "555-0000",
  platform: "manual-test",
});

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

const normalizeLeadPayload = (payload) => {
  const phone = payload.phone || payload.cell_phone || payload.home_phone || "";

  return {
    first_name: payload.first_name,
    last_name: payload.last_name,
    email: payload.email,
    phone,
    ...(payload.interest && { interest: payload.interest }),
    ...(payload.notes && { notes: payload.notes }),
    ...(payload.platform && { platform: payload.platform }),
    ...(payload.campaign && { campaign: payload.campaign }),
  };
};

router.get("/manychat", (req, res) => {
  return res.status(200).json({
    message: "ManyChat leads endpoint is live. Use POST with JSON body.",
    method: "POST",
    path: "/api/leads/manychat",
  });
});

router.post("/test", validateWebhookSecret, asyncHandler(async (req, res) => {
  return sendTestEmailResponse(res, {
    successText: "Test email sent",
    failureText: "Test email failed.",
    logPrefix: "Test email error:",
  });
}));

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

router.post("/manychat", validateWebhookSecret, asyncHandler(async (req, res) => {
  const normalized = normalizeLeadPayload(req.body || {});
  const result = await processLead(normalized);

  return res.status(result.statusCode).json(result.data);
}));

module.exports = router;
