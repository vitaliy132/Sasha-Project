const Joi = require("joi");
const { calculatorTripFieldsLoose } = require("./calculatorFields.schema");

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
}).keys(calculatorTripFieldsLoose);
