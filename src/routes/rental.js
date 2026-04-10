const express = require("express");

const schema = require("../validators/rental.schema");
const { calculateRentalQuote } = require("../services/rentalQuote");
const logger = require("../utils/logger");

const router = express.Router();

router.post("/", (req, res) => {
  try {
    logger.info("Rental quote request received", req.body || {});

    const { error, value } = schema.validate(req.body || {});

    if (error) {
      return res.status(400).json({
        error: "Invalid rental data",
        message: error.details?.[0]?.message || "Payload is invalid",
      });
    }

    const quote = calculateRentalQuote(value);
    logger.info("Rental quote result", quote);
    return res.json(quote);
  } catch (err) {
    logger.error("Rental quote error:", err.message || err);
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }

    return res.status(500).json({ error: "Failed to calculate rental quote", message: "Internal server error" });
  }
});

module.exports = router;
