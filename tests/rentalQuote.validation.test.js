/**
 * Inline validation cases for the rental pricing engine.
 * Run: npm run rental:validate
 */
const assert = require("node:assert");
const { calculateRentalQuote } = require("../src/pricing/engine");

function runRentalQuoteValidationTests(options = {}) {
  const { silent = false, strict = true } = options;
  const log = silent ? () => {} : (...args) => console.log(...args);

  const run = (title, fn) => {
    log(`\n========== ${title} ==========`);
    try {
      fn(log);
      log("PASS");
    } catch (e) {
      log("FAIL", e.message);
      if (strict) throw e;
    }
  };

  const base = (over) => ({
    vehicleType: "classC",
    vehicleModel: "25ft_slideout_2020_2021",
    kmPackages: 0,
    kmPackages100: 0,
    extraKm: 0,
    generatorHours: 0,
    cancellationWaiver: false,
    windshieldCoverage: false,
    generatorDailyUnlimited: false,
    ...over,
  });

  run("CASE 1: 3 calendar days, CDW on, Class C shoulder daily min 5 days", (lg) => {
    const q = calculateRentalQuote(
      base({
        startDate: "2026-01-01",
        endDate: "2026-01-03",
      }),
    );
    lg(JSON.stringify(q.breakdown, null, 2));
    assert.strictEqual(q.breakdown.days, 3);
    assert.strictEqual(q.breakdown.cdw, 210);
    assert.strictEqual(q.breakdown.dailyRateTotal, 94 * 5);
  });

  run("CASE 2: 7 days in July (PREMIUM season), Class A 30ft", (lg) => {
    const q = calculateRentalQuote(
      base({
        startDate: "2026-07-01",
        endDate: "2026-07-07",
        vehicleType: "classA",
        vehicleModel: "30ft_2026",
      }),
    );
    lg(JSON.stringify(q.breakdown, null, 2));
    assert.strictEqual(q.breakdown.days, 7);
    assert.strictEqual(q.breakdown.cdw, 210);
    assert.strictEqual(q.breakdown.dailyRateTotal, 289 * 7);
  });

  run("CASE 3: Trailer + hitch 150", (lg) => {
    const q = calculateRentalQuote({
      startDate: "2026-06-15",
      endDate: "2026-06-19",
      vehicleType: "trailer",
      vehicleModel: "19ft_2023_2026",
      kmPackages: 0,
      extraKm: 0,
      generatorHours: 0,
      cancellationWaiver: false,
      windshieldCoverage: false,
      generatorDailyUnlimited: false,
    });
    lg(JSON.stringify(q.breakdown, null, 2));
    assert.strictEqual(q.breakdown.hitch, 150);
  });

  run("CASE 3.5: Trailer with extraKm should not charge", (lg) => {
    const q = calculateRentalQuote({
      startDate: "2026-06-15",
      endDate: "2026-06-19",
      vehicleType: "trailer",
      vehicleModel: "19ft_2023_2026",
      kmPackages: 0,
      extraKm: 100,
      generatorHours: 0,
      cancellationWaiver: false,
      windshieldCoverage: false,
      generatorDailyUnlimited: false,
    });
    lg(JSON.stringify(q.breakdown, null, 2));
    assert.strictEqual(q.breakdown.extraKm, 0);
  });

  run("CASE 4: Large extraKm + hourly generator", (lg) => {
    const q = calculateRentalQuote(
      base({
        startDate: "2026-01-01",
        endDate: "2026-01-05",
        extraKm: 10000,
        generatorHours: 100,
      }),
    );
    lg(JSON.stringify(q.breakdown, null, 2));
    assert.strictEqual(q.breakdown.extraKm, 4100);
    assert.strictEqual(q.breakdown.generator, 500);
  });

  run("CASE 5: Invalid numerics default safely", (lg) => {
    const q = calculateRentalQuote(
      base({
        startDate: "2026-02-01",
        endDate: "2026-02-07",
        kmPackages: null,
        kmPackages100: null,
        extraKm: "",
        generatorHours: undefined,
      }),
    );
    lg(JSON.stringify(q.breakdown, null, 2));
    assert.strictEqual(q.breakdown.kmPackages, 0);
    assert.strictEqual(q.breakdown.extraKm, 0);
    assert.strictEqual(q.breakdown.generator, 0);
  });

  if (!silent) {
    log("\nAll rental quote validation cases completed.");
  }
}

module.exports = { runRentalQuoteValidationTests };

if (require.main === module) {
  runRentalQuoteValidationTests();
}
