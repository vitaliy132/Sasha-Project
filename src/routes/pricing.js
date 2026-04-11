const express = require("express");
const pricingSchema = require("../validators/pricing.schema");
const { calculatePrice } = require("../services/pricingEngine");
const { asyncHandler } = require("../middleware/auth");
const { HTTP_STATUS, MESSAGES } = require("../utils/constants");
const logger = require("../utils/logger");

const router = express.Router();

/**
 * POST /calculate
 * Calculate rental pricing with detailed breakdown
 *
 * Request body:
 * {
 *   unitId: string (optional),
 *   unitType: "class_a" | "class_b" | "class_c" | "trailer",
 *   unitModel: string,
 *   startDate: "YYYY-MM-DD",
 *   endDate: "YYYY-MM-DD",
 *   mileage: { type: "package" | "per_km", value: number } (optional)
 * }
 *
 * Response: { unitId, unitType, unitModel, startDate, endDate, days, dailyRates, basePrice, cdw, preparationFee, mileageCost, hitchFee, subtotal, tax, total, totalFormatted }
 */
router.post("/", asyncHandler(async (req, res) => {
  logger.info("Pricing request received", req.body || {});

  const { error, value } = pricingSchema.validate(req.body || {});

  if (error) {
    logger.warn("Pricing validation error", error.message);
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: "Invalid request",
      message: error.details?.[0]?.message || "Payload is invalid",
    });
  }

  try {
    const result = calculatePrice(value);
    logger.info("Pricing calculation success", { total: result.total, days: result.days });
    return res.json(result);
  } catch (err) {
    logger.error("Pricing calculation error", err.message);
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: "Pricing calculation failed",
      message: err.message,
    });
  }
}));

module.exports = router;
