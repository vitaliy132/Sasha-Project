const Joi = require("joi");
const { isIsoDate, validateDateRange } = require("./dateValidation");
const { calculatorTripFieldsStrict } = require("./calculatorFields.schema");

module.exports = Joi.object({
  startDate: Joi.string().required().custom(isIsoDate, "ISO date validation"),
  endDate: Joi.string().required().custom(isIsoDate, "ISO date validation"),
  ...calculatorTripFieldsStrict,
})
  .custom(validateDateRange, "date range validation")
  .messages({
    "date.invalid": "Date fields must be valid ISO date strings",
    "any.invalid": "{{#message}}",
  });
