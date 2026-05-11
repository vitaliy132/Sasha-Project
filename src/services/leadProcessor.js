const schema = require("../validators/lead.schema");
const { sendLeadEmail } = require("./mailer");
const { formatLeadEmail } = require("./formatter");
const { appendLeadToSheet, checkLeadExists, markLeadAsSentToCRM } = require("./sheets");
const { HTTP_STATUS, MESSAGES } = require("../utils/constants");
const logger = require("../utils/logger");
const { successResponse, errorResponse } = require("../utils/responseFormatter");

const processLead = async (normalized) => {
  const existingLead = await checkLeadExists(normalized.email);
  if (existingLead) {
    const wasAlreadySent = existingLead.get("sent_to_crm") === "yes";
    const message = wasAlreadySent
      ? "Lead already sent to CRM (duplicate)"
      : "Lead already exists in system (may have failed validation)";
    const { statusCode, data } = errorResponse(message, HTTP_STATUS.CONFLICT);
    return { statusCode, data: { ...data, duplicate: true, validated: existingLead.get("validated") } };
  }

  const { error, value } = schema.validate(normalized);
  const isValid = !error;

  try {
    const appended = await appendLeadToSheet(normalized, isValid);
    if (!appended) {
      const { statusCode, data } = errorResponse("Lead already exists in sheet (duplicate)", HTTP_STATUS.CONFLICT);
      return { statusCode, data: { ...data, duplicate: true } };
    }
  } catch (sheetErr) {
    logger.error("Failed to append to Google Sheets:", sheetErr.message || sheetErr);
  }

  if (!isValid) {
    // For backward compatibility with tests, use 'errors' field instead of 'details'
    const errorDetails = error.details?.map(detail => ({
      field: detail.path.join("."),
      message: detail.message,
    })) || [];
    
    return {
      statusCode: HTTP_STATUS.BAD_REQUEST,
      data: {
        success: false,
        message: "Lead data incomplete or invalid. Appended to sheets with validated: no",
        errors: errorDetails,
      },
    };
  }

  try {
    const emailBody = formatLeadEmail(value);
    await sendLeadEmail(emailBody, value);
    await markLeadAsSentToCRM(normalized.email);
  } catch (emailErr) {
    logger.error("Failed to send lead email:", emailErr.message || emailErr);
    const { statusCode, data } = errorResponse(
      "Failed to process lead",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
    return { statusCode, data };
  }

  return {
    statusCode: HTTP_STATUS.OK,
    data: successResponse({ validated: true }, MESSAGES.LEAD_PROCESSED),
  };
};

module.exports = { processLead };
