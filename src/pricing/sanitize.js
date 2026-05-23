const pricingConfig = require("../config/rentalPricing.json");
const { VALID_VEHICLE_TYPES } = require("../utils/pricingConstants");
const { toNonNegativeInteger, toNonNegativeNumber } = require("../utils/numbers");

const { defaults } = pricingConfig;

/** Legacy vehicle model keys mapped to current pricing config keys. */
const DEPRECATED_VEHICLE_MODELS = {
  "35ft_2025": "35_36ft_slideout_bunks_2026",
  "36ft_2025": "35_36ft_slideout_bunks_2026",
  "30ft_2024": "30ft_2026",
  "34ft_2023": "34ft_2026",
  "35_36ft_slideout_bunks_2025": "35_36ft_slideout_bunks_2026",
  "31ft_slideout_bunks_2019": "31ft_slideout_bunks_2026",
  "25ft_slideout_2021_2023": "25ft_slideout_2020_2021",
  "23ft_2021_2023": "23ft_2021_2026",
  "19ft_2023": "19ft_2023_2026",
  "27ft_bunks_2024": "27ft_bunks_2024_2026",
};

const sanitizePayload = (raw) => {
  const vt = raw?.vehicleType;
  const vehicleType = VALID_VEHICLE_TYPES.includes(vt) ? vt : "classA";

  const defaultModel = defaults?.vehicleModelByType?.[vehicleType] || "";
  const rawModel = typeof raw?.vehicleModel === "string" ? raw.vehicleModel.trim() : "";
  let vehicleModel = rawModel || defaultModel;
  if (DEPRECATED_VEHICLE_MODELS[vehicleModel]) {
    vehicleModel = DEPRECATED_VEHICLE_MODELS[vehicleModel];
  }

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

module.exports = {
  DEPRECATED_VEHICLE_MODELS,
  sanitizePayload,
};
