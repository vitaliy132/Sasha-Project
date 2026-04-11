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

  const quote = calculateRentalQuote(value);
  logger.info("Rental quote result", quote);
  return res.json(quote);
}));

module.exports = router;
