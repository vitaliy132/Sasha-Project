const { differenceInCalendarDays, parseISO, isValid } = require("date-fns");

const { MINIMUM_RENTAL_DAYS } = require("../utils/pricingConstants");

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

  const calendarDays = differenceInCalendarDays(end, start) + 1;
  if (calendarDays < MINIMUM_RENTAL_DAYS) {
    return helpers.error("any.invalid", {
      message: `Minimum rental period is ${MINIMUM_RENTAL_DAYS} days`,
    });
  }

  return value;
};

module.exports = {
  isIsoDate,
  validateDateRange,
};
