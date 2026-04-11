const express = require("express");

const schema = require("../validators/rental.schema");
const { calculateRentalQuote } = require("../services/rentalQuote");
const { asyncHandler } = require("../middleware/auth");
const { HTTP_STATUS, MESSAGES } = require("../utils/constants");
const logger = require("../utils/logger");

const router = express.Router();

router.post("/", asyncHandler(async (req, res) => {
  logger.info("Rental quote request received", req.body || {});

  const { error, value } = schema.validate(req.body || {});

  if (error) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: MESSAGES.RENTAL_INVALID_DATA,
      message: error.details?.[0]?.message || "Payload is invalid",
    });
  }

  try {
    const quote = calculateRentalQuote(value);
    
    if (!quote) {
      logger.error("calculateRentalQuote returned undefined or null", { input: value });
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: "Calculation failed",
        message: "Unable to calculate rental quote",
      });
    }
    
    logger.info("Rental quote result", quote);
    return res.status(HTTP_STATUS.OK).json(quote);
  } catch (err) {
    logger.error("Rental quote calculation error", {
      error: err.message || err,
      statusCode: err.statusCode,
    });
    
    const statusCode = err.statusCode || HTTP_STATUS.BAD_REQUEST;
    return res.status(statusCode).json({
      error: "Calculation failed",
      message: err.message || "Unable to calculate rental quote",
    });
  }
}));

module.exports = router;
