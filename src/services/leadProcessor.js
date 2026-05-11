const schema = require("../validators/lead.schema");
const { sendLeadEmail } = require("./mailer");
const { formatLeadEmail } = require("./formatter");
const { appendLeadToSheet, checkLeadExists, markLeadAsSentToCRM } = require("./sheets");
const { HTTP_STATUS, MESSAGES } = require("../utils/constants");
const logger = require("../utils/logger");

const processLead = async (normalized) => {
  const existingLead = await checkLeadExists(normalized.email);
  if (existingLead) {
    const wasAlreadySent = existingLead.get("sent_to_crm") === "yes";
    return {
      success: false,
      statusCode: HTTP_STATUS.CONFLICT,
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
        statusCode: HTTP_STATUS.CONFLICT,
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
      statusCode: HTTP_STATUS.BAD_REQUEST,
      data: {
        message: MESSAGES.LEAD_VALIDATION_FAILED,
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
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      data: {
        error: MESSAGES.SERVER_ERROR,
        message: MESSAGES.LEAD_EMAIL_FAILED,
      },
    };
  }

  return {
    success: true,
    statusCode: HTTP_STATUS.OK,
    data: {
      message: MESSAGES.LEAD_PROCESSED,
      validated: true,
    },
  };
};

module.exports = { processLead };
