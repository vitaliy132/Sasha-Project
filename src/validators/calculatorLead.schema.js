const Joi = require("joi");

module.exports = Joi.object({
  userId: Joi.string().trim().allow("").optional().default(""),
  name: Joi.string().trim().min(2).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().trim().min(6).required(),
  quote: Joi.string().trim().allow("").optional().default(""),
});