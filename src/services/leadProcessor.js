const schema = require("../validators/lead.schema");
const { sendLeadEmail } = require("./mailer");
const { formatLeadEmail } = require("./formatter");
const { appendLeadToSheet, checkLeadExists, markLeadAsSentToCRM } = require("./sheets");
const logger = require("../utils/logger");

const processLead = async (normalized) => {
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

  try {
    const appended = await appendLeadToSheet(normalized, isValid);
    if (!appended) {
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

  try {
    const emailBody = formatLeadEmail(value);
    await sendLeadEmail(emailBody, value);
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

module.exports = { processLead };
