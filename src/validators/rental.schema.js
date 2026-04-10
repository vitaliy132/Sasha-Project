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
  startDate: Joi.string().required().custom(isIsoDate, "ISO date validation"),
  endDate: Joi.string().required().custom(isIsoDate, "ISO date validation"),
  vehicleType: Joi.string().valid("classA", "classC", "trailer").required(),
  cdwPlus: Joi.boolean().required(),
  kmPackages: Joi.number().integer().min(0).required(),
  generatorHours: Joi.number().min(0).optional().default(0),
  extraKm: Joi.number().min(0).optional().default(0),
})
  .custom((value, helpers) => {
    const start = parseISO(value.startDate);
    const end = parseISO(value.endDate);

    if (end <= start) {
      return helpers.error("any.invalid", { message: "endDate must be after startDate" });
    }

    return value;
  }, "date range validation")
  .messages({
    "date.invalid": "Date fields must be valid ISO date strings",
    "any.invalid": "{{#message}}",
  });
