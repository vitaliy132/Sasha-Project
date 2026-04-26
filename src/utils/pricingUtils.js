const { addDays, differenceInCalendarDays, format, isValid, parseISO } = require("date-fns");

/**
 * Round to 2 decimal places
 */
const roundToTwo = (num) => {
  const n = Number(num);
  if (!Number.isFinite(n)) return 0;
  return Number(n.toFixed(2));
};

/**
 * Format date to MM-dd string for season comparison
 */
function mmdd(date) {
  return format(date, "MM-dd");
}

/**
 * Check if a date string (MM-dd format) falls within a range.
 * Handles wrap-around (e.g., Oct 26 - May 14 wraps past year-end)
 */
function inSeasonRange(d, start, end) {
  if (start <= end) {
    return d >= start && d <= end;
  }
  // Wrap-around case (e.g., "10-26" to "05-14")
  return d >= start || d <= end;
}

/**
 * Determine season for a given date
 * @param {Date} date
 * @returns {"PREMIUM"|"PRIME"|"SHOULDER"|"ECONOMY"}
 */
function getSeason(date) {
  const d = mmdd(date);
  const { SEASONS } = require("../config/rentalPricing.json");

  // PREMIUM: Jul 1 – Aug 31
  if (inSeasonRange(d, SEASONS.PREMIUM.start, SEASONS.PREMIUM.end)) {
    return "PREMIUM";
  }

  // PRIME: Jun 11 – Jun 30 and Sep 1 – Sep 30
  for (const range of SEASONS.PRIME) {
    if (inSeasonRange(d, range.start, range.end)) {
      return "PRIME";
    }
  }

  // SHOULDER: May 15 – Jun 10 and Oct 1 – Oct 25
  for (const range of SEASONS.SHOULDER) {
    if (inSeasonRange(d, range.start, range.end)) {
      return "SHOULDER";
    }
  }

  // ECONOMY: Oct 26 – May 14
  return "ECONOMY";
}

/**
 * Format a number as currency
 */
const formatCurrency = (value) => `$${roundToTwo(value).toFixed(2)}`;

module.exports = {
  roundToTwo,
  getSeason,
  mmdd,
  inSeasonRange,
  formatCurrency,
};