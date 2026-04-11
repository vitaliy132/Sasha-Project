module.exports = {
  HTTP_STATUS: {
    OK: 200,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    CONFLICT: 409,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500,
  },
  MESSAGES: {
    UNAUTHORIZED: "Unauthorized",
    SERVER_ERROR: "Server error",
    LEAD_PROCESSED: "Lead accepted and sent to CRM",
    LEAD_VALIDATION_FAILED: "Lead data incomplete or invalid. Appended to sheets with validated: no",
    LEAD_EMAIL_FAILED: "Lead validated but email delivery failed",
    RENTAL_INVALID_DATA: "Invalid rental data",
    CALCULATOR_INVALID_PAYLOAD: "Invalid payload",
  },
};