#!/usr/bin/env node

/**
 * PRICING ENGINE QUICK REFERENCE
 * 
 * A deterministic pricing calculator for the rental system.
 * Supports: unit type, model, seasonal rates, CDW, fees, mileage, and tax.
 */

// ============================================================================
// IMPORT THE ENGINE
// ============================================================================

const { calculatePrice, getSeason } = require('./src/services/pricingEngine');

// ============================================================================
// EXAMPLE 1: Basic Economy Rental
// ============================================================================

const basic = calculatePrice({
  unitType: 'class_c',
  unitModel: 'mercedes_2021_2023',
  startDate: '2026-01-05',
  endDate: '2026-01-09',
});

console.log('Example 1: Basic Economy 5-day Rental');
console.log(`  Total: ${basic.totalFormatted}`);
console.log(`  Base: $${basic.basePrice}, CDW: $${basic.cdw}, Prep: $${basic.preparationFee}`);
console.log(`  Tax: $${basic.tax}\n`);

// ============================================================================
// EXAMPLE 2: Cross-Season Premium Rental with Mileage Package
// ============================================================================

const crossSeason = calculatePrice({
  unitId: 'premium-001',
  unitType: 'class_a',
  unitModel: '30ft_2026',
  startDate: '2026-06-28',
  endDate: '2026-07-15',
  mileage: { type: 'package', value: 2 }
});

console.log('Example 2: Cross-Season Premium Rental');
console.log(`  Dates: ${crossSeason.startDate} to ${crossSeason.endDate}`);
console.log(`  Days: ${crossSeason.days}`);
console.log(`  Daily Rates Breakdown:`);
crossSeason.dailyRates.slice(0, 3).forEach(r => {
  console.log(`    ${r.date} (${r.season}): $${r.price}`);
});
console.log(`    ... (${crossSeason.dailyRates.length - 3} more days)`);
console.log(`  Base: $${crossSeason.basePrice}`);
console.log(`  Mileage (2×$350): $${crossSeason.mileageCost}`);
console.log(`  Total: ${crossSeason.totalFormatted}\n`);

// ============================================================================
// EXAMPLE 3: Trailer with Hitch Fee
// ============================================================================

const trailer = calculatePrice({
  unitType: 'trailer',
  unitModel: '21_2023',
  startDate: '2026-05-20',
  endDate: '2026-05-27',
  mileage: { type: 'per_km', value: 500 }
});

console.log('Example 3: Trailer Rental');
console.log(`  Base: $${trailer.basePrice}`);
console.log(`  Hitch Fee: $${trailer.hitchFee}`);
console.log(`  Mileage (500km × $0.41): $${trailer.mileageCost}`);
console.log(`  Subtotal: $${trailer.subtotal}`);
console.log(`  Total: ${trailer.totalFormatted}\n`);

// ============================================================================
// API ENDPOINT: POST /calculate
// ============================================================================

console.log('API ENDPOINT: POST /calculate');
console.log(`
Request body:
{
  "unitType": "class_a" | "class_b" | "class_c" | "trailer",
  "unitModel": "string (from config)",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "mileage": {
    "type": "package" | "per_km",
    "value": number
  }
}

Response includes:
- unitType, unitModel, dates
- days: number of days
- dailyRates: array of { date, season, price }
- basePrice: sum of daily rates
- cdw: collision damage waiver
- preparationFee: unit type fee
- mileageCost: mileage charges
- hitchFee: trailer fee if applicable
- subtotal: before tax
- tax: 13% of subtotal
- total: final price
- totalFormatted: formatted for display
`);

// ============================================================================
// SEASON EXAMPLES
// ============================================================================

console.log('\nSeason Detection Examples:');
const testDates = [
  '2026-07-15',  // PREMIUM
  '2026-06-20',  // PRIME
  '2026-05-20',  // SHOULDER
  '2026-01-15',  // ECONOMY
];

testDates.forEach(date => {
  const season = getSeason(new Date(date));
  console.log(`  ${date}: ${season}`);
});

// ============================================================================
// CONSTANTS & RULES
// ============================================================================

console.log(`
PRICING RULES:
- CDW: max(days × $30, $210 minimum)
- Prep Fee: $199 (Class A), $149 (others)
- Mileage: Does NOT multiply by days
  - Package: fixed price per package
  - Per-km: fixed price per kilometer
- Trailer: +$150 hitch fee
- Tax: 13% applied to subtotal

SEASONS (by MM-DD):
- PREMIUM: 07-01 to 08-31
- PRIME: 06-11 to 06-30 AND 09-01 to 09-30
- SHOULDER: 05-15 to 06-10 AND 10-01 to 10-25
- ECONOMY: 10-26 to 12-31 AND 01-01 to 05-14

UNIT TYPES (unitType):
- class_a: Class A motorhomes ($199 prep)
- class_b: Class B motorhomes ($149 prep)
- class_c: Class C motorhomes ($149 prep)
- trailer: Travel trailers ($149 prep, +$150 hitch)

MILEAGE MODELS (unitModel):
- See src/config/rentalPricing.json for all models
`);
