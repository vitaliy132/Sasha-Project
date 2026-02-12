// Lead routes
const express = require("express");
const router = express.Router();

const schema = require("../validators/lead.schema");
const { sendLeadEmail } = require("../services/mailer");
const { formatLeadEmail } = require("../services/formatter");
const { appendLeadToSheet, checkLeadExists, markLeadAsSentToCRM } = require("../services/sheets");
const logger = require("../utils/logger");

// Constants
const isAuthorized = (providedSecret) => providedSecret === process.env.WEBHOOK_SECRET;

// Test lead template
const buildTestLead = () => ({
  first_name: "Test",
  last_name: "Lead",
  email: process.env.CRM_EMAIL,
  phone: "555-0000",
  platform: "manual-test",
});

/**
 * Send test email with standardized response handling
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

/**
 * Normalize ManyChat payload to internal lead format
 * Handles multiple phone field variations
 */
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

/**
 * Process and validate lead
 */
const processLead = async (normalized) => {
  // Check for duplicate lead by email
  const existingLead = await checkLeadExists(normalized.email);
  if (existingLead) {
    const wasAlreadySent = existingLead.get("sent_to_crm") === "yes";
    return {
      success: false,
      statusCode: 409,
      data: {
        message: wasAlreadySent
          ? "Lead already sent to CRM (duplicate)"
          : "Lead already exists in system (may have failed validation)",
        validated: existingLead.get("validated"),
        duplicate: true,
      },
    };
  }

  const { error, value } = schema.validate(normalized);
  const isValid = !error;

  // Always log to Google Sheets
  try {
    const appended = await appendLeadToSheet(normalized, isValid);
    if (!appended) {
      // Duplicate detected during append (race condition)
      return {
        success: false,
        statusCode: 409,
        data: {
          message: "Lead already exists in sheet (duplicate)",
          duplicate: true,
        },
      };
    }
  } catch (sheetErr) {
    logger.error("Failed to append to Google Sheets:", sheetErr.message || sheetErr);
  }

  if (!isValid) {
    return {
      success: false,
      statusCode: 400,
      data: {
        message: "Lead data incomplete or invalid. Appended to sheets with validated: no",
        errors: error.details,
      },
    };
  }

  // Send to CRM if valid
  try {
    const emailBody = formatLeadEmail(value);
    await sendLeadEmail(emailBody, value);

    // Mark as sent to CRM after successful send
    await markLeadAsSentToCRM(normalized.email);
  } catch (emailErr) {
    logger.error("Failed to send lead email:", emailErr.message || emailErr);
    return {
      success: false,
      statusCode: 500,
      data: {
        error: "Server error",
        message: "Lead validated but email delivery failed",
      },
    };
  }

  return {
    success: true,
    statusCode: 200,
    data: {
      message: "Lead accepted and sent to CRM",
      validated: true,
    },
  };
};

// Routes

router.get("/manychat", (req, res) => {
  return res.status(200).json({
    message: "ManyChat leads endpoint is live. Use POST with JSON body.",
    method: "POST",
    path: "/api/leads/manychat",
  });
});

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
    // Verify webhook secret
    if (!isAuthorized(req.headers["x-webhook-secret"])) {
      return res.status(401).send("Unauthorized");
    }

    // Normalize and process lead
    const normalized = normalizeLeadPayload(req.body || {});
    const result = await processLead(normalized);

    return res.status(result.statusCode).json(result.data);
  } catch (err) {
    logger.error("Lead processing error:", err.message || err);
    if (err.code) logger.error("Error code:", err.code);
    return res.status(500).json({
      error: "Server error",
      message: "Lead could not be processed.",
    });
  }
});

module.exports = router;
