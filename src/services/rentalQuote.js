const assert = require("node:assert");
const { addDays, differenceInCalendarDays, format, isValid, parseISO } = require("date-fns");

const pricingConfig = require("../config/rentalPricing.json");

const TAX_RATE = 0.13;
const MIN_CHARGE_DAYS_FOR_DAILY_RATE = 5;
const CDW_DAILY_RATE = 30;
const CDW_MINIMUM = 210;
const KM_PACKAGE_RATE = 350;
const TRAILER_HITCH_FEE = 150;
const EXTRA_KM_RATE = 0.41;
const GENERATOR_HOUR_RATE = 5;
const GENERATOR_DAILY_UNLIMITED_RATE = 60;
const CANCELLATION_DAILY_RATE = 20;
const CANCELLATION_MINIMUM = 240;

const { SEASONS: SEASON_DEFINITIONS, PRICING, ADD_ONS, defaults } = pricingConfig;

const roundToTwo = (num) => {
  const n = Number(num);
  if (!Number.isFinite(n)) return 0;
  return Number(n.toFixed(2));
};

const formatCurrency = (value) => `$${roundToTwo(value).toFixed(2)}`;

/** @param {Date} date */
function mmdd(date) {
  return format(date, "MM-dd");
}

/** Inclusive calendar range on MM-dd strings (handles wrap when start > end). */
function inSeasonRange(d, start, end) {
  if (start <= end) {
    return d >= start && d <= end;
  }
  return d >= start || d <= end;
}

/**
 * @param {Date} date
 * @returns {"PREMIUM"|"PRIME"|"SHOULDER"|"ECONOMY"}
 */
function getSeason(date) {
  const d = mmdd(date);
  const premium = SEASON_DEFINITIONS.PREMIUM;
  if (inSeasonRange(d, premium.start, premium.end)) {
    return "PREMIUM";
  }
  for (const r of SEASON_DEFINITIONS.PRIME) {
    if (inSeasonRange(d, r.start, r.end)) return "PRIME";
  }
  for (const r of SEASON_DEFINITIONS.SHOULDER) {
    if (inSeasonRange(d, r.start, r.end)) return "SHOULDER";
  }
  for (const r of SEASON_DEFINITIONS.ECONOMY) {
    if (inSeasonRange(d, r.start, r.end)) return "ECONOMY";
  }
  return "ECONOMY";
}

function listVehicleModels(vehicleType) {
  const table = PRICING[vehicleType];
  if (!table) return [];
  return Object.keys(table);
}

function resolvePricingRow(vehicleType, vehicleModel) {
  const table = PRICING[vehicleType];
  if (!table) {
    const err = new Error(`Unknown vehicle type: ${vehicleType}`);
    err.statusCode = 400;
    throw err;
  }
  const row = table[vehicleModel];
  if (!row) {
    const err = new Error(
      `Unknown vehicle model "${vehicleModel}" for ${vehicleType}. Valid models: ${Object.keys(table).join(", ")}`,
    );
    err.statusCode = 400;
    throw err;
  }
  return row;
}

const calendarRentalDays = (startDate, endDate) =>
  differenceInCalendarDays(endDate, startDate) + 1;

const billedDaysForDailyRates = (calendarDays) =>
  Math.max(calendarDays, MIN_CHARGE_DAYS_FOR_DAILY_RATE);

/**
 * Sum per-day rates using season + model pricing from config.
 * @param {Date} startDate
 * @param {number} daysToSum
 * @param {string} vehicleType
 * @param {string} vehicleModel
 */
function calculateDailyRateTotal(startDate, daysToSum, vehicleType, vehicleModel) {
  const row = resolvePricingRow(vehicleType, vehicleModel);
  let total = 0;
  for (let dayOffset = 0; dayOffset < daysToSum; dayOffset += 1) {
    const day = addDays(startDate, dayOffset);
    const season = getSeason(day);
    const price = row[season];
    if (price == null || !Number.isFinite(Number(price))) {
      const err = new Error(`Missing rate for season ${season} on model ${vehicleModel}`);
      err.statusCode = 500;
      throw err;
    }
    total += Number(price);
  }
  return roundToTwo(total);
}

const getPrepFee = (vehicleType) => (vehicleType === "classA" ? 199 : 149);

/** CDW Plus is always included in quotes ($30/day, minimum $210 per rental). */
const calculateCDW = (calendarDays) =>
  roundToTwo(Math.max(calendarDays * CDW_DAILY_RATE, CDW_MINIMUM));

const calculateCancellationWaiver = (enabled, calendarDays) => {
  if (!enabled) return 0;
  return roundToTwo(Math.max(calendarDays * ADD_ONS.cancellationWaiver.daily, ADD_ONS.cancellationWaiver.min));
};

/**
 * Windshield: Class A $35/day with min $250 max $1000 total.
 * Class B/C/Trailer: $20/day max $450 total.
 */
const calculateWindshield = (vehicleType, calendarDays, enabled) => {
  if (!enabled) return 0;
  const days = Math.max(0, calendarDays);
  if (vehicleType === "classA") {
    const raw = days * ADD_ONS.windshieldCoverage.classA.perTrip;
    return roundToTwo(Math.min(Math.max(raw, ADD_ONS.windshieldCoverage.classA.min), ADD_ONS.windshieldCoverage.classA.max));
  }
  if (vehicleType === "classB" || vehicleType === "classC" || vehicleType === "trailer") {
    const raw = days * ADD_ONS.windshieldCoverage.classC.perTrip;
    return roundToTwo(Math.min(raw, ADD_ONS.windshieldCoverage.classC.max));
  }
  return 0;
};

const calculateKitchenKit = (enabled) => {
  return enabled ? roundToTwo(ADD_ONS.kitchenKit.perTrip) : 0;
};

const calculateBeddingKit = (people) => {
  return roundToTwo(people * ADD_ONS.beddingKit.perPerson);
};

const calculateBikeRack = (enabled) => {
  return enabled ? roundToTwo(ADD_ONS.bikeRack.perTrip) : 0;
};

const calculateGenerator = (generatorDailyUnlimited, generatorHours, billedDayCount) => {
  if (generatorDailyUnlimited) {
    return roundToTwo(ADD_ONS.generator.daily * billedDayCount);
  }
  return roundToTwo(toNonNegativeNumber(generatorHours, 0) * ADD_ONS.generator.hourly);
};

const toFiniteNumber = (value, defaultValue = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : defaultValue;
};

const toNonNegativeNumber = (value, defaultValue = 0) => {
  const n = toFiniteNumber(value, defaultValue);
  return n < 0 ? defaultValue : n;
};

const toNonNegativeInteger = (value, defaultValue = 0) => {
  const n = Math.trunc(toFiniteNumber(value, defaultValue));
  if (!Number.isFinite(n) || n < 0) return defaultValue;
  return n;
};

const VALID_VEHICLE_TYPES = ["classA", "classB", "classC", "trailer"];

const sanitizePayload = (raw) => {
  const vt = raw?.vehicleType;
  const vehicleType = VALID_VEHICLE_TYPES.includes(vt) ? vt : "classC";

  const defaultModel = defaults?.vehicleModelByType?.[vehicleType] || "";
  const rawModel = typeof raw?.vehicleModel === "string" ? raw.vehicleModel.trim() : "";
  const vehicleModel = rawModel || defaultModel;

  return {
    startDate: raw?.startDate,
    endDate: raw?.endDate,
    vehicleType,
    vehicleModel,
    cancellationWaiver: Boolean(raw?.cancellationWaiver),
    windshieldCoverage: Boolean(raw?.windshieldCoverage),
    generatorDailyUnlimited: Boolean(raw?.generatorDailyUnlimited),
    kmPackages: toNonNegativeInteger(raw?.kmPackages, 0),
    extraKm: toNonNegativeInteger(raw?.extraKm, 0),
    generatorHours: toNonNegativeNumber(raw?.generatorHours, 0),
    kitchenKit: Boolean(raw?.kitchenKit),
    beddingKitPeople: toNonNegativeInteger(raw?.beddingKitPeople, 0),
    bikeRack: Boolean(raw?.bikeRack),
  };
};

const buildLineItems = (b) => [
  { name: "Daily Rental", value: b.dailyRateTotal },
  { name: "CDW", value: b.cdw },
  { name: "Prep Fee", value: b.prepFee },
  { name: "KM Packages", value: b.kmPackages },
  { name: "Hitch", value: b.hitch },
  { name: "Extra KM", value: b.extraKm },
  { name: "Generator", value: b.generator },
  { name: "Cancellation Waiver", value: b.cancellationWaiver },
  { name: "Windshield Coverage", value: b.windshield },
  { name: "Kitchen Kit", value: b.kitchenKit },
  { name: "Bedding Kit", value: b.beddingKit },
  { name: "Bike Rack", value: b.bikeRack },
  { name: "Tax", value: b.tax },
];

const buildSummaryMessage = ({ total, vehicleType, calendarDays }) => {
  let summary =
    `Your estimated total for this rental is ${formatCurrency(total)}. ` +
    "This includes the daily rental rate, preparation fee, kilometer packages where applicable, taxes, a full tank of propane, and a full demonstration of the vehicle.";

  if (vehicleType === "trailer") {
    summary +=
      " Please note: You must have a properly rated tow vehicle with hitch receiver, brake controller, and electrical adaptor installed.";
  }

  if (calendarDays < MIN_CHARGE_DAYS_FOR_DAILY_RATE) {
    summary += ` Base daily rates are charged for a minimum of ${MIN_CHARGE_DAYS_FOR_DAILY_RATE} days even when your selected dates are shorter.`;
  }

  summary +=
    " CDW Plus (Collision Damage Waiver) is included in the total shown above, as listed in the breakdown.";
  summary += " A $3000 security deposit is required.";
  return summary;
};

/**
 * @param {object} payload
 */
const calculateRentalQuote = (payload) => {
  const sanitized = sanitizePayload(payload);
  const startDate = parseISO(sanitized.startDate);
  const endDate = parseISO(sanitized.endDate);

  if (!isValid(startDate) || !isValid(endDate)) {
    const err = new Error("Invalid startDate or endDate");
    err.statusCode = 400;
    throw err;
  }
  if (endDate <= startDate) {
    const err = new Error("endDate must be after startDate");
    err.statusCode = 400;
    throw err;
  }

  if (!sanitized.vehicleModel) {
    const err = new Error("vehicleModel is required (no default configured for this vehicle type)");
    err.statusCode = 400;
    throw err;
  }

  resolvePricingRow(sanitized.vehicleType, sanitized.vehicleModel);

  const days = calendarRentalDays(startDate, endDate);
  const daysForDailyRateSum = billedDaysForDailyRates(days);
  const dailyRateTotal = calculateDailyRateTotal(
    startDate,
    daysForDailyRateSum,
    sanitized.vehicleType,
    sanitized.vehicleModel,
  );
  const cdw = calculateCDW(days);

  const prepFee = roundToTwo(getPrepFee(sanitized.vehicleType));
  const kmPackagesCost = roundToTwo(sanitized.kmPackages * KM_PACKAGE_RATE);
  const hitch = roundToTwo(sanitized.vehicleType === "trailer" ? TRAILER_HITCH_FEE : 0);
  const extraKm = roundToTwo(sanitized.extraKm * EXTRA_KM_RATE);
  const generator = calculateGenerator(
    sanitized.generatorDailyUnlimited,
    sanitized.generatorHours,
    daysForDailyRateSum,
  );
  const cancellationWaiver = calculateCancellationWaiver(sanitized.cancellationWaiver, days);
  const windshield = calculateWindshield(
    sanitized.vehicleType,
    days,
    sanitized.windshieldCoverage,
  );
  const kitchenKit = calculateKitchenKit(sanitized.kitchenKit);
  const beddingKit = calculateBeddingKit(sanitized.beddingKitPeople);
  const bikeRack = calculateBikeRack(sanitized.bikeRack);

  const subtotal = roundToTwo(dailyRateTotal + cdw);
  const totalBeforeTax = roundToTwo(
    subtotal +
      prepFee +
      kmPackagesCost +
      hitch +
      extraKm +
      generator +
      cancellationWaiver +
      windshield +
      kitchenKit +
      beddingKit +
      bikeRack,
  );
  const tax = roundToTwo(totalBeforeTax * TAX_RATE);
  const total = roundToTwo(totalBeforeTax + tax);

  const breakdown = {
    days,
    dailyRateTotal: roundToTwo(dailyRateTotal),
    cdw: roundToTwo(cdw),
    prepFee: roundToTwo(prepFee),
    kmPackages: roundToTwo(kmPackagesCost),
    hitch: roundToTwo(hitch),
    extraKm: roundToTwo(extraKm),
    generator: roundToTwo(generator),
    cancellationWaiver: roundToTwo(cancellationWaiver),
    windshield: roundToTwo(windshield),
    kitchenKit: roundToTwo(kitchenKit),
    beddingKit: roundToTwo(beddingKit),
    bikeRack: roundToTwo(bikeRack),
    tax: roundToTwo(tax),
  };

  return {
    total,
    totalFormatted: formatCurrency(total),
    summaryMessage: buildSummaryMessage({
      total,
      vehicleType: sanitized.vehicleType,
      calendarDays: days,
    }),
    breakdown,
    lineItems: buildLineItems(breakdown),
  };
};

function runRentalQuoteValidationTests(options = {}) {
  const { silent = false, strict = true } = options;
  const log = silent ? () => {} : (...args) => console.log(...args);

  const run = (title, fn) => {
    log(`\n========== ${title} ==========`);
    try {
      fn(log);
      log("PASS");
    } catch (e) {
      log("FAIL", e.message);
      if (strict) throw e;
    }
  };

  const base = (over) => ({
    vehicleModel: "25ft_slideout_2021_2023",
    kmPackages: 0,
    extraKm: 0,
    generatorHours: 0,
    cancellationWaiver: false,
    windshieldCoverage: false,
    generatorDailyUnlimited: false,
    ...over,
  });

  run("CASE 1: 3 calendar days, CDW on, Class C economy daily min 5 days", (lg) => {
    const q = calculateRentalQuote(
      base({
        startDate: "2026-01-01",
        endDate: "2026-01-03",
        vehicleType: "classC",
      }),
    );
    lg(JSON.stringify(q.breakdown, null, 2));
    assert.strictEqual(q.breakdown.days, 3);
    assert.strictEqual(q.breakdown.cdw, 210);
    assert.strictEqual(q.breakdown.dailyRateTotal, 84 * 5);
  });

  run("CASE 2: 7 days in July (PREMIUM season), CDW = max(7×30,210)", (lg) => {
    const q = calculateRentalQuote(
      base({
        startDate: "2026-07-01",
        endDate: "2026-07-07",
        vehicleType: "classC",
      }),
    );
    lg(JSON.stringify(q.breakdown, null, 2));
    assert.strictEqual(q.breakdown.days, 7);
    assert.strictEqual(q.breakdown.cdw, 210);
    assert.strictEqual(q.breakdown.dailyRateTotal, 224 * 7);
  });

  run("CASE 3: Trailer + hitch 150", (lg) => {
    const q = calculateRentalQuote({
      startDate: "2026-06-15",
      endDate: "2026-06-19",
      vehicleType: "trailer",
      vehicleModel: "19ft_2023",
      kmPackages: 0,
      extraKm: 0,
      generatorHours: 0,
      cancellationWaiver: false,
      windshieldCoverage: false,
      generatorDailyUnlimited: false,
    });
    lg(JSON.stringify(q.breakdown, null, 2));
    assert.strictEqual(q.breakdown.hitch, 150);
  });

  run("CASE 4: Large extraKm + hourly generator", (lg) => {
    const q = calculateRentalQuote(
      base({
        startDate: "2026-01-01",
        endDate: "2026-01-05",
        vehicleType: "classC",
        extraKm: 10000,
        generatorHours: 100,
      }),
    );
    lg(JSON.stringify(q.breakdown, null, 2));
    assert.strictEqual(q.breakdown.extraKm, 4100);
    assert.strictEqual(q.breakdown.generator, 500);
  });

  run("CASE 5: Invalid numerics default safely", (lg) => {
    const q = calculateRentalQuote(
      base({
        startDate: "2026-02-01",
        endDate: "2026-02-07",
        vehicleType: "classC",
        kmPackages: null,
        extraKm: "",
        generatorHours: undefined,
      }),
    );
    lg(JSON.stringify(q.breakdown, null, 2));
    assert.strictEqual(q.breakdown.kmPackages, 0);
    assert.strictEqual(q.breakdown.extraKm, 0);
    assert.strictEqual(q.breakdown.generator, 0);
  });

  if (!silent) {
    log("\nAll rental quote validation cases completed.");
  }
}

module.exports = {
  roundToTwo,
  calendarRentalDays,
  billedDaysForDailyRates,
  getSeason,
  listVehicleModels,
  resolvePricingRow,
  calculateRentalQuote,
  sanitizePayload,
  SEASON_DEFINITIONS,
  PRICING,
  runRentalQuoteValidationTests,
};
