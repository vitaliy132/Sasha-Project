const assert = require("node:assert");
const { addDays, differenceInCalendarDays, format, isValid, parseISO } = require("date-fns");

const TAX_RATE = 0.13;
/** Minimum number of calendar days summed for the daily rate (extends past endDate when rental is shorter). */
const MIN_CHARGE_DAYS_FOR_DAILY_RATE = 5;
const CDW_DAILY_RATE = 30;
const CDW_MINIMUM = 210;
const KM_PACKAGE_RATE = 350;
const TRAILER_HITCH_FEE = 150;
const EXTRA_KM_RATE = 0.41;
const GENERATOR_HOUR_RATE = 5;

const SEASONS = [
  { name: "high", start: "06-01", end: "08-31", price: 200 },
  { name: "mid", start: "04-01", end: "05-31", price: 150 },
  { name: "low", start: "09-01", end: "03-31", price: 100 },
];

const roundToTwo = (num) => {
  const n = Number(num);
  if (!Number.isFinite(n)) return 0;
  return Number(n.toFixed(2));
};

const formatCurrency = (value) => `$${roundToTwo(value).toFixed(2)}`;

const isDateInSeason = (mmdd, season) => {
  if (season.start <= season.end) {
    return mmdd >= season.start && mmdd <= season.end;
  }
  return mmdd >= season.start || mmdd <= season.end;
};

const getDailyRate = (date) => {
  const mmdd = format(date, "MM-dd");
  const season = SEASONS.find((item) => isDateInSeason(mmdd, item));
  return season ? season.price : 100;
};

const calendarRentalDays = (startDate, endDate) =>
  differenceInCalendarDays(endDate, startDate) + 1;

const billedDaysForDailyRates = (calendarDays) =>
  Math.max(calendarDays, MIN_CHARGE_DAYS_FOR_DAILY_RATE);

const calculateDailyRateTotal = (startDate, daysToSum) => {
  let total = 0;
  for (let dayOffset = 0; dayOffset < daysToSum; dayOffset += 1) {
    total += getDailyRate(addDays(startDate, dayOffset));
  }
  return roundToTwo(total);
};

const getPrepFee = (vehicleType) => (vehicleType === "classA" ? 199 : 149);

const calculateCDW = (cdwPlus, calendarDays) => {
  if (!cdwPlus) return 0;
  return roundToTwo(Math.max(calendarDays * CDW_DAILY_RATE, CDW_MINIMUM));
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
  const vehicleType = ["classA", "classC", "trailer"].includes(vt) ? vt : "classC";

  return {
    startDate: raw?.startDate,
    endDate: raw?.endDate,
    vehicleType,
    cdwPlus: Boolean(raw?.cdwPlus),
    kmPackages: toNonNegativeInteger(raw?.kmPackages, 0),
    extraKm: toNonNegativeInteger(raw?.extraKm, 0),
    generatorHours: toNonNegativeNumber(raw?.generatorHours, 0),
  };
};

const buildLineItems = (b) => [
  { name: "Daily Rental", value: b.dailyRateTotal },
  { name: "CDW", value: b.cdw },
  { name: "Prep Fee", value: b.prepFee },
  { name: "KM Packages", value: b.kmCost },
  { name: "Hitch", value: b.hitchCost },
  { name: "Extra KM", value: b.extraKmCost },
  { name: "Generator Usage", value: b.generatorCost },
  { name: "Tax", value: b.tax },
];

const buildSummaryMessage = ({ total, vehicleType, calendarDays }) => {
  let summary =
    `Your estimated total for this rental is ${formatCurrency(total)}. ` +
    "This includes the daily rental rate, Collision Damage Waiver, preparation fee, selected kilometer packages, taxes, a full tank of propane, and a full demonstration of the vehicle.";

  if (vehicleType === "trailer") {
    summary +=
      " Please note: You must have a properly rated tow vehicle with hitch receiver, brake controller, and electrical adaptor installed.";
  }

  if (calendarDays < MIN_CHARGE_DAYS_FOR_DAILY_RATE) {
    summary += ` Base daily rates are charged for a minimum of ${MIN_CHARGE_DAYS_FOR_DAILY_RATE} days even when your selected dates are shorter.`;
  }

  summary += " A $3000 security deposit is required.";
  return summary;
};

/**
 * Full quote with breakdown matching production contract:
 * days, dailyRateTotal, cdw, prepFee, kmCost, hitchCost, extraKmCost, generatorCost, totalBeforeTax, tax, total
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

  const days = calendarRentalDays(startDate, endDate);
  const daysForDailyRateSum = billedDaysForDailyRates(days);
  const dailyRateTotal = calculateDailyRateTotal(startDate, daysForDailyRateSum);
  const cdw = calculateCDW(sanitized.cdwPlus, days);

  const prepFee = roundToTwo(getPrepFee(sanitized.vehicleType));
  const kmCost = roundToTwo(sanitized.kmPackages * KM_PACKAGE_RATE);
  const hitchCost = roundToTwo(sanitized.vehicleType === "trailer" ? TRAILER_HITCH_FEE : 0);
  const extraKmCost = roundToTwo(sanitized.extraKm * EXTRA_KM_RATE);
  const generatorCost = roundToTwo(sanitized.generatorHours * GENERATOR_HOUR_RATE);

  const subtotal = roundToTwo(dailyRateTotal + cdw);
  const totalBeforeTax = roundToTwo(
    subtotal + prepFee + kmCost + hitchCost + extraKmCost + generatorCost,
  );
  const tax = roundToTwo(totalBeforeTax * TAX_RATE);
  const total = roundToTwo(totalBeforeTax + tax);

  const breakdown = {
    days,
    dailyRateTotal: roundToTwo(dailyRateTotal),
    cdw: roundToTwo(cdw),
    prepFee: roundToTwo(prepFee),
    kmCost: roundToTwo(kmCost),
    hitchCost: roundToTwo(hitchCost),
    extraKmCost: roundToTwo(extraKmCost),
    generatorCost: roundToTwo(generatorCost),
    totalBeforeTax: roundToTwo(totalBeforeTax),
    tax: roundToTwo(tax),
    total: roundToTwo(total),
  };

  return {
    total: breakdown.total,
    totalFormatted: formatCurrency(breakdown.total),
    summaryMessage: buildSummaryMessage({
      total: breakdown.total,
      vehicleType: sanitized.vehicleType,
      calendarDays: days,
    }),
    breakdown,
    lineItems: buildLineItems(breakdown),
  };
};

/**
 * Runs documented business-rule cases; logs full breakdowns. Throws on failure if strict (default).
 * @param {{ silent?: boolean, strict?: boolean }} [options]
 */
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

  run("CASE 1: 3 calendar days, CDW on → CDW = $210 minimum; daily rates = 5 days", (lg) => {
    const q = calculateRentalQuote({
      startDate: "2026-01-01",
      endDate: "2026-01-03",
      vehicleType: "classC",
      cdwPlus: true,
      kmPackages: 0,
      extraKm: 0,
      generatorHours: 0,
    });
    lg(JSON.stringify(q.breakdown, null, 2));
    assert.strictEqual(q.breakdown.days, 3);
    assert.strictEqual(q.breakdown.cdw, 210);
    assert.strictEqual(q.breakdown.dailyRateTotal, 500);
  });

  run("CASE 2: 7 calendar days, CDW on → CDW = max(7×30, 210) = 210", (lg) => {
    const q = calculateRentalQuote({
      startDate: "2026-07-01",
      endDate: "2026-07-07",
      vehicleType: "classC",
      cdwPlus: true,
      kmPackages: 0,
      extraKm: 0,
      generatorHours: 0,
    });
    lg(JSON.stringify(q.breakdown, null, 2));
    assert.strictEqual(q.breakdown.days, 7);
    assert.strictEqual(q.breakdown.cdw, 210);
    assert.strictEqual(q.breakdown.dailyRateTotal, 1400);
  });

  run("CASE 3: Trailer → hitchCost = 150", (lg) => {
    const q = calculateRentalQuote({
      startDate: "2026-06-01",
      endDate: "2026-06-05",
      vehicleType: "trailer",
      cdwPlus: false,
      kmPackages: 0,
      extraKm: 0,
      generatorHours: 0,
    });
    lg(JSON.stringify(q.breakdown, null, 2));
    assert.strictEqual(q.breakdown.hitchCost, 150);
  });

  run("CASE 4: No extras → extraKmCost and generatorCost = 0", (lg) => {
    const q = calculateRentalQuote({
      startDate: "2026-01-01",
      endDate: "2026-01-05",
      vehicleType: "classC",
      cdwPlus: false,
      kmPackages: 0,
      extraKm: 0,
      generatorHours: 0,
    });
    lg(JSON.stringify(q.breakdown, null, 2));
    assert.strictEqual(q.breakdown.extraKmCost, 0);
    assert.strictEqual(q.breakdown.generatorCost, 0);
  });

  run("CASE 5: Large extraKm and generatorHours", (lg) => {
    const q = calculateRentalQuote({
      startDate: "2026-01-01",
      endDate: "2026-01-05",
      vehicleType: "classC",
      cdwPlus: false,
      kmPackages: 0,
      extraKm: 10000,
      generatorHours: 100,
    });
    lg(JSON.stringify(q.breakdown, null, 2));
    assert.strictEqual(q.breakdown.extraKmCost, 4100);
    assert.strictEqual(q.breakdown.generatorCost, 500);
  });

  run("CASE 6: Invalid numeric inputs (null, \"\", undefined) → 0, no crash", (lg) => {
    const q = calculateRentalQuote({
      startDate: "2026-02-01",
      endDate: "2026-02-07",
      vehicleType: "classC",
      cdwPlus: false,
      kmPackages: null,
      extraKm: "",
      generatorHours: undefined,
    });
    lg(JSON.stringify(q.breakdown, null, 2));
    assert.strictEqual(q.breakdown.kmCost, 0);
    assert.strictEqual(q.breakdown.extraKmCost, 0);
    assert.strictEqual(q.breakdown.generatorCost, 0);
  });

  if (!silent) {
    log("\nAll rental quote validation cases completed.");
  }
}

module.exports = {
  roundToTwo,
  calendarRentalDays,
  billedDaysForDailyRates,
  calculateDailyRateTotal,
  calculateCDW,
  calculateRentalQuote,
  sanitizePayload,
  getDailyRate,
  SEASONS,
  runRentalQuoteValidationTests,
};
