const assert = require("node:assert");
const { addDays, differenceInCalendarDays, format, isValid, parseISO } = require("date-fns");
const { roundToTwo, getSeason, mmdd, inSeasonRange, formatCurrency } = require("../utils/pricingUtils");

const pricingConfig = require("../config/rentalPricing.json");
const {
  TAX_RATE,
  MIN_CHARGE_DAYS_FOR_DAILY_RATE,
  CDW_DAILY_RATE,
  CDW_MINIMUM,
  KM_PACKAGE_100KM_RATE,
  KM_PACKAGE_1000KM_RATE,
  TRAILER_HITCH_FEE,
  EXTRA_KM_RATE,
  GENERATOR_HOUR_RATE,
  GENERATOR_DAILY_UNLIMITED_RATE,
  CANCELLATION_DAILY_RATE,
  CANCELLATION_MINIMUM,
  BIKE_RACK_FEE,
  WINTERIZATION_FEES,
  VALID_VEHICLE_TYPES,
  SECURITY_DEPOSIT,
  AWNING_DEPOSIT,
} = require("../utils/pricingConstants");

const { SEASONS: SEASON_DEFINITIONS, PRICING, ADD_ONS, defaults } = pricingConfig;

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

const calculateGenerator = (generatorDailyUnlimited, generatorHours, billedDayCount) => {
  if (generatorDailyUnlimited) {
    return roundToTwo(ADD_ONS.generator.daily * billedDayCount);
  }
  return roundToTwo(toNonNegativeNumber(generatorHours, 0) * ADD_ONS.generator.hourly);
};

const isWinterizationRequired = (startDate, endDate) => {
  const startKey = format(startDate, "MM-dd");
  const endKey = format(endDate, "MM-dd");
  const includesWinterDay = (date) => {
    const key = format(date, "MM-dd");
    return key >= "10-15" || key <= "04-30";
  };

  if (includesWinterDay(startDate) || includesWinterDay(endDate)) {
    return true;
  }

  // If the rental spans the boundary between April and October, any overlap with the winter range is handled above.
  let current = startDate;
  while (current < endDate) {
    if (includesWinterDay(current)) return true;
    current = addDays(current, 1);
  }
  return includesWinterDay(endDate);
};

const calculateWinterizationFee = (vehicleType, startDate, endDate) => {
  if (!isWinterizationRequired(startDate, endDate)) return 0;
  const fee = WINTERIZATION_FEES[vehicleType] ?? 0;
  return roundToTwo(fee);
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

const sanitizePayload = (raw) => {
  const vt = raw?.vehicleType;
  const vehicleType = VALID_VEHICLE_TYPES.includes(vt) ? vt : "classA";

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
    kmPackages100: toNonNegativeInteger(raw?.kmPackages100, 0),
    extraKm: toNonNegativeInteger(raw?.extraKm, 0),
    generatorHours: toNonNegativeNumber(raw?.generatorHours, 0),
    kitchenKit: Boolean(raw?.kitchenKit),
    beddingKitPeople: toNonNegativeInteger(raw?.beddingKitPeople, 0),
    bikeRack: Boolean(raw?.bikeRack),
    hasOwnHitch: Boolean(raw?.hasOwnHitch),
  };
};

const buildLineItems = (b) => {
  const items = [
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
    { name: "Tax", value: b.tax },
  ];

  if (b.bikeRack > 0) items.splice(5, 0, { name: "Bike Rack", value: b.bikeRack });
  if (b.winterization > 0) items.splice(6, 0, { name: "Winterization", value: b.winterization });

  return items;
};

const buildSummaryMessage = ({ total, vehicleType }) => {
  const intro = `Your estimated total for this rental is ${formatCurrency(total)}. As indicated below, this includes the daily rental rate, preparation fee, kilometer packages where applicable, taxes, a full tank of propane, CDW Plus (Collision Damage Waiver), and a full demonstration of the vehicle.`;
  const trailerNote =
    vehicleType === "trailer"
      ? " Please note: You must have a properly rated tow vehicle with hitch receiver, brake controller, and electrical adaptor installed."
      : "";
  const deposits =
    " A $3000 security deposit is required on all rentals. An additional $1000 awning deposit applies if awning use is selected.";
  return `${intro}${trailerNote}${deposits}`;
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
  const kmPackagesCost = roundToTwo(
    sanitized.kmPackages100 * KM_PACKAGE_100KM_RATE + sanitized.kmPackages * KM_PACKAGE_1000KM_RATE,
  );
  const bikeRack = sanitized.bikeRack ? roundToTwo(BIKE_RACK_FEE) : 0;
  const hitch = roundToTwo(
    sanitized.vehicleType === "trailer" && !sanitized.hasOwnHitch
      ? TRAILER_HITCH_FEE
      : 0,
  );
  const extraKm = sanitized.vehicleType === "trailer" ? 0 : roundToTwo(sanitized.extraKm * EXTRA_KM_RATE);
  const generator = calculateGenerator(
    sanitized.generatorDailyUnlimited,
    sanitized.generatorHours,
    daysForDailyRateSum,
  );
  const winterization = calculateWinterizationFee(
    sanitized.vehicleType,
    startDate,
    endDate,
  );
  const cancellationWaiver = calculateCancellationWaiver(sanitized.cancellationWaiver, days);
  const windshield = calculateWindshield(
    sanitized.vehicleType,
    days,
    sanitized.windshieldCoverage,
  );
  const kitchenKit = calculateKitchenKit(sanitized.kitchenKit);
  const beddingKit = calculateBeddingKit(sanitized.beddingKitPeople);

  const subtotal = roundToTwo(dailyRateTotal + cdw);
  const totalBeforeTax = roundToTwo(
    subtotal +
      prepFee +
      kmPackagesCost +
      hitch +
      bikeRack +
      winterization +
      extraKm +
      generator +
      cancellationWaiver +
      windshield +
      kitchenKit +
      beddingKit,
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
    bikeRack: roundToTwo(bikeRack),
    winterization: roundToTwo(winterization),
    extraKm: roundToTwo(extraKm),
    generator: roundToTwo(generator),
    cancellationWaiver: roundToTwo(cancellationWaiver),
    windshield: roundToTwo(windshield),
    kitchenKit: roundToTwo(kitchenKit),
    beddingKit: roundToTwo(beddingKit),
    tax: roundToTwo(tax),
  };

  return {
    total,
    totalFormatted: formatCurrency(total),
    summaryMessage: buildSummaryMessage({
      total,
      vehicleType: sanitized.vehicleType,
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
    vehicleType: "classC",
    vehicleModel: "25ft_slideout_2021_2023",
    kmPackages: 0,
    kmPackages100: 0,
    extraKm: 0,
    generatorHours: 0,
    cancellationWaiver: false,
    windshieldCoverage: false,
    generatorDailyUnlimited: false,
    ...over,
  });

  run("CASE 1: 3 calendar days, CDW on, Class C shoulder daily min 5 days", (lg) => {
    const q = calculateRentalQuote(
      base({
        startDate: "2026-01-01",
        endDate: "2026-01-03",
      }),
    );
    lg(JSON.stringify(q.breakdown, null, 2));
    assert.strictEqual(q.breakdown.days, 3);
    assert.strictEqual(q.breakdown.cdw, 210);
    assert.strictEqual(q.breakdown.dailyRateTotal, 94 * 5);
  });

  run("CASE 2: 7 days in July (PREMIUM season), Class A 30ft", (lg) => {
    const q = calculateRentalQuote(
      base({
        startDate: "2026-07-01",
        endDate: "2026-07-07",
        vehicleType: "classA",
        vehicleModel: "30ft_2024",
      }),
    );
    lg(JSON.stringify(q.breakdown, null, 2));
    assert.strictEqual(q.breakdown.days, 7);
    assert.strictEqual(q.breakdown.cdw, 210);
    assert.strictEqual(q.breakdown.dailyRateTotal, 289 * 7);
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

  run("CASE 3.5: Trailer with extraKm should not charge", (lg) => {
    const q = calculateRentalQuote({
      startDate: "2026-06-15",
      endDate: "2026-06-19",
      vehicleType: "trailer",
      vehicleModel: "19ft_2023",
      kmPackages: 0,
      extraKm: 100,
      generatorHours: 0,
      cancellationWaiver: false,
      windshieldCoverage: false,
      generatorDailyUnlimited: false,
    });
    lg(JSON.stringify(q.breakdown, null, 2));
    assert.strictEqual(q.breakdown.extraKm, 0);
  });

  run("CASE 4: Large extraKm + hourly generator", (lg) => {
    const q = calculateRentalQuote(
      base({
        startDate: "2026-01-01",
        endDate: "2026-01-05",
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
        kmPackages: null,
        kmPackages100: null,
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
