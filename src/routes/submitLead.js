const express = require("express");
const { processLead } = require("../services/leadProcessor");
const { asyncHandler } = require("../middleware/auth");
const { HTTP_STATUS, MESSAGES } = require("../utils/constants");
const logger = require("../utils/logger");
const schema = require("../validators/calculatorLead.schema");
const {
  splitFullName,
  buildCalculatorRequestSummary,
  formatObjectSection,
  BREAKDOWN_LABELS,
} = require("../services/calculatorLeadSummary");

const router = express.Router();

router.post("/", asyncHandler(async (req, res) => {
  const { error, value } = schema.validate(req.body || {});
  if (error) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: MESSAGES.CALCULATOR_INVALID_PAYLOAD,
      message: error.details?.[0]?.message || "Request body is invalid",
    });
  }

  const quoteStr = value.quote?.trim() || "";
  if (!quoteStr) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: MESSAGES.CALCULATOR_INVALID_PAYLOAD,
      message: "Quote is required",
    });
  }

  const quoteCurrencyRegex = /^\$[\d,]+(\.\d{2})?$/;
  if (!quoteCurrencyRegex.test(quoteStr)) {
    logger.warn("Invalid quote format received", { quote: quoteStr });
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: MESSAGES.CALCULATOR_INVALID_PAYLOAD,
      message: "Quote must be in currency format (e.g., $1,234.56)",
    });
  }

  const { first_name, last_name } = splitFullName(value.name);
  const idLine = value.userId?.trim() ? `User / ManyChat ID: ${value.userId.trim()}` : null;

  const vt = (value.vehicleType || "").trim();
  const calculatorRequestSummary = buildCalculatorRequestSummary(value);
  const customerNotes = (value.additionalNotes || "").trim();

  const notesParts = [
    idLine,
    value.rentalDetails && formatObjectSection("Additional form / calculator fields", value.rentalDetails),
    value.quoteBreakdown && formatObjectSection("Quote breakdown", value.quoteBreakdown, BREAKDOWN_LABELS),
  ].filter(Boolean);
  const notes = notesParts.length ? notesParts.join("\n\n") : undefined;

  logger.info("Rental calculator lead submitted", {
    email: value.email,
    quote: quoteStr,
    userId: value.userId,
    vehicleType: vt || undefined,
    hasRentalDetails: !!value.rentalDetails,
  });

  const normalized = {
    first_name,
    last_name,
    email: value.email.trim(),
    phone: value.phone.trim(),
    address: value.address?.trim(),
    quoted_total: quoteStr,
    calculator_request_summary: calculatorRequestSummary,
    notes,
    platform: "rental-calculator",
  };

  if (customerNotes) normalized.customer_notes = customerNotes;

  const result = await processLead(normalized);
  return res.status(result.statusCode).json(result.data);
}));

module.exports = router;
