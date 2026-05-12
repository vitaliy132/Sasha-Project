const express = require("express");
const { processLead } = require("../services/leadProcessor");
const { asyncHandler } = require("../middleware/auth");
const { HTTP_STATUS, MESSAGES } = require("../utils/constants");
const logger = require("../utils/logger");
const schema = require("../validators/calculatorLead.schema");

const router = express.Router();

const VEHICLE_TYPE_LABELS = {
  classA: "Class A motorhome",
  classB: "Class B camper van",
  classC: "Class C motorhome",
  trailer: "Travel trailer",
};

function splitFullName(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first_name = parts[0] || "Customer";
  const last_name = parts.length > 1 ? parts.slice(1).join(" ") : first_name;
  return { first_name, last_name };
}

function labelVehicleType(vt) {
  if (!vt) return "";
  return VEHICLE_TYPE_LABELS[vt] || vt;
}

function formatVehicleModelRow(label, key) {
  const l = (label || "").trim();
  const k = (key || "").trim();
  if (l && k && l !== k) return `${l} (${k})`;
  return l || k || "";
}

function buildRentalExtrasSummary(v) {
  const lines = [];
  if (v.cancellationWaiver === true) lines.push("Cancellation waiver");
  if (v.windshieldCoverage === true) lines.push("Windshield coverage");
  if (v.generatorDailyUnlimited === true) lines.push("Generator: unlimited daily");
  if (typeof v.kmPackages === "number" && v.kmPackages > 0) {
    lines.push(`Prepaid 1,000 km packages: ${v.kmPackages}`);
  }
  if (typeof v.kmPackages100 === "number" && v.kmPackages100 > 0) {
    lines.push(`Prepaid 100 km packages: ${v.kmPackages100}`);
  }
  if (typeof v.generatorHours === "number" && v.generatorHours > 0) {
    lines.push(`Prepaid generator hours: ${v.generatorHours}`);
  }
  if (typeof v.extraKm === "number" && v.extraKm > 0) {
    lines.push(`Extra km (entered): ${v.extraKm}`);
  }
  if (v.kitchenKit === true) lines.push("Kitchen kit");
  if (typeof v.beddingKitPeople === "number" && v.beddingKitPeople > 0) {
    lines.push(`Bedding kit (people): ${v.beddingKitPeople}`);
  }
  if (v.bikeRack === true) lines.push("Bike rack");
  if (v.hasOwnHitch === true) lines.push("Customer has own hitch (trailer)");
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
  const vm = formatVehicleModelRow(value.vehicleModelLabel, value.vehicleModel);
  const extras = buildRentalExtrasSummary(value);
  const customerNotes = (value.additionalNotes || "").trim();

  const notesParts = [
    idLine,
    value.rentalDetails &&
      `Additional form / calculator fields:\n${JSON.stringify(value.rentalDetails, null, 2)}`,
    value.quoteBreakdown &&
      `Quote breakdown:\n${JSON.stringify(value.quoteBreakdown, null, 2)}`,
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
    notes,
    platform: "rental-calculator",
  };

  if (vt) normalized.vehicle_type = labelVehicleType(vt);
  if (vm) normalized.vehicle_model = vm;
  const start = (value.startDate || "").trim();
  const end = (value.endDate || "").trim();
  if (start) normalized.rental_start = start;
  if (end) normalized.rental_end = end;
  if (extras) normalized.rental_extras = extras;
  if (customerNotes) normalized.customer_notes = customerNotes;

  const result = await processLead(normalized);
  return res.status(result.statusCode).json(result.data);
}));

module.exports = router;
