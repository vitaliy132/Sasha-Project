const Joi = require("joi");
const { parseISO, isValid } = require("date-fns");

const isIsoDate = (value, helpers) => {
  const parsed = parseISO(value);
  if (!isValid(parsed)) {
    return helpers.error("date.invalid");
  }
  return value;
};

module.exports = Joi.object({
  unitId: Joi.string().optional(),
  unitType: Joi.string()
    .valid("class_a", "class_b", "class_c", "trailer")
    .required()
    .messages({
      "any.only": "unitType must be one of: class_a, class_b, class_c, trailer",
    }),
  unitModel: Joi.string().trim().min(1).required(),
  startDate: Joi.string().required().custom(isIsoDate, "ISO date validation").messages({
    "date.invalid": "startDate must be a valid ISO date string",
  }),
  endDate: Joi.string().required().custom(isIsoDate, "ISO date validation").messages({
    "date.invalid": "endDate must be a valid ISO date string",
  }),
  mileage: Joi.object({
    type: Joi.string().valid("package", "per_km").required(),
    value: Joi.number().min(0).required(),
  }).optional(),
})
  .custom((value, helpers) => {
    const start = parseISO(value.startDate);
    const end = parseISO(value.endDate);

    if (end <= start) {
      return helpers.error("any.invalid", {
        message: "endDate must be after startDate",
      });
    }

    return value;
  }, "date range validation")
  .messages({
    "any.invalid": "{{#message}}",
  });
