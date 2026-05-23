const pricingConfig = require("../config/rentalPricing.json");
const { MINIMUM_RENTAL_DAYS, VALID_VEHICLE_TYPES } = require("../utils/pricingConstants");
const { VEHICLE_TYPE_LABEL } = require("../utils/vehicleLabels");

const { PRICING, defaults } = pricingConfig;

const MODEL_OPTION_LABEL = {
  "30ft_2026": "30 with slide out - 2026",
  "32ft_2017": "32 with slide out/bunks - (Economy) 2017",
  "34ft_2026": "34 with slide out - 2026",
  "35_36ft_slideout_bunks_2026": "35-36 with slide out/bunks - 2026",
  "31ft_slideout_bunks_2026": "31 with slide out/bunks - 2026",
  "25ft_slideout_2020_2021": "25 with slide out - 2021-2020",
  "25ft_slideout_2018_economy": "Economy Rate: 25 with slide out - 2018",
  "23ft_2020_2026": "23 - 2020-2026",
  "23ft_2021_2026": "23 - 2021-2026",
  "19ft_2023_2026": "19 - 2023-2026",
  "27ft_bunks_2024_2026": "27 with bunks - 2024-2026",
};

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

function formatModelOptionLabel(vehicleType, modelId) {
  const typeLabel = VEHICLE_TYPE_LABEL[vehicleType] || vehicleType;
  const modelLabel = MODEL_OPTION_LABEL[modelId];
  if (modelLabel) return `${typeLabel} - ${modelLabel}`;

  const parts = modelId.split("_");
  if (parts.length < 2) return modelId.replaceAll("_", " ");
  const size = parts[0].replace("ft", "");
  return `${typeLabel} ${size}`;
}

function getRentalOptions() {
  return {
    minimumRentalDays: MINIMUM_RENTAL_DAYS,
    vehicleTypes: VALID_VEHICLE_TYPES.map((vehicleType) => ({
      id: vehicleType,
      label: VEHICLE_TYPE_LABEL[vehicleType] || vehicleType,
      defaultModel: defaults?.vehicleModelByType?.[vehicleType] || "",
      models: listVehicleModels(vehicleType).map((modelId) => ({
        id: modelId,
        label: formatModelOptionLabel(vehicleType, modelId),
      })),
    })),
  };
}

module.exports = {
  MODEL_OPTION_LABEL,
  listVehicleModels,
  resolvePricingRow,
  formatModelOptionLabel,
  getRentalOptions,
};
