const Joi = require("joi");

/** Optional fields sent with “Submit request” from the rental calculator (vehicle, dates, add-ons). */
const calculatorExtras = {
  vehicleType: Joi.string().valid("classA", "classB", "classC", "trailer").allow("").optional().default(""),
  vehicleModel: Joi.string().trim().allow("").optional().default(""),
  /** Human-readable model name from the UI (optional). */
  vehicleModelLabel: Joi.string().trim().allow("").optional().default(""),
  startDate: Joi.string().trim().allow("").optional().default(""),
  endDate: Joi.string().trim().allow("").optional().default(""),
  cancellationWaiver: Joi.boolean().optional(),
  windshieldCoverage: Joi.boolean().optional(),
  generatorDailyUnlimited: Joi.boolean().optional(),
  kmPackages: Joi.number().integer().min(0).optional(),
  kmPackages100: Joi.number().integer().min(0).optional(),
  generatorHours: Joi.number().min(0).optional(),
  extraKm: Joi.number().min(0).optional(),
  kitchenKit: Joi.boolean().optional(),
  beddingKitPeople: Joi.number().integer().min(0).optional(),
  /** Alias for beddingKitPeople (Personal Kit count in the UI). */
  personalKitPeople: Joi.number().integer().min(0).optional(),
  bikeRack: Joi.boolean().optional(),
  hasOwnHitch: Joi.boolean().optional(),
  additionalNotes: Joi.string().trim().allow("").optional().default(""),
  /** Any extra structured payload from the frontend (preserved verbatim in the lead email). */
  rentalDetails: Joi.object().unknown(true).optional(),
  quoteBreakdown: Joi.object().unknown(true).optional(),
};

module.exports = Joi.object({
  userId: Joi.string().trim().allow("").optional().default(""),
  name: Joi.string().trim().min(2).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().trim().min(6).required(),
  address: Joi.string().trim().allow("").optional().default(""),
  quote: Joi.string().trim().min(4).required().messages({
    "string.empty": "Quote is required",
    "string.min": "Quote must be a valid currency amount",
  }),
}).keys(calculatorExtras);