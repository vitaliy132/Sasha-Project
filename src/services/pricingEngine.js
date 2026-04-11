const { addDays, differenceInCalendarDays, format, isValid, parseISO } = require("date-fns");
const pricingConfig = require("../config/rentalPricing.json");

const TAX_RATE = 0.13;
const CDW_DAILY_RATE = 30;
const CDW_MINIMUM = 210;
const TRAILER_HITCH_FEE = 150;

// PREP FEES by unit type
const PREP_FEES = {
  class_a: 199,
  class_b: 149,
  class_c: 149,
  trailer: 149,
};

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
  const { SEASONS } = pricingConfig;

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
 * Validate unit exists and has pricing
 */
function validateUnit(unitType, unitModel) {
  const typeMap = {
    class_a: "classA",
    class_b: "classB",
    class_c: "classC",
    trailer: "trailer",
  };

  const configType = typeMap[unitType];
  if (!configType) {
    throw new Error(`Invalid unit type: ${unitType}`);
  }

  const { PRICING } = pricingConfig;
  const table = PRICING[configType];
  if (!table) {
    throw new Error(`No pricing table for unit type: ${unitType}`);
  }

  const pricing = table[unitModel];
  if (!pricing) {
    const available = Object.keys(table).join(", ");
    throw new Error(`Unknown model "${unitModel}". Available: ${available}`);
  }

  return pricing;
}

/**
 * Calculate total base price by summing daily rates per season
 * @param {Date} startDate
 * @param {number} numDays - number of days to sum
 * @param {object} unitPricing - pricing object with PREMIUM, PRIME, SHOULDER, ECONOMY keys
 * @returns {object} { total, dailyRates: [{ date, season, price }] }
 */
function calculateBasePriceWithBreakdown(startDate, numDays, unitPricing) {
  const dailyRates = [];
  let total = 0;

  for (let i = 0; i < numDays; i++) {
    const day = addDays(startDate, i);
    const season = getSeason(day);
    const price = unitPricing[season];

    if (!Number.isFinite(Number(price))) {
      throw new Error(`Missing price for season ${season}`);
    }

    const priceNum = Number(price);
    dailyRates.push({
      date: format(day, "yyyy-MM-dd"),
      season,
      price: roundToTwo(priceNum),
    });
    total += priceNum;
  }

  return {
    total: roundToTwo(total),
    dailyRates,
  };
}

/**
 * Calculate CDW: max(30 * days, 210)
 */
function calculateCDW(numDays) {
  return roundToTwo(Math.max(numDays * CDW_DAILY_RATE, CDW_MINIMUM));
}

/**
 * Get preparation fee for unit type
 */
function getPreparationFee(unitType) {
  const fee = PREP_FEES[unitType];
  if (fee === undefined) {
    throw new Error(`No prep fee defined for unit type: ${unitType}`);
  }
  return roundToTwo(fee);
}

/**
 * Calculate mileage cost
 * @param {object} mileageOptions - { type: "package" | "per_km", value: number }
 * @param {number} numDays - only used for reference/logging, cost does not multiply by days
 * @returns {number}
 */
function calculateMileageCost(mileageOptions, numDays) {
  if (!mileageOptions || !mileageOptions.type || mileageOptions.value === 0) {
    return 0;
  }

  const value = Number(mileageOptions.value) || 0;
  if (value < 0) return 0;

  if (mileageOptions.type === "package") {
    // Fixed price per package (does NOT multiply by days)
    const packageRate = 350; // or get from config
    return roundToTwo(value * packageRate);
  } else if (mileageOptions.type === "per_km") {
    // Per km rate (does NOT multiply by days)
    const kmRate = 0.41; // or get from config
    return roundToTwo(value * kmRate);
  }

  return 0;
}

/**
 * Calculate trailer hitch fee if applicable
 */
function calculateHitchFee(unitType) {
  if (unitType === "trailer") {
    return roundToTwo(TRAILER_HITCH_FEE);
  }
  return 0;
}

/**
 * Main pricing function
 * @param {object} params - { unitId, unitType, unitModel, startDate, endDate, mileage }
 * @returns {object} - detailed breakdown with all components
 */
function calculatePrice(params) {
  const { unitId, unitType, unitModel, startDate, endDate, mileage } = params;

  // === VALIDATION ===
  if (!startDate || !endDate) {
    throw new Error("startDate and endDate are required");
  }

  const start = parseISO(startDate);
  const end = parseISO(endDate);

  if (!isValid(start) || !isValid(end)) {
    throw new Error("startDate and endDate must be valid ISO dates");
  }

  if (end <= start) {
    throw new Error("endDate must be after startDate");
  }

  if (!unitType || !unitModel) {
    throw new Error("unitType and unitModel are required");
  }

  // Get unit pricing (validates unit exists)
  const unitPricing = validateUnit(unitType, unitModel);

  // === CALCULATE DAYS ===
  const days = differenceInCalendarDays(end, start) + 1;

  // === CALCULATE COMPONENTS ===
  // 1. Base price per day by season
  const { total: basePrice, dailyRates } = calculateBasePriceWithBreakdown(start, days, unitPricing);

  // 2. CDW (Collision Damage Waiver)
  const cdw = calculateCDW(days);

  // 3. Preparation fee
  const preparationFee = getPreparationFee(unitType);

  // 4. Mileage cost
  const mileageCost = calculateMileageCost(mileage, days);

  // 5. Trailer hitch fee
  const hitchFee = calculateHitchFee(unitType);

  // === SUBTOTAL (before tax) ===
  const subtotal = roundToTwo(
    basePrice + cdw + preparationFee + mileageCost + hitchFee
  );

  // === TAX ===
  const tax = roundToTwo(subtotal * TAX_RATE);

  // === TOTAL (after tax) ===
  const total = roundToTwo(subtotal + tax);

  // === RETURN DETAILED BREAKDOWN ===
  return {
    // Metadata
    unitId,
    unitType,
    unitModel,
    startDate,
    endDate,

    // Calculation details
    days,
    dailyRates,
    basePrice,
    cdw,
    preparationFee,
    mileageCost,
    hitchFee,
    subtotal,
    tax,
    total,

    // Formatted for display
    totalFormatted: `$${total.toFixed(2)}`,
  };
}

module.exports = {
  // Public API
  calculatePrice,
  getSeason,

  // Utilities (for testing)
  roundToTwo,
  validateUnit,
  calculateBasePriceWithBreakdown,
  calculateCDW,
  getPreparationFee,
  calculateMileageCost,
  calculateHitchFee,
};
