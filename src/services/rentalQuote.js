const pricingConfig = require("../config/rentalPricing.json");
const { roundToTwo } = require("../utils/pricingUtils");
const { sanitizePayload } = require("../pricing/sanitize");
const {
  listVehicleModels,
  resolvePricingRow,
  getRentalOptions,
} = require("../pricing/catalog");
const {
  calendarRentalDays,
  billedDaysForDailyRates,
  calculateRentalQuote,
} = require("../pricing/engine");

const { SEASONS: SEASON_DEFINITIONS, PRICING } = pricingConfig;

module.exports = {
  roundToTwo,
  calendarRentalDays,
  billedDaysForDailyRates,
  listVehicleModels,
  resolvePricingRow,
  getRentalOptions,
  calculateRentalQuote,
  sanitizePayload,
  SEASON_DEFINITIONS,
  PRICING,
};
