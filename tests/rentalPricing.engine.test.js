/**
 * Pricing engine: seasons, models, add-ons, caps.
 * Run: npm test
 */
const { describe, it } = require("node:test");
const assert = require("node:assert");
const { parseISO } = require("date-fns");

const { getSeason } = require("../src/utils/pricingUtils.js");
const {
  calculateRentalQuote,
  calendarRentalDays,
} = require("../src/services/rentalQuote.js");

describe("getSeason()", () => {
  it("detects PREMIUM in peak summer", () => {
    assert.strictEqual(getSeason(parseISO("2026-07-15")), "PREMIUM");
  });

  it("detects PRIME in late June and September", () => {
    assert.strictEqual(getSeason(parseISO("2026-06-20")), "PRIME");
    assert.strictEqual(getSeason(parseISO("2026-09-15")), "PRIME");
  });

  it("detects SHOULDER in late May and early October", () => {
    assert.strictEqual(getSeason(parseISO("2026-05-20")), "SHOULDER");
    assert.strictEqual(getSeason(parseISO("2026-10-10")), "SHOULDER");
  });

  it("detects ECONOMY in winter (Oct 26–May 14 wrap)", () => {
    assert.strictEqual(getSeason(parseISO("2026-01-10")), "ECONOMY");
    assert.strictEqual(getSeason(parseISO("2026-11-01")), "ECONOMY");
    assert.strictEqual(getSeason(parseISO("2026-05-10")), "ECONOMY");
  });
});

describe("Cross-season daily total", () => {
  it("sums different season rates across one rental", () => {
    const q = calculateRentalQuote({
      startDate: "2026-06-28",
      endDate: "2026-07-02",
      vehicleType: "classC",
      vehicleModel: "25ft_slideout_2020_2021",
      kmPackages: 0,
      extraKm: 0,
      generatorHours: 0,
      cancellationWaiver: false,
      windshieldCoverage: false,
      generatorDailyUnlimited: false,
    });
    const days = calendarRentalDays(parseISO("2026-06-28"), parseISO("2026-07-02"));
    assert.strictEqual(days, 4);
    assert.strictEqual(getSeason(parseISO("2026-06-28")), "PRIME");
    assert.strictEqual(getSeason(parseISO("2026-06-29")), "PRIME");
    assert.strictEqual(getSeason(parseISO("2026-06-30")), "PRIME");
    assert.strictEqual(getSeason(parseISO("2026-07-01")), "PREMIUM");
    const expected = 189 * 3 + 244 * 2;
    assert.strictEqual(q.breakdown.dailyRateTotal, expected);
  });
});

describe("Trailer vs Class A pricing", () => {
  it("applies trailer hitch and trailer daily table", () => {
    const q = calculateRentalQuote({
      startDate: "2026-01-05",
      endDate: "2026-01-09",
      vehicleType: "trailer",
      vehicleModel: "27ft_bunks_2024_2026",
      kmPackages: 0,
      extraKm: 0,
      generatorHours: 0,
      cancellationWaiver: false,
      windshieldCoverage: false,
      generatorDailyUnlimited: false,
    });
    assert.strictEqual(q.breakdown.hitch, 150);
    assert.strictEqual(q.breakdown.dailyRateTotal, 94 * 5);
  });

  it("does not charge trailer hitch when customer has own hitch", () => {
    const q = calculateRentalQuote({
      startDate: "2026-01-05",
      endDate: "2026-01-09",
      vehicleType: "trailer",
      vehicleModel: "27ft_bunks_2024_2026",
      kmPackages: 0,
      extraKm: 0,
      generatorHours: 0,
      cancellationWaiver: false,
      windshieldCoverage: false,
      generatorDailyUnlimited: false,
      hasOwnHitch: true,
    });

    assert.strictEqual(q.breakdown.hitch, 0);
  });

  it("charges bike rack only when selected", () => {
    const q = calculateRentalQuote({
      startDate: "2026-01-05",
      endDate: "2026-01-09",
      vehicleType: "classC",
      vehicleModel: "25ft_slideout_2020_2021",
      kmPackages: 0,
      extraKm: 0,
      generatorHours: 0,
      cancellationWaiver: false,
      windshieldCoverage: false,
      generatorDailyUnlimited: false,
      bikeRack: true,
    });

    assert.strictEqual(q.breakdown.bikeRack, 50);
  });

  it("applies winterization fee for dates within the winter range", () => {
    const q = calculateRentalQuote({
      startDate: "2026-10-15",
      endDate: "2026-10-20",
      vehicleType: "classA",
      vehicleModel: "30ft_2026",
      kmPackages: 0,
      extraKm: 0,
      generatorHours: 0,
      cancellationWaiver: false,
      windshieldCoverage: false,
      generatorDailyUnlimited: false,
    });

    assert.strictEqual(q.breakdown.winterization, 199.95);
  });

  it("uses Class A prep and Class A model rates", () => {
    const q = calculateRentalQuote({
      startDate: "2026-01-05",
      endDate: "2026-01-09",
      vehicleType: "classA",
      vehicleModel: "30ft_2026",
      kmPackages: 0,
      extraKm: 0,
      generatorHours: 0,
      cancellationWaiver: false,
      windshieldCoverage: false,
      generatorDailyUnlimited: false,
    });
    assert.strictEqual(q.breakdown.prepFee, 199);
    assert.strictEqual(q.breakdown.dailyRateTotal, 119 * 5);
  });
});

describe("CDW minimum vs per-day", () => {
  it("3 days hits CDW minimum 210", () => {
    const q = calculateRentalQuote({
      startDate: "2026-01-01",
      endDate: "2026-01-03",
      vehicleType: "classC",
      vehicleModel: "25ft_slideout_2020_2021",
      kmPackages: 0,
      extraKm: 0,
      generatorHours: 0,
      cancellationWaiver: false,
      windshieldCoverage: false,
      generatorDailyUnlimited: false,
    });
    assert.strictEqual(q.breakdown.cdw, 210);
  });

  it("12 days exceeds CDW minimum", () => {
    const q = calculateRentalQuote({
      startDate: "2026-01-01",
      endDate: "2026-01-12",
      vehicleType: "classC",
      vehicleModel: "25ft_slideout_2020_2021",
      kmPackages: 0,
      extraKm: 0,
      generatorHours: 0,
      cancellationWaiver: false,
      windshieldCoverage: false,
      generatorDailyUnlimited: false,
    });
    assert.strictEqual(q.breakdown.cdw, 11 * 30);
  });
});

describe("Cancellation waiver caps", () => {
  it("short rental hits $240 minimum", () => {
    const q = calculateRentalQuote({
      startDate: "2026-01-01",
      endDate: "2026-01-03",
      vehicleType: "classC",
      vehicleModel: "25ft_slideout_2020_2021",
      kmPackages: 0,
      extraKm: 0,
      generatorHours: 0,
      cancellationWaiver: true,
      windshieldCoverage: false,
      generatorDailyUnlimited: false,
    });
    assert.strictEqual(q.breakdown.cancellationWaiver, 240);
  });

  it("long rental uses per-day beyond minimum", () => {
    const q = calculateRentalQuote({
      startDate: "2026-01-01",
      endDate: "2026-01-20",
      vehicleType: "classC",
      vehicleModel: "25ft_slideout_2020_2021",
      kmPackages: 0,
      extraKm: 0,
      generatorHours: 0,
      cancellationWaiver: true,
      windshieldCoverage: false,
      generatorDailyUnlimited: false,
    });
    assert.strictEqual(q.breakdown.cancellationWaiver, 19 * 20);
  });
});

describe("Windshield coverage caps", () => {
  it("Class A: min $250 when raw under 250", () => {
    const q = calculateRentalQuote({
      startDate: "2026-01-01",
      endDate: "2026-01-05",
      vehicleType: "classA",
      vehicleModel: "30ft_2026",
      kmPackages: 0,
      extraKm: 0,
      generatorHours: 0,
      cancellationWaiver: false,
      windshieldCoverage: true,
      generatorDailyUnlimited: false,
    });
    assert.strictEqual(q.breakdown.days, 4);
    assert.strictEqual(q.breakdown.windshield, 250);
  });

  it("Class A: caps at $1000", () => {
    const q = calculateRentalQuote({
      startDate: "2026-01-01",
      endDate: "2026-02-15",
      vehicleType: "classA",
      vehicleModel: "30ft_2026",
      kmPackages: 0,
      extraKm: 0,
      generatorHours: 0,
      cancellationWaiver: false,
      windshieldCoverage: true,
      generatorDailyUnlimited: false,
    });
    const d = q.breakdown.days;
    assert.ok(d * 35 > 1000);
    assert.strictEqual(q.breakdown.windshield, 1000);
  });

  it("Class B (non–Class-A tier): windshield caps at $450", () => {
    const q = calculateRentalQuote({
      startDate: "2026-01-01",
      endDate: "2026-02-15",
      vehicleType: "classB",
      vehicleModel: "23ft_2021_2026",
      kmPackages: 0,
      extraKm: 0,
      generatorHours: 0,
      cancellationWaiver: false,
      windshieldCoverage: true,
      generatorDailyUnlimited: false,
    });
    assert.strictEqual(q.breakdown.windshield, 450);
  });
});

describe("Generator: hourly vs daily unlimited", () => {
  it("hourly rate $5/hour", () => {
    const q = calculateRentalQuote({
      startDate: "2026-01-01",
      endDate: "2026-01-05",
      vehicleType: "classC",
      vehicleModel: "25ft_slideout_2020_2021",
      kmPackages: 0,
      extraKm: 0,
      generatorHours: 10,
      cancellationWaiver: false,
      windshieldCoverage: false,
      generatorDailyUnlimited: false,
    });
    assert.strictEqual(q.breakdown.generator, 50);
  });

  it("daily unlimited uses $60 × billed daily days (min 5)", () => {
    const q = calculateRentalQuote({
      startDate: "2026-01-01",
      endDate: "2026-01-03",
      vehicleType: "classC",
      vehicleModel: "25ft_slideout_2020_2021",
      kmPackages: 0,
      extraKm: 0,
      generatorHours: 999,
      cancellationWaiver: false,
      windshieldCoverage: false,
      generatorDailyUnlimited: true,
    });
    assert.strictEqual(q.breakdown.generator, 60 * 5);
  });
});

describe("Prepaid mileage packages (PDF: $39 / 100 km, $350 / 1,000 km)", () => {
  it("charges $39 per 100 km package", () => {
    const q = calculateRentalQuote({
      startDate: "2026-01-01",
      endDate: "2026-01-05",
      vehicleType: "classA",
      vehicleModel: "30ft_2026",
      kmPackages: 0,
      kmPackages100: 2,
      extraKm: 0,
      generatorHours: 0,
      cancellationWaiver: false,
      windshieldCoverage: false,
      generatorDailyUnlimited: false,
    });
    assert.strictEqual(q.breakdown.kmPackages, 78);
  });

  it("combines 100 km and 1,000 km package counts", () => {
    const q = calculateRentalQuote({
      startDate: "2026-01-01",
      endDate: "2026-01-05",
      vehicleType: "classA",
      vehicleModel: "30ft_2026",
      kmPackages: 1,
      kmPackages100: 3,
      extraKm: 0,
      generatorHours: 0,
      cancellationWaiver: false,
      windshieldCoverage: false,
      generatorDailyUnlimited: false,
    });
    assert.strictEqual(q.breakdown.kmPackages, 3 * 39 + 350);
  });
});

describe("Unknown model / type", () => {
  it("throws 400 for unknown model", () => {
    assert.throws(
      () =>
        calculateRentalQuote({
          startDate: "2026-01-01",
          endDate: "2026-01-05",
          vehicleType: "classB",
          vehicleModel: "does_not_exist",
          kmPackages: 0,
          extraKm: 0,
          generatorHours: 0,
          cancellationWaiver: false,
          windshieldCoverage: false,
          generatorDailyUnlimited: false,
        }),
      /Unknown vehicle model/,
    );
  });
});
