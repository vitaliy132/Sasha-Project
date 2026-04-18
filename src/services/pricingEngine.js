const { addDays, differenceInCalendarDays, format, isValid, parseISO } = require("date-fns");
const pricingConfig = require("../config/rentalPricing.json");

const TAX_RATE = 0.13;
const TRAILER_HITCH_FEE = 150;
const MINIMUM_RENTAL_DAYS = 5;
const CDW_DAILY_RATE = 30;
const CDW_MINIMUM = 210;

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
 * Normalize a model name to the valid pricing key format.
 */
function normalizeUnitModel(unitModel) {
  if (!unitModel) return "";

  const cleaned = String(unitModel)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/-+/g, "_")
    .replace(/^_|_$/g, "");

  return cleaned;
}

/**
 * Normalize unit type to canonical service keys.
 */
const UNIT_TYPE_CANONICAL = {
  class_a: "class_a",
  classa: "class_a",
  class_b: "class_b",
  classb: "class_b",
  class_c: "class_c",
  classc: "class_c",
  trailer: "trailer",
};

const UNIT_TYPE_TO_PRICING_CONFIG = {
  class_a: "classA",
  class_b: "classB",
  class_c: "classC",
  trailer: "trailer",
};

const PRICING_CONFIG_TO_UNIT_TYPE = {
  classA: "class_a",
  classB: "class_b",
  classC: "class_c",
  trailer: "trailer",
};

function normalizeUnitType(unitType) {
  if (!unitType) return undefined;

  const token = String(unitType).trim().toLowerCase();
  return UNIT_TYPE_CANONICAL[token];
}

function pricingConfigTypeFromUnitType(normalizedType) {
  return UNIT_TYPE_TO_PRICING_CONFIG[normalizedType];
}

function unitTypeFromPricingConfigType(configType) {
  return PRICING_CONFIG_TO_UNIT_TYPE[configType];
}

function findPricingTableForModel(normalizedModel) {
  const { PRICING } = pricingConfig;

  for (const [configType, table] of Object.entries(PRICING)) {
    if (Object.prototype.hasOwnProperty.call(table, normalizedModel)) {
      return { configType, pricing: table[normalizedModel] };
    }
  }

  return null;
}

function resolveUnit(unitType, unitModel) {
  const normalizedType = normalizeUnitType(unitType);
  if (!normalizedType) {
    throw new Error(`Invalid unit type: ${unitType}`);
  }

  const configType = pricingConfigTypeFromUnitType(normalizedType);
  if (!configType) {
    throw new Error(`Invalid unit type: ${unitType}`);
  }

  const normalizedModel = normalizeUnitModel(unitModel);
  const { PRICING } = pricingConfig;
  const table = PRICING[configType];
  if (!table) {
    throw new Error(`No pricing table for unit type: ${unitType}`);
  }

  const pricing = table[normalizedModel];
  if (pricing) {
    return {
      unitType: normalizedType,
      unitModel: normalizedModel,
      pricing,
    };
  }

  const fallback = findPricingTableForModel(normalizedModel);
  if (fallback) {
    const fallbackUnitType = unitTypeFromPricingConfigType(fallback.configType);
    return {
      unitType: fallbackUnitType || normalizedType,
      unitModel: normalizedModel,
      pricing: fallback.pricing,
    };
  }

  const available = Object.keys(table).join(", ");
  throw new Error(`Unknown model "${unitModel}". Available: ${available}`);
}

/**
 * Validate unit exists and has pricing
 */
function validateUnit(unitType, unitModel) {
  return resolveUnit(unitType, unitModel).pricing;
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

    // Handle null price (season not available for this vehicle)
    if (price === null || price === undefined) {
      throw new Error(`This vehicle is not available for ${season} season`);
    }

    if (!Number.isFinite(Number(price))) {
      throw new Error(`Invalid price for season ${season}`);
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
 * Calculate mandatory CDW: max(30 × days, 210)
 * @param {number} numDays
 * @returns {number}
 */
function calculateCDW(numDays) {
  return roundToTwo(Math.max(numDays * CDW_DAILY_RATE, CDW_MINIMUM));
}

/**
 * Calculate optional VIP Collision Damage Waiver: $30 per day
 * @param {number} numDays
 * @param {boolean} enabled
 * @returns {number}
 */
function calculateVIPCollisionDamageWaiver(numDays, enabled) {
  if (!enabled) return 0;
  const dailyRate = 30;
  return roundToTwo(numDays * dailyRate);
}

/**
 * Calculate Cancellation Waiver: $20 per day with minimum $240
 * @param {number} numDays
 * @param {boolean} enabled
 * @returns {number}
 */
function calculateCancellationWaiver(numDays, enabled) {
  if (!enabled) return 0;
  const dailyRate = 20;
  const minimum = 240;
  const total = numDays * dailyRate;
  return roundToTwo(Math.max(total, minimum));
}

/**
 * Calculate Windshield Coverage
 * - CLASS A: $35 per trip, min $250, max $1000
 * - CLASS C: $20 per trip, max $450
 * @param {string} unitType - class_a, class_c, etc
 * @param {number} numDays
 * @param {boolean} enabled
 * @returns {number}
 */
function calculateWindshieldCoverage(unitType, numDays, enabled) {
  if (!enabled) return 0;

  const { ADD_ONS } = pricingConfig;
  const windshieldConfig = ADD_ONS.windshieldCoverage;

  if (unitType === "class_a" && windshieldConfig.classA) {
    const perTrip = windshieldConfig.classA.perTrip;
    const cost = roundToTwo(perTrip * numDays);
    const min = windshieldConfig.classA.min;
    const max = windshieldConfig.classA.max;
    return roundToTwo(Math.max(Math.min(cost, max), min));
  } else if (unitType === "class_c" && windshieldConfig.classC) {
    const perTrip = windshieldConfig.classC.perTrip;
    const cost = roundToTwo(perTrip * numDays);
    const max = windshieldConfig.classC.max;
    return roundToTwo(Math.min(cost, max));
  }

  return 0;
}

/**
 * Calculate Generator Usage
 * - $5 per hour OR $60 per day (daily unlimited)
 * @param {object} generatorUsage - { type: "hourly" | "daily" | "dailyUnlimited", value: number }
 * @param {number} numDays - only used for reference
 * @returns {number}
 */
function calculateGenerator(generatorUsage, numDays) {
  if (!generatorUsage || !generatorUsage.type || generatorUsage.value === 0) {
    return 0;
  }

  const value = Number(generatorUsage.value) || 0;
  if (value < 0) return 0;

  const unlimitedTypes = new Set(["daily", "dailyUnlimited"]);
  if (generatorUsage.type === "hourly") {
    const hourlyRate = 5;
    return roundToTwo(value * hourlyRate);
  } else if (unlimitedTypes.has(generatorUsage.type)) {
    const dailyRate = 60;
    return roundToTwo(value * dailyRate);
  }

  return 0;
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
 * @param {object} params - {
 *   unitId, unitType, unitModel, startDate, endDate, mileage,
 *   vipCollisionDamageWaiver, cancellationWaiver, windshieldCoverage, generator
 * }
 * @returns {object} - detailed breakdown with all components
 */
function calculatePrice(params) {
  const {
    unitId,
    unitType,
    unitModel,
    startDate,
    endDate,
    mileage,
    vipCollisionDamageWaiver = false,
    cancellationWaiver = false,
    windshieldCoverage = false,
    generator,
  } = params;

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

  const resolvedUnit = resolveUnit(unitType, unitModel);
  const unitPricing = resolvedUnit.pricing;
  const effectiveUnitType = resolvedUnit.unitType;

  // === CALCULATE DAYS ===
  let days = differenceInCalendarDays(end, start) + 1;

  // === ENFORCE MINIMUM 5 DAYS ===
  // If rental is less than 5 days, charge for 5 days
  const actualDays = days;
  days = Math.max(days, MINIMUM_RENTAL_DAYS);

  // === CALCULATE COMPONENTS ===
  // 1. Base price per day by season
  const { total: basePrice, dailyRates } = calculateBasePriceWithBreakdown(
    start,
    days,
    unitPricing
  );

  // 2. Mandatory CDW: max(30 × days, 210)
  const cdw = calculateCDW(days);

  // 3. Preparation fee
  const preparationFee = getPreparationFee(effectiveUnitType);

  // 4. Mileage cost (optional)
  const mileageCost = calculateMileageCost(mileage, days);

  // 5. Optional VIP Collision Damage Waiver
  const vipCDW = calculateVIPCollisionDamageWaiver(days, vipCollisionDamageWaiver);

  // 6. Cancellation Waiver (optional)
  const cancellation = calculateCancellationWaiver(days, cancellationWaiver);

  // 7. Windshield Coverage (optional)
  const windshield = calculateWindshieldCoverage(effectiveUnitType, days, windshieldCoverage);

  // 8. Generator (optional)
  const generatorCost = calculateGenerator(generator, days);

  // 9. Trailer hitch fee (only for trailers)
  const hitchFee = calculateHitchFee(effectiveUnitType);

  // === SUBTOTAL (before tax) ===
  const subtotal = roundToTwo(
    basePrice + cdw + preparationFee + mileageCost + vipCDW + cancellation + windshield + generatorCost + hitchFee
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
    resolvedUnitType: effectiveUnitType,
    resolvedUnitModel: resolvedUnit.unitModel,
    startDate,
    endDate,

    // Calculation details
    days,
    dailyRates,

    // Base and mandatory fees
    basePrice,
    cdw: roundToTwo(cdw),
    preparationFee,

    // Optional add-ons (always shown for transparency)
    mileageCost: roundToTwo(mileageCost),
    vipCollisionDamageWaiver: roundToTwo(vipCDW),
    cancellationWaiver: roundToTwo(cancellation),
    windshieldCoverage: roundToTwo(windshield),
    generatorCost: roundToTwo(generatorCost),
    hitchFee: roundToTwo(hitchFee),

    // Totals
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

  // Utilities (for testing and external use)
  roundToTwo,
  validateUnit,
  calculateBasePriceWithBreakdown,
  calculateCDW,
  calculateVIPCollisionDamageWaiver,
  calculateCancellationWaiver,
  calculateWindshieldCoverage,
  calculateGenerator,
  getPreparationFee,
  calculateMileageCost,
  calculateHitchFee,
};
