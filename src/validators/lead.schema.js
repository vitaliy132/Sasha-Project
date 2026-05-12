const Joi = require("joi");

module.exports = Joi.object({
  first_name: Joi.string().min(2).required(),
  last_name: Joi.string().min(2).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().min(6).required(),
  address: Joi.string().allow(""),
  interest: Joi.string().allow(""),
  notes: Joi.string().allow(""),
  platform: Joi.string(),
  campaign: Joi.string().allow(""),
  /** Rental calculator: vehicle and trip (optional). */
  vehicle_type: Joi.string().allow("").optional(),
  vehicle_model: Joi.string().allow("").optional(),
  rental_start: Joi.string().allow("").optional(),
  rental_end: Joi.string().allow("").optional(),
  /** Human-readable add-ons / options (optional). */
  rental_extras: Joi.string().allow("").optional(),
  customer_notes: Joi.string().allow("").optional(),
  /** Rental calculator submitted total (e.g. $1,234.56). */
  quoted_total: Joi.string().allow("").optional(),
});
