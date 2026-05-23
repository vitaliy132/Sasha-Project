const { formatObjectLines } = require("../utils/structuredFormat");
const { formatCurrency } = require("../utils/pricingUtils");
const { BREAKDOWN_LABELS, CURRENCY_BREAKDOWN_KEYS } = require("../utils/breakdownLabels");
const { shortVehicleTypeLabel } = require("../utils/vehicleLabels");
const { num } = require("../utils/numbers");

const EXTRA_KM_LINE =
  "Additional kms are $0.41 per km, charged at drop off.";

function splitFullName(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first_name = parts[0] || "Customer";
  const last_name = parts.length > 1 ? parts.slice(1).join(" ") : first_name;
  return { first_name, last_name };
}

function formatVehicleModelDisplay(v) {
  const label = (v.vehicleModelLabel || "").trim();
  const key = (v.vehicleModel || "").trim();
  if (label) return label;
  if (key) return key;
  return "";
}

function yn(value) {
  return value === true ? "Yes" : "No";
}

const structuredFormatOptions = {
  currencyKeys: CURRENCY_BREAKDOWN_KEYS,
  formatCurrency,
  formatBool: yn,
};

function formatObjectSection(title, payload, labelMap = {}) {
  const lines = formatObjectLines(payload, labelMap, structuredFormatOptions);
  return lines.length ? `${title}:\n${lines.join("\n")}` : null;
}

/**
 * Human-readable snapshot for the CRM email (matches calculator copy / lead style).
 */
function buildCalculatorRequestSummary(v) {
  const start = (v.startDate || "").trim() || "Not provided";
  const end = (v.endDate || "").trim() || "Not provided";
  const vt = (v.vehicleType || "").trim();
  const vehicleTypeLine = vt ? shortVehicleTypeLabel(vt) : "Not provided";
  const vehicleModelLine = formatVehicleModelDisplay(v) || "Not provided";

  const personalKit = num(v.personalKitPeople ?? v.beddingKitPeople, 0);
  const km1000 = num(v.kmPackages, 0);
  const km100 = num(v.kmPackages100, 0);
  const extraKm = num(v.extraKm, 0);

  let generatorLine = "None ($0)";
  if (v.generatorDailyUnlimited === true) {
    generatorLine = "Daily unlimited ($60/day)";
  } else if (num(v.generatorHours, 0) > 0) {
    generatorLine = `Prepaid generator hours: ${num(v.generatorHours, 0)} ($5/hour)`;
  }

  const lines = [
    `Start date: ${start}`,
    `End date: ${end}`,
    `Vehicle type: ${vehicleTypeLine}`,
    `Vehicle model: ${vehicleModelLine}`,
    `Cancellation waiver ($20/day, min $240): ${yn(v.cancellationWaiver)}`,
    `Windshield coverage: ${yn(v.windshieldCoverage)}`,
    `Kitchen Kit ($85/trip): ${yn(v.kitchenKit)}`,
    `Personal Kit ($35/person): ${personalKit}`,
    `Quantity of 1,000 km packages ($350 each): ${km1000}`,
    `Quantity of 100 km packages ($39 each): ${km100}`,
    `${EXTRA_KM_LINE}`,
    `Estimated additional km (customer entered): ${extraKm}`,
    `Generator option selected: ${generatorLine}`,
  ];

  if (v.bikeRack === true) {
    lines.push("Bike rack: Yes");
  }
  if (v.hasOwnHitch === true) {
    lines.push("Customer has own hitch (trailer rental): Yes");
  }

  return lines.join("\n");
}

module.exports = {
  splitFullName,
  buildCalculatorRequestSummary,
  formatObjectSection,
  BREAKDOWN_LABELS,
};
