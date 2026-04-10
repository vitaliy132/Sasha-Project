const express = require("express");
const Joi = require("joi");
const { processLead } = require("../services/leadProcessor");
const logger = require("../utils/logger");

const router = express.Router();

const bodySchema = Joi.object({
  userId: Joi.string().trim().allow("").optional().default(""),
  name: Joi.string().trim().min(2).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().trim().min(6).required(),
  quote: Joi.string().trim().allow("").optional().default(""),
});

function splitFullName(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first_name = parts[0] || "Customer";
  const last_name = parts.length > 1 ? parts.slice(1).join(" ") : first_name;
  return { first_name, last_name };
}

router.post("/", async (req, res) => {
  try {
    const { error, value } = bodySchema.validate(req.body || {});
    if (error) {
      return res.status(400).json({
        error: "Invalid payload",
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
  } catch (err) {
    logger.error("Calculator lead submit error:", err.message || err);
    return res.status(500).json({
      error: "Server error",
      message: "Lead could not be processed.",
    });
  }
});

module.exports = router;
