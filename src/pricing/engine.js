const { addDays, differenceInCalendarDays, format, isValid, parseISO } = require("date-fns");
const { roundToTwo, getSeason, formatCurrency } = require("../utils/pricingUtils");
const { toNonNegativeNumber } = require("../utils/numbers");
const { sanitizePayload } = require("./sanitize");
const { resolvePricingRow } = require("./catalog");
const { buildLineItems, buildSummaryMessage } = require("./lineItems");

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
  BIKE_RACK_FEE,
  WINTERIZATION_FEES,
} = require("../utils/pricingConstants");

const { ADD_ONS } = pricingConfig;

const calendarRentalDays = (startDate, endDate) =>
  differenceInCalendarDays(endDate, startDate) + 1;

const billedDaysForDailyRates = (calendarDays) =>
  Math.max(calendarDays, MIN_CHARGE_DAYS_FOR_DAILY_RATE);

/**
 * Sum per-day rates using season + model pricing from config.
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
  const includesWinterDay = (date) => {
    const key = format(date, "MM-dd");
    return key >= "10-15" || key <= "04-30";
  };

  if (includesWinterDay(startDate) || includesWinterDay(endDate)) {
    return true;
  }

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

module.exports = {
  calendarRentalDays,
  billedDaysForDailyRates,
  calculateDailyRateTotal,
  calculateRentalQuote,
};
