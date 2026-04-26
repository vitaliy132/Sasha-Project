const { addDays, differenceInCalendarDays, format, isValid, parseISO } = require("date-fns");
const { roundToTwo, getSeason, mmdd, inSeasonRange } = require("../utils/pricingUtils");
const pricingConfig = require("../config/rentalPricing.json");
const {
  TAX_RATE,
  TRAILER_HITCH_FEE,
  MINIMUM_RENTAL_DAYS,
  CDW_DAILY_RATE,
  CDW_MINIMUM,
  BIKE_RACK_FEE,
  WINTERIZATION_FEES,
  KM_PACKAGE_RATE,
  EXTRA_KM_RATE,
  PREP_FEES,
} = require("../utils/pricingConstants");

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
  if (!generatorUsage || !generatorUsage.type) return 0;

  const usageType = String(generatorUsage.type).toLowerCase();
  const hours = Number(generatorUsage.value) || 0;

  if (usageType === "dailyunlimited" || usageType === "daily") {
    return roundToTwo(60 * numDays);
  }

  if (usageType === "hourly") {
    return roundToTwo(hours * 5);
  }

  return 0;
}

function calculateWinterizationFee(startDate, endDate, unitType) {
  const isWinterDate = (date) => {
    const key = mmdd(date);
    return key >= "10-15" || key <= "04-30";
  };

  let current = startDate;
  while (current <= endDate) {
    if (isWinterDate(current)) {
      return roundToTwo(WINTERIZATION_FEES[unitType] || 0);
    }
    current = addDays(current, 1);
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
 * @param {string} unitType - the unit type (e.g., "trailer")
 * @returns {number}
 */
function calculateMileageCost(mileageOptions, numDays, unitType) {
  if (!mileageOptions || !mileageOptions.type || mileageOptions.value === 0) {
    return 0;
  }

  const value = Number(mileageOptions.value) || 0;
  if (value < 0) return 0;

  if (mileageOptions.type === "package") {
    // Fixed price per package (does NOT multiply by days)
    return roundToTwo(value * KM_PACKAGE_RATE);
  } else if (mileageOptions.type === "per_km") {
    // Do NOT calculate extra kms here (handled at drop-off)
    return 0;
  }

  return 0;
}

/**
 * Calculate trailer hitch fee if applicable
 */
function calculateHitchFee(unitType, hasOwnHitch = false) {
  if (unitType === "trailer" && !hasOwnHitch) {
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
    bikeRack = false,
    hasOwnHitch = false,
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
  const mileageCost = calculateMileageCost(mileage, days, effectiveUnitType);

  // 5. Optional VIP Collision Damage Waiver
  const vipCDW = calculateVIPCollisionDamageWaiver(days, vipCollisionDamageWaiver);

  // 6. Cancellation Waiver (optional)
  const cancellation = calculateCancellationWaiver(days, cancellationWaiver);

  // 7. Windshield Coverage (optional)
  const windshield = calculateWindshieldCoverage(effectiveUnitType, days, windshieldCoverage);

  // 8. Generator (optional)
  const generatorCost = calculateGenerator(generator, days);

  // 9. Trailer hitch fee (only for trailers and only when needed)
  const hitchFee = calculateHitchFee(effectiveUnitType, hasOwnHitch);

  // 10. Bike rack (optional)
  const bikeRackCost = bikeRack ? roundToTwo(BIKE_RACK_FEE) : 0;

  // 11. Winterization fee (seasonal)
  const winterizationFee = calculateWinterizationFee(start, end, effectiveUnitType);

  // === SUBTOTAL (before tax) ===
  const subtotal = roundToTwo(
    basePrice +
      cdw +
      preparationFee +
      mileageCost +
      vipCDW +
      cancellation +
      windshield +
      generatorCost +
      hitchFee +
      bikeRackCost +
      winterizationFee
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
    bikeRackCost: roundToTwo(bikeRackCost),
    winterizationFee: roundToTwo(winterizationFee),

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
