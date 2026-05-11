const express = require("express");

const schema = require("../validators/rental.schema");
const { calculateRentalQuote } = require("../services/rentalQuote");
const { asyncHandler } = require("../middleware/auth");
const { HTTP_STATUS, MESSAGES } = require("../utils/constants");
const logger = require("../utils/logger");
const { errorResponse, validationErrorResponse } = require("../utils/responseFormatter");

const router = express.Router();

router.post("/", asyncHandler(async (req, res) => {
  logger.info("Rental quote request received", req.body || {});

  const { error, value } = schema.validate(req.body || {});

  if (error) {
    const { statusCode, data } = validationErrorResponse(error);
    return res.status(statusCode).json(data);
  }

  try {
    const quote = calculateRentalQuote(value);
    
    if (!quote) {
      logger.error("calculateRentalQuote returned undefined or null", { input: value });
      const { statusCode, data } = errorResponse(
        "Unable to calculate rental quote",
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
      return res.status(statusCode).json(data);
    }
    
    logger.info("Rental quote result", quote);
    // Return quote directly for backward compatibility with frontend
    return res.status(HTTP_STATUS.OK).json(quote);
  } catch (err) {
    logger.error("Rental quote calculation error", {
      error: err.message || err,
      statusCode: err.statusCode,
    });
    
    const statusCode = err.statusCode || HTTP_STATUS.BAD_REQUEST;
    const { data } = errorResponse(
      err.message || "Unable to calculate rental quote",
      statusCode
    );
    return res.status(statusCode).json(data);
  }
}));

module.exports = router;
