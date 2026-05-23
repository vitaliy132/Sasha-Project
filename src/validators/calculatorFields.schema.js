const Joi = require("joi");

/** Shared calculator trip / add-on fields (rental quote + lead submit). */
const calculatorTripFields = {
  vehicleType: Joi.string().valid("classA", "classB", "classC", "trailer"),
  vehicleModel: Joi.string().trim(),
  cancellationWaiver: Joi.boolean(),
  windshieldCoverage: Joi.boolean(),
  generatorDailyUnlimited: Joi.boolean(),
  /** Count of prepaid 1,000 km packages ($350 each per PDF) */
  kmPackages: Joi.number().integer().min(0),
  /** Count of prepaid 100 km packages ($39 each per PDF) */
  kmPackages100: Joi.number().integer().min(0),
  generatorHours: Joi.number().min(0),
  extraKm: Joi.number().min(0),
  kitchenKit: Joi.boolean(),
  beddingKitPeople: Joi.number().integer().min(0),
  bikeRack: Joi.boolean(),
  hasOwnHitch: Joi.boolean(),
};

/** Strict fields for POST /calculate-rental */
const calculatorTripFieldsStrict = {
  vehicleType: calculatorTripFields.vehicleType.required(),
  vehicleModel: calculatorTripFields.vehicleModel.min(1).required(),
  cancellationWaiver: calculatorTripFields.cancellationWaiver.optional().default(false),
  windshieldCoverage: calculatorTripFields.windshieldCoverage.optional().default(false),
  generatorDailyUnlimited: calculatorTripFields.generatorDailyUnlimited.optional().default(false),
  kmPackages: calculatorTripFields.kmPackages.required(),
  kmPackages100: calculatorTripFields.kmPackages100.optional().default(0),
  generatorHours: calculatorTripFields.generatorHours.optional().default(0),
  extraKm: calculatorTripFields.extraKm.optional().default(0),
  kitchenKit: calculatorTripFields.kitchenKit.optional().default(false),
  beddingKitPeople: calculatorTripFields.beddingKitPeople.optional().default(0),
  bikeRack: calculatorTripFields.bikeRack.optional().default(false),
  hasOwnHitch: calculatorTripFields.hasOwnHitch.optional().default(false),
};

/** Loose fields for POST /submit-lead (optional strings / partial data). */
const calculatorTripFieldsLoose = {
  vehicleType: calculatorTripFields.vehicleType.allow("").optional().default(""),
  vehicleModel: calculatorTripFields.vehicleModel.allow("").optional().default(""),
  vehicleModelLabel: Joi.string().trim().allow("").optional().default(""),
  startDate: Joi.string().trim().allow("").optional().default(""),
  endDate: Joi.string().trim().allow("").optional().default(""),
  cancellationWaiver: calculatorTripFields.cancellationWaiver.optional(),
  windshieldCoverage: calculatorTripFields.windshieldCoverage.optional(),
  generatorDailyUnlimited: calculatorTripFields.generatorDailyUnlimited.optional(),
  kmPackages: calculatorTripFields.kmPackages.optional(),
  kmPackages100: calculatorTripFields.kmPackages100.optional(),
  generatorHours: calculatorTripFields.generatorHours.optional(),
  extraKm: calculatorTripFields.extraKm.optional(),
  kitchenKit: calculatorTripFields.kitchenKit.optional(),
  beddingKitPeople: calculatorTripFields.beddingKitPeople.optional(),
  personalKitPeople: Joi.number().integer().min(0).optional(),
  bikeRack: calculatorTripFields.bikeRack.optional(),
  hasOwnHitch: calculatorTripFields.hasOwnHitch.optional(),
  additionalNotes: Joi.string().trim().allow("").optional().default(""),
  rentalDetails: Joi.object().unknown(true).optional(),
  quoteBreakdown: Joi.object().unknown(true).optional(),
};

module.exports = {
  calculatorTripFields,
  calculatorTripFieldsStrict,
  calculatorTripFieldsLoose,
};
