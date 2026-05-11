const { parseISO, isValid } = require("date-fns");

const isIsoDate = (value, helpers) => {
  const parsed = parseISO(value);
  if (!isValid(parsed)) {
    return helpers.error("date.invalid");
  }
  return value;
};

const validateDateRange = (value, helpers) => {
  const start = parseISO(value.startDate);
  const end = parseISO(value.endDate);

  if (end <= start) {
    return helpers.error("any.invalid", {
      message: "endDate must be after startDate",
    });
  }

  return value;
};

module.exports = {
  isIsoDate,
  validateDateRange,
};
