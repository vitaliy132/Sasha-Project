const express = require("express");
const { asyncHandler } = require("../middleware/auth");
const { HTTP_STATUS } = require("../utils/constants");
const logger = require("../utils/logger");
const { sendLeadEmail } = require("../services/mailer");
const { appendLeadToSheet } = require("../services/sheets");

const router = express.Router();

function titleizeKey(key) {
  return String(key)
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatStructuredValue(value) {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map((item) => formatStructuredValue(item)).join(", ");
  if (typeof value === "object") return formatObjectLines(value).join("\n");
  return String(value).trim();
}

function formatObjectLines(payload) {
  return Object.entries(payload || {})
    .map(([key, value]) => {
      const formatted = formatStructuredValue(value);
      if (!formatted) return null;
      return `${titleizeKey(key)}: ${formatted}`;
    })
    .filter(Boolean);
}

function formatObjectBlock(payload, emptyText = "(none provided)") {
  const lines = formatObjectLines(payload);
  return lines.length ? lines.join("\n") : emptyText;
}

/**
 * POST /api/availability-request
 * Store or email availability request
 *
 * Request body:
 * {
 *   name: string,
 *   address: string,
 *   phone: string,
 *   email: string,
 *   rentalDetails: object
 * }
 *
 * Response: { success: true, message: "Availability request submitted successfully" }
 */
router.post("/availability-request", asyncHandler(async (req, res) => {
  logger.info("Availability request received", req.body || {});

  const { name, address, phone, email, rentalDetails } = req.body || {};

  if (!name || !email) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: "Invalid request",
      message: "Name and email are required",
    });
  }

  try {
    // Format the request for email
    const subject = `Availability Request | ${name}`;
    const textBody = `
New Availability Request

Name: ${name}
Address: ${address || "Not provided"}
Phone: ${phone || "Not provided"}
Email: ${email}

Rental Details:
${formatObjectBlock(rentalDetails)}
    `.trim();

    await sendLeadEmail(
      { subject, text: textBody },
      { first_name: name.split(" ")[0], last_name: name.split(" ").slice(1).join(" ") || name }
    );

    // Optionally store in sheet
    try {
      const leadData = {
        first_name: name.split(' ')[0],
        last_name: name.split(' ').slice(1).join(' ') || name,
        email,
        phone: phone || '',
        address: address || '',
        notes: `Availability request:\n${formatObjectBlock(rentalDetails)}`,
      };
      await appendLeadToSheet(leadData, true);
    } catch (sheetErr) {
      logger.warn("Failed to append availability request to sheet", sheetErr.message);
      // Don't fail the request if sheet fails
    }

    logger.info("Availability request processed successfully", { email });
    return res.json({
      success: true,
      message: "Availability request submitted successfully",
    });
  } catch (err) {
    logger.error("Availability request processing error", err.message);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: "Processing failed",
      message: err.message,
    });
  }
}));

module.exports = router;