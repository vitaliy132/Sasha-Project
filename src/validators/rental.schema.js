const Joi = require("joi");
const { isIsoDate, validateDateRange } = require("./dateValidation");

module.exports = Joi.object({
  startDate: Joi.string().required().custom(isIsoDate, "ISO date validation"),
  endDate: Joi.string().required().custom(isIsoDate, "ISO date validation"),
  vehicleType: Joi.string().valid("classA", "classB", "classC", "trailer").required(),
  vehicleModel: Joi.string().trim().min(1).required(),
  cancellationWaiver: Joi.boolean().optional().default(false),
  windshieldCoverage: Joi.boolean().optional().default(false),
  generatorDailyUnlimited: Joi.boolean().optional().default(false),
  /** Count of prepaid 1,000 km packages ($350 each per PDF) */
  kmPackages: Joi.number().integer().min(0).required(),
  /** Count of prepaid 100 km packages ($39 each per PDF) */
  kmPackages100: Joi.number().integer().min(0).optional().default(0),
  generatorHours: Joi.number().min(0).optional().default(0),
  extraKm: Joi.number().min(0).optional().default(0),
  kitchenKit: Joi.boolean().optional().default(false),
  beddingKitPeople: Joi.number().integer().min(0).optional().default(0),
  bikeRack: Joi.boolean().optional().default(false),
  hasOwnHitch: Joi.boolean().optional().default(false),
})
  .custom(validateDateRange, "date range validation")
  .messages({
    "date.invalid": "Date fields must be valid ISO date strings",
    "any.invalid": "{{#message}}",
  });
