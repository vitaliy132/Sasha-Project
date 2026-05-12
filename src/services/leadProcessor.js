const schema = require("../validators/lead.schema");
const { sendLeadEmail } = require("./mailer");
const { formatLeadEmail } = require("./formatter");
const { appendLeadToSheet, markLeadAsSentToCRM } = require("./sheets");
const { HTTP_STATUS, MESSAGES } = require("../utils/constants");
const logger = require("../utils/logger");

const processLead = async (normalized) => {
  const { error, value } = schema.validate(normalized);
  const isValid = !error;

  /** Row created for this submission (used to set sent_to_crm without touching older rows for the same email). */
  let sheetRow = null;
  try {
    sheetRow = await appendLeadToSheet(normalized, isValid);
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
    await markLeadAsSentToCRM(sheetRow);
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
