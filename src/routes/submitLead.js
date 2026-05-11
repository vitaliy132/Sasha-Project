const express = require("express");
const { processLead } = require("../services/leadProcessor");
const { asyncHandler } = require("../middleware/auth");
const { HTTP_STATUS, MESSAGES } = require("../utils/constants");
const logger = require("../utils/logger");
const schema = require("../validators/calculatorLead.schema");
const { successResponse, errorResponse, validationErrorResponse } = require("../utils/responseFormatter");
const { isValidCurrencyFormat } = require("../utils/quoteValidator");

const router = express.Router();

function splitFullName(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first_name = parts[0] || "Customer";
  const last_name = parts.length > 1 ? parts.slice(1).join(" ") : first_name;
  return { first_name, last_name };
}

router.post("/", asyncHandler(async (req, res) => {
  const { error, value } = schema.validate(req.body || {});
  if (error) {
    const { statusCode, data } = validationErrorResponse(error);
    return res.status(statusCode).json(data);
  }

  // Validate quote format
  const quoteStr = value.quote?.trim() || "";
  if (!quoteStr) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json(
      errorResponse("Quote is required", HTTP_STATUS.BAD_REQUEST).data
    );
  }

  if (!isValidCurrencyFormat(quoteStr)) {
    logger.warn("Invalid quote format received", { quote: quoteStr });
    return res.status(HTTP_STATUS.BAD_REQUEST).json(
      errorResponse(
        "Quote must be in currency format (e.g., $1,234.56)",
        HTTP_STATUS.BAD_REQUEST
      ).data
    );
  }

  const { first_name, last_name } = splitFullName(value.name);
  const idLine = value.userId?.trim() ? `User / ManyChat ID: ${value.userId.trim()}` : null;
  const notes = [
    `Rental calculator quote: ${quoteStr}`,
    idLine,
  ]
    .filter(Boolean)
    .join("\n");

  logger.info("Rental calculator lead submitted", {
    email: value.email,
    quote: quoteStr,
    userId: value.userId,
  });

  const normalized = {
    first_name,
    last_name,
    email: value.email.trim(),
    phone: value.phone.trim(),
    address: value.address?.trim(),
    notes: notes || undefined,
    platform: "rental-calculator",
  };

  const result = await processLead(normalized);
  return res.status(result.statusCode).json(result.data);
}));

module.exports = router;
