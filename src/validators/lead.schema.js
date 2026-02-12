// Lead validation schema
const Joi = require("joi");

module.exports = Joi.object({
  first_name: Joi.string().min(2).required(),
  last_name: Joi.string().min(2).required(),
  email: Joi.string().allow(""),
  phone: Joi.string().min(6),
  interest: Joi.string().allow(""),
  notes: Joi.string().allow(""),
  platform: Joi.string(),
  campaign: Joi.string().allow(""),
});
