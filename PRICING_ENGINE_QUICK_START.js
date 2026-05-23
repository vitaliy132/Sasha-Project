#!/usr/bin/env node

/**
 * PRICING ENGINE QUICK REFERENCE
 *
 * Run: node PRICING_ENGINE_QUICK_START.js
 */

const { parseISO } = require("date-fns");
const { calculateRentalQuote } = require("./src/services/rentalQuote");
const { getSeason } = require("./src/utils/pricingUtils");

const quote = calculateRentalQuote({
  vehicleType: "classC",
  vehicleModel: "25ft_slideout_2020_2021",
  startDate: "2026-01-05",
  endDate: "2026-01-09",
  kmPackages: 0,
  extraKm: 0,
  generatorDailyUnlimited: false,
  kitchenKit: false,
  beddingKitPeople: 0,
});

console.log("Example: Class C economy 5-day rental");
console.log(`  Total: ${quote.totalFormatted}`);
console.log(`  Days: ${quote.breakdown.days}`);
console.log(`  Daily rate total: $${quote.breakdown.dailyRateTotal}`);
console.log(`  CDW: $${quote.breakdown.cdw}`);
console.log(`  Prep fee: $${quote.breakdown.prepFee}`);
console.log(`  Tax: $${quote.breakdown.tax}`);
console.log(`\nSummary:\n${quote.summaryMessage}\n`);

console.log("API endpoint: POST /calculate-rental");
console.log(`
Request body (required fields):
{
  "vehicleType": "classA" | "classB" | "classC" | "trailer",
  "vehicleModel": "string (from GET /rental-options)",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "kmPackages": number,
  "extraKm": number,
  "generatorDailyUnlimited": boolean,
  "kitchenKit": boolean,
  "beddingKitPeople": number
}
`);

console.log("Season detection examples:");
["2026-07-15", "2026-06-20", "2026-05-20", "2026-01-15"].forEach((date) => {
  console.log(`  ${date}: ${getSeason(parseISO(date))}`);
});
