const express = require("express");
const { processLead } = require("../services/leadProcessor");
const { asyncHandler } = require("../middleware/auth");
const { HTTP_STATUS, MESSAGES } = require("../utils/constants");
const logger = require("../utils/logger");
const schema = require("../validators/calculatorLead.schema");

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
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: MESSAGES.CALCULATOR_INVALID_PAYLOAD,
      message: error.details?.[0]?.message || "Request body is invalid",
    });
  }

  const { first_name, last_name } = splitFullName(value.name);
  const idLine = value.userId?.trim() ? `User / ManyChat ID: ${value.userId.trim()}` : null;
  const notes = [
    value.quote?.trim() ? `Rental calculator quote: ${value.quote.trim()}` : null,
    idLine,
  ]
    .filter(Boolean)
    .join("\n");

  const normalized = {
    first_name,
    last_name,
    email: value.email.trim(),
    phone: value.phone.trim(),
    notes: notes || undefined,
    platform: "rental-calculator",
  };

  const result = await processLead(normalized);
  return res.status(result.statusCode).json(result.data);
}));

module.exports = router;
