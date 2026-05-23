const express = require("express");
const { processLead } = require("../services/leadProcessor");
const { asyncHandler } = require("../middleware/auth");
const { HTTP_STATUS, MESSAGES } = require("../utils/constants");
const logger = require("../utils/logger");
const schema = require("../validators/calculatorLead.schema");

const { formatObjectLines } = require("../utils/structuredFormat");

const router = express.Router();

const EXTRA_KM_LINE =
  "Additional kms are $0.41 per km, charged at drop off.";

/** Short labels to match the rental calculator UI. */
const VEHICLE_TYPE_SHORT = {
  classA: "Class A",
  classB: "Class B+ Mercedes",
  classC: "Class C",
  trailer: "Travel trailer",
};

function splitFullName(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first_name = parts[0] || "Customer";
  const last_name = parts.length > 1 ? parts.slice(1).join(" ") : first_name;
  return { first_name, last_name };
}

function shortVehicleTypeLabel(vt) {
  if (!vt) return "";
  return VEHICLE_TYPE_SHORT[vt] || vt;
}

function formatVehicleModelDisplay(v) {
  const label = (v.vehicleModelLabel || "").trim();
  const key = (v.vehicleModel || "").trim();
  if (label) return label;
  if (key) return key;
  return "";
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function yn(value) {
  return value === true ? "Yes" : "No";
}

const BREAKDOWN_LABELS = {
  days: "Days",
  dailyRateTotal: "Daily Rate",
  cdw: "CDW",
  prepFee: "Prep Fee",
  kmPackages: "KM Packages",
  hitch: "Hitch",
  bikeRack: "Bike Rack",
  winterization: "Winterization",
  extraKm: "Extra KM",
  generator: "Generator",
  cancellationWaiver: "Cancellation Waiver",
  windshield: "Windshield Coverage",
  kitchenKit: "Kitchen Kit",
  beddingKit: "Bedding Kit",
  tax: "Tax",
};

const CURRENCY_BREAKDOWN_KEYS = new Set([
  "dailyRateTotal",
  "cdw",
  "prepFee",
  "kmPackages",
  "hitch",
  "bikeRack",
  "winterization",
  "extraKm",
  "generator",
  "cancellationWaiver",
  "windshield",
  "kitchenKit",
  "beddingKit",
  "tax",
]);

function formatCurrency(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value);
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
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

router.post("/", asyncHandler(async (req, res) => {
  const { error, value } = schema.validate(req.body || {});
  if (error) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: MESSAGES.CALCULATOR_INVALID_PAYLOAD,
      message: error.details?.[0]?.message || "Request body is invalid",
    });
  }

  const quoteStr = value.quote?.trim() || "";
  if (!quoteStr) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: MESSAGES.CALCULATOR_INVALID_PAYLOAD,
      message: "Quote is required",
    });
  }

  const quoteCurrencyRegex = /^\$[\d,]+(\.\d{2})?$/;
  if (!quoteCurrencyRegex.test(quoteStr)) {
    logger.warn("Invalid quote format received", { quote: quoteStr });
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: MESSAGES.CALCULATOR_INVALID_PAYLOAD,
      message: "Quote must be in currency format (e.g., $1,234.56)",
    });
  }

  const { first_name, last_name } = splitFullName(value.name);
  const idLine = value.userId?.trim() ? `User / ManyChat ID: ${value.userId.trim()}` : null;

  const vt = (value.vehicleType || "").trim();
  const calculatorRequestSummary = buildCalculatorRequestSummary(value);
  const customerNotes = (value.additionalNotes || "").trim();

  const notesParts = [
    idLine,
    value.rentalDetails && formatObjectSection("Additional form / calculator fields", value.rentalDetails),
    value.quoteBreakdown && formatObjectSection("Quote breakdown", value.quoteBreakdown, BREAKDOWN_LABELS),
  ].filter(Boolean);
  const notes = notesParts.length ? notesParts.join("\n\n") : undefined;

  logger.info("Rental calculator lead submitted", {
    email: value.email,
    quote: quoteStr,
    userId: value.userId,
    vehicleType: vt || undefined,
    hasRentalDetails: !!value.rentalDetails,
  });

  const normalized = {
    first_name,
    last_name,
    email: value.email.trim(),
    phone: value.phone.trim(),
    address: value.address?.trim(),
    quoted_total: quoteStr,
    calculator_request_summary: calculatorRequestSummary,
    notes,
    platform: "rental-calculator",
  };

  if (customerNotes) normalized.customer_notes = customerNotes;

  const result = await processLead(normalized);
  return res.status(result.statusCode).json(result.data);
}));

module.exports = router;
