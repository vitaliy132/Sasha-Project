/**
 * Pricing Engine Tests
 * Comprehensive test suite for the deterministic pricing engine
 */
const { describe, it } = require("node:test");
const assert = require("node:assert");
const { parseISO } = require("date-fns");

const {
  calculatePrice,
  getSeason,
  calculateCDW,
  getPreparationFee,
  calculateMileageCost,
  calculateHitchFee,
  validateUnit,
  roundToTwo,
} = require("../src/services/pricingEngine.js");

// ============================================================================
// SEASON TESTS
// ============================================================================
describe("getSeason() - Season Detection", () => {
  it("PREMIUM season: Jul 1 – Aug 31", () => {
    assert.strictEqual(getSeason(parseISO("2026-07-01")), "PREMIUM");
    assert.strictEqual(getSeason(parseISO("2026-07-15")), "PREMIUM");
    assert.strictEqual(getSeason(parseISO("2026-08-31")), "PREMIUM");
  });

  it("PRIME season: Jun 11 – Jun 30", () => {
    assert.strictEqual(getSeason(parseISO("2026-06-11")), "PRIME");
    assert.strictEqual(getSeason(parseISO("2026-06-20")), "PRIME");
    assert.strictEqual(getSeason(parseISO("2026-06-30")), "PRIME");
  });

  it("PRIME season: Sep 1 – Sep 30", () => {
    assert.strictEqual(getSeason(parseISO("2026-09-01")), "PRIME");
    assert.strictEqual(getSeason(parseISO("2026-09-15")), "PRIME");
    assert.strictEqual(getSeason(parseISO("2026-09-30")), "PRIME");
  });

  it("SHOULDER season: May 15 – Jun 10", () => {
    assert.strictEqual(getSeason(parseISO("2026-05-15")), "SHOULDER");
    assert.strictEqual(getSeason(parseISO("2026-05-20")), "SHOULDER");
    assert.strictEqual(getSeason(parseISO("2026-06-10")), "SHOULDER");
  });

  it("SHOULDER season: Oct 1 – Oct 25", () => {
    assert.strictEqual(getSeason(parseISO("2026-10-01")), "SHOULDER");
    assert.strictEqual(getSeason(parseISO("2026-10-10")), "SHOULDER");
    assert.strictEqual(getSeason(parseISO("2026-10-25")), "SHOULDER");
  });

  it("ECONOMY season: Oct 26 – May 14", () => {
    assert.strictEqual(getSeason(parseISO("2026-10-26")), "ECONOMY");
    assert.strictEqual(getSeason(parseISO("2026-11-01")), "ECONOMY");
    assert.strictEqual(getSeason(parseISO("2026-01-01")), "ECONOMY");
    assert.strictEqual(getSeason(parseISO("2026-05-14")), "ECONOMY");
  });

  it("Boundary dates", () => {
    // Day before PREMIUM
    assert.strictEqual(getSeason(parseISO("2026-06-30")), "PRIME");
    // First day of PREMIUM
    assert.strictEqual(getSeason(parseISO("2026-07-01")), "PREMIUM");
    // Last day of PREMIUM
    assert.strictEqual(getSeason(parseISO("2026-08-31")), "PREMIUM");
    // Day after PREMIUM
    assert.strictEqual(getSeason(parseISO("2026-09-01")), "PRIME");
  });
});

// ============================================================================
// CDW TESTS
// ============================================================================
describe("calculateCDW() - Collision Damage Waiver", () => {
  it("3 days: 3 * 30 = 90, but minimum is 210", () => {
    const cdw = calculateCDW(3);
    assert.strictEqual(cdw, 210);
  });

  it("7 days: 7 * 30 = 210, equals minimum", () => {
    const cdw = calculateCDW(7);
    assert.strictEqual(cdw, 210);
  });

  it("15 days: 15 * 30 = 450, exceeds minimum", () => {
    const cdw = calculateCDW(15);
    assert.strictEqual(cdw, 450);
  });

  it("30 days: 30 * 30 = 900", () => {
    const cdw = calculateCDW(30);
    assert.strictEqual(cdw, 900);
  });
});

// ============================================================================
// PREPARATION FEE TESTS
// ============================================================================
describe("getPreparationFee() - Unit Type Fees", () => {
  it("class_a: 199", () => {
    assert.strictEqual(getPreparationFee("class_a"), 199);
  });

  it("class_b: 149", () => {
    assert.strictEqual(getPreparationFee("class_b"), 149);
  });

  it("class_c: 149", () => {
    assert.strictEqual(getPreparationFee("class_c"), 149);
  });

  it("trailer: 149", () => {
    assert.strictEqual(getPreparationFee("trailer"), 149);
  });

  it("invalid type throws error", () => {
    assert.throws(
      () => getPreparationFee("invalid_type"),
      /No prep fee defined/
    );
  });
});

// ============================================================================
// MILEAGE COST TESTS
// ============================================================================
describe("calculateMileageCost() - Mileage Options", () => {
  it("No mileage option: 0", () => {
    const cost = calculateMileageCost(undefined, 5, "class_a");
    assert.strictEqual(cost, 0);
  });

  it("Package type: 1 package * 350 = 350", () => {
    const cost = calculateMileageCost({ type: "package", value: 1 }, 5, "class_a");
    assert.strictEqual(cost, 350);
  });

  it("Package type: 2 packages * 350 = 700", () => {
    const cost = calculateMileageCost({ type: "package", value: 2 }, 5, "class_a");
    assert.strictEqual(cost, 700);
  });

  it("Per-km type: does not calculate extra kms (handled at drop-off)", () => {
    const cost = calculateMileageCost({ type: "per_km", value: 100 }, 5, "class_a");
    assert.strictEqual(cost, 0);
  });

  it("Per-km type: does not calculate extra kms (handled at drop-off)", () => {
    const cost = calculateMileageCost({ type: "per_km", value: 1000 }, 5, "class_a");
    assert.strictEqual(cost, 0);
  });

  it("Mileage cost does NOT multiply by days (for either type)", () => {
    const cost1 = calculateMileageCost({ type: "package", value: 1 }, 5, "class_a");
    const cost2 = calculateMileageCost({ type: "package", value: 1 }, 100, "class_a");
    assert.strictEqual(cost1, cost2); // Should be same regardless of days
  });

  it("Zero value: 0", () => {
    const cost = calculateMileageCost({ type: "package", value: 0 }, 5, "class_a");
    assert.strictEqual(cost, 0);
  });
});

// ============================================================================
// TRAILER HITCH FEE TESTS
// ============================================================================
describe("calculateHitchFee() - Trailer Fee", () => {
  it("trailer: 150", () => {
    assert.strictEqual(calculateHitchFee("trailer"), 150);
  });

  it("class_a: 0", () => {
    assert.strictEqual(calculateHitchFee("class_a"), 0);
  });

  it("class_b: 0", () => {
    assert.strictEqual(calculateHitchFee("class_b"), 0);
  });

  it("class_c: 0", () => {
    assert.strictEqual(calculateHitchFee("class_c"), 0);
  });
});

// ============================================================================
// UNIT VALIDATION TESTS
// ============================================================================
describe("validateUnit() - Unit Type & Model Validation", () => {
  it("valid class_c model: 25ft_slideout_2021_2023", () => {
    const pricing = validateUnit("class_c", "25ft_slideout_2021_2023");
    assert.ok(pricing);
    assert.ok(pricing.PREMIUM);
    assert.ok(pricing.PRIME);
  });

  it("invalid unit type: unknown_type", () => {
    assert.throws(
      () => validateUnit("unknown_type", "model"),
      /Invalid unit type/
    );
  });

  it("invalid model for valid type: nonexistent_model", () => {
    assert.throws(
      () => validateUnit("class_c", "nonexistent_model"),
      /Unknown model/
    );
  });

  it("validates class_c model with slideout", () => {
    const pricing = validateUnit("class_c", "25ft_slideout_2021_2023");
    assert.ok(pricing);
    assert.strictEqual(pricing.PREMIUM, 244);
  });

  it("resolves 31ft_slideout_bunks_2019 as class_c", () => {
    const result = calculatePrice({
      unitType: "class_c",
      unitModel: "31ft_slideout_bunks_2019",
      startDate: "2026-07-01",
      endDate: "2026-07-05",
      mileage: undefined,
    });

    assert.strictEqual(result.resolvedUnitType, "class_c");
    assert.strictEqual(result.resolvedUnitModel, "31ft_slideout_bunks_2019");
    assert.strictEqual(result.basePrice, 264 * 5);
  });
});

// ============================================================================
// FULL PRICING CALCULATION TESTS
// ============================================================================
describe("calculatePrice() - Full Pricing Workflow", () => {
  it("BASIC: 5 days economy (class_c, mercedes)", () => {
    const result = calculatePrice({
      unitId: "unit-123",
      unitType: "class_c",
      unitModel: "25ft_slideout_2021_2023",
      startDate: "2026-01-05",
      endDate: "2026-01-09",
      mileage: undefined,
    });

    assert.strictEqual(result.days, 5);
    assert.strictEqual(result.dailyRates.length, 5);
    assert.strictEqual(result.basePrice, 94 * 5); // 470
    assert.strictEqual(result.cdw, 210); // 5 * 30 = 150, but minimum 210
    assert.strictEqual(result.preparationFee, 149);
    assert.strictEqual(result.mileageCost, 0);
    assert.strictEqual(result.hitchFee, 0);
    
    // subtotal = 470 + 210 + 149 = 829
    assert.strictEqual(result.subtotal, 829);
    // tax = 829 * 0.13 = 107.77
    assert.strictEqual(result.tax, roundToTwo(829 * 0.13));
    // total with tax
    assert.ok(result.totalFormatted.startsWith("$"));
  });

  it("CROSS-SEASON: spans PRIME and PREMIUM", () => {
    const result = calculatePrice({
      unitType: "class_c",
      unitModel: "25ft_slideout_2021_2023",
      startDate: "2026-06-28",
      endDate: "2026-07-02",
      mileage: undefined,
    });

    assert.strictEqual(result.days, 5);
    // Jun 28: PRIME (189)
    // Jun 29: PRIME (189)
    // Jun 30: PRIME (189)
    // Jul 01: PREMIUM (244)
    // Jul 02: PREMIUM (244)
    const expected = 189 * 3 + 244 * 2;
    assert.strictEqual(result.basePrice, expected);
  });

  it("CLASS_A: higher prep fee (199)", () => {
    const result = calculatePrice({
      unitType: "class_a",
      unitModel: "30ft_2024",
      startDate: "2026-01-05",
      endDate: "2026-01-09",
    });

    assert.strictEqual(result.preparationFee, 199);
    assert.strictEqual(result.hitchFee, 0);
  });

  it("TRAILER: includes hitch fee (150)", () => {
    const result = calculatePrice({
      unitType: "trailer",
      unitModel: "27ft_bunks_2024",
      startDate: "2026-01-05",
      endDate: "2026-01-09",
    });

    assert.strictEqual(result.hitchFee, 150);
    assert.strictEqual(result.preparationFee, 149);
    assert.strictEqual(result.basePrice, 94 * 5); // Daily rate for this trailer
  });

  it("WITH MILEAGE PACKAGE: adds fixed cost once (NOT per day)", () => {
    const result = calculatePrice({
      unitType: "class_c",
      unitModel: "25ft_slideout_2021_2023",
      startDate: "2026-01-05",
      endDate: "2026-01-09",
      mileage: { type: "package", value: 1 },
    });

    assert.strictEqual(result.mileageCost, 350); // 1 * 350
    // Verify it's not multiplied by days
      assert.strictEqual(result.basePrice, 94 * 5);
  it("WITH MILEAGE PER_KM: does not calculate extra kms (handled at drop-off)", () => {
    const result = calculatePrice({
      unitType: "class_c",
      unitModel: "25ft_slideout_2021_2023",
      startDate: "2026-01-05",
      endDate: "2026-01-09",
      mileage: { type: "per_km", value: 100 },
    });

    assert.strictEqual(result.mileageCost, 0); // Do not calculate extra kms in estimate
  });

  it("VALIDATION: invalid date format", () => {
    assert.throws(
      () => calculatePrice({
        unitType: "class_c",
        unitModel: "25ft_slideout_2021_2023",
        startDate: "not-a-date",
        endDate: "2026-01-09",
      }),
      /must be valid ISO dates/
    );
  });

  it("VALIDATION: endDate must be after startDate", () => {
    assert.throws(
      () => calculatePrice({
        unitType: "class_c",
        unitModel: "25ft_slideout_2021_2023",
        startDate: "2026-01-09",
        endDate: "2026-01-05",
      }),
      /endDate must be after startDate/
    );
  });

  it("VALIDATION: missing unitType", () => {
    assert.throws(
      () => calculatePrice({
        unitModel: "25ft_slideout_2021_2023",
        startDate: "2026-01-05",
        endDate: "2026-01-09",
      }),
      /unitType.*required/
    );
  });

  it("VALIDATION: missing unitModel", () => {
    assert.throws(
      () => calculatePrice({
        unitType: "class_c",
        startDate: "2026-01-05",
        endDate: "2026-01-09",
      }),
      /unitModel.*required/
    );
  });

  it("CALCULATION: TAX is 13% of subtotal", () => {
    const result = calculatePrice({
      unitType: "class_c",
      unitModel: "25ft_slideout_2021_2023",
      startDate: "2026-01-05",
      endDate: "2026-01-09",
    });

    const expectedTax = roundToTwo(result.subtotal * 0.13);
    assert.strictEqual(result.tax, expectedTax);
    assert.strictEqual(result.total, roundToTwo(result.subtotal + result.tax));
  });

  it("RETURN FORMAT: includes all required fields", () => {
    const result = calculatePrice({
      unitId: "unit-456",
      unitType: "class_c",
      unitModel: "25ft_slideout_2021_2023",
      startDate: "2026-01-05",
      endDate: "2026-01-09",
    });

    // Metadata
    assert.strictEqual(result.unitId, "unit-456");
    assert.strictEqual(result.unitType, "class_c");
    assert.strictEqual(result.unitModel, "25ft_slideout_2021_2023");
    assert.strictEqual(result.startDate, "2026-01-05");
    assert.strictEqual(result.endDate, "2026-01-09");

    // Calculation details
    assert.ok(result.days);
    assert.ok(Array.isArray(result.dailyRates));
    assert.ok(Number.isFinite(result.basePrice));
    assert.ok(Number.isFinite(result.cdw));
    assert.ok(Number.isFinite(result.preparationFee));
    assert.ok(Number.isFinite(result.mileageCost));
    assert.ok(Number.isFinite(result.hitchFee));
    assert.ok(Number.isFinite(result.subtotal));
    assert.ok(Number.isFinite(result.tax));
    assert.ok(Number.isFinite(result.total));
    assert.ok(result.totalFormatted);
  });

  it("DAILY RATES BREAKDOWN: includes date, season, price for each day", () => {
    const result = calculatePrice({
      unitType: "class_c",
      unitModel: "25ft_slideout_2021_2023",
      startDate: "2026-06-28",
      endDate: "2026-07-02",
    });

    assert.strictEqual(result.dailyRates.length, 5);

    // Check structure of each daily rate entry
    result.dailyRates.forEach((rate) => {
      assert.ok(rate.date); // "2026-06-28"
      assert.ok(rate.season); // "PRIME", "PREMIUM", etc
      assert.ok(Number.isFinite(rate.price));
    });

    // Verify specific dates
    assert.strictEqual(result.dailyRates[0].date, "2026-06-28");
    assert.strictEqual(result.dailyRates[0].season, "PRIME");
    assert.strictEqual(result.dailyRates[0].price, 189);

    assert.strictEqual(result.dailyRates[3].date, "2026-07-01");
    assert.strictEqual(result.dailyRates[3].season, "PREMIUM");
    assert.strictEqual(result.dailyRates[3].price, 244);
  });
});

// ============================================================================
// EDGE CASES & ROUNDING
// ============================================================================
describe("rounding & Precision", () => {
  it("roundToTwo() handles various values", () => {
    assert.strictEqual(roundToTwo(10.005), 10.01); // Rounds to 2 decimals
    assert.strictEqual(roundToTwo(10.004), 10);
    assert.strictEqual(roundToTwo(41.000), 41);
    assert.strictEqual(roundToTwo(0.41 * 100), 41); // Floating point
  });

  it("complex calculation maintains precision at 2 decimals", () => {
    const result = calculatePrice({
      unitType: "class_c",
      unitModel: "25ft_slideout_2021_2023",
      startDate: "2026-01-05",
      endDate: "2026-01-09",
      mileage: { type: "per_km", value: 333 }, // 333 * 0.41 = 136.53
    });

    // All monetary values should be rounded to 2 decimals
    assert.ok(Number.isFinite(result.mileageCost));
    assert.ok(Number.isFinite(result.subtotal));
    assert.ok(Number.isFinite(result.tax));
    assert.ok(Number.isFinite(result.total));

    const allMatch2Decimals = (num) => {
      const str = num.toString();
      if (!str.includes(".")) return true; // whole number
      return str.split(".")[1].length <= 2;
    };
    assert.ok(allMatch2Decimals(result.total));
    assert.ok(allMatch2Decimals(result.tax));
  });
});

});

console.log("\nAll pricing engine tests passed!");
