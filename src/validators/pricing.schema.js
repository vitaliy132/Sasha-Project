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
    .valid("class_a", "class_b", "class_c", "trailer", "classA", "classB", "classC")
    .required()
    .messages({
      "any.only": "unitType must be one of: class_a, class_b, class_c, trailer",
    }),
  vehicleType: Joi.string()
    .valid("class_a", "class_b", "class_c", "trailer", "classA", "classB", "classC")
    .optional()
    .messages({
      "any.only": "vehicleType must be one of: class_a, class_b, class_c, trailer",
    }),
  unitModel: Joi.string().trim().min(1).required(),
  vehicleModel: Joi.string().trim().min(1).optional(),
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
  vipCollisionDamageWaiver: Joi.boolean().optional().default(false).messages({
    "boolean.base": "vipCollisionDamageWaiver must be true or false",
  }),
  cancellationWaiver: Joi.boolean().optional().default(false).messages({
    "boolean.base": "cancellationWaiver must be true or false",
  }),
  windshieldCoverage: Joi.boolean().optional().default(false).messages({
    "boolean.base": "windshieldCoverage must be true or false",
  }),
  generator: Joi.object({
    type: Joi.string().valid("hourly", "daily").required(),
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
