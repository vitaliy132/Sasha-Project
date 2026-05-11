/**
 * Standardized response formatting for API endpoints
 * All API responses follow a consistent structure
 */

const { HTTP_STATUS } = require("./constants");

/**
 * Format a successful response
 */
function successResponse(data = {}, message = "Success") {
  return {
    success: true,
    message,
    data,
  };
}

/**
 * Format an error response
 */
function errorResponse(message = "An error occurred", statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR, details = null) {
  const response = {
    success: false,
    message,
  };
  if (details) {
    response.details = details;
  }
  return { statusCode, data: response };
}

/**
 * Format a validation error response
 */
function validationErrorResponse(joiError) {
  const details = joiError.details?.map(detail => ({
    field: detail.path.join("."),
    message: detail.message,
  })) || [];
  
  return errorResponse(
    "Validation failed",
    HTTP_STATUS.BAD_REQUEST,
    details
  );
}

module.exports = {
  successResponse,
  errorResponse,
  validationErrorResponse,
};
