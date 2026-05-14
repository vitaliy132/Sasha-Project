/**
 * Validates daily rental tables and season boundaries against operator rate sheet.
 * Run: npm test
 */
const { describe, it } = require("node:test");
const assert = require("node:assert");
const { parseISO } = require("date-fns");

const { getSeason, getRentalOptions, calculateRentalQuote, PRICING } = require("../src/services/rentalQuote.js");

/** Operator matrix (internal keys). */
const PDF_DAILY_RATES = {
  classA: {
    "30ft_2024": { PREMIUM: 289, PRIME: 234, SHOULDER: 154, ECONOMY: 119 },
    "32ft_2017": { PREMIUM: 289, PRIME: 234, SHOULDER: 154, ECONOMY: 119 },
    "34ft_2023": { PREMIUM: 314, PRIME: 259, SHOULDER: 179, ECONOMY: 144 },
    "35_36ft_slideout_bunks_2025": { PREMIUM: 314, PRIME: 259, SHOULDER: 179, ECONOMY: 144 },
  },
  classC: {
    "31ft_slideout_bunks_2019": { PREMIUM: 264, PRIME: 209, SHOULDER: 129, ECONOMY: 99 },
    "25ft_slideout_2021_2023": { PREMIUM: 244, PRIME: 189, SHOULDER: 119, ECONOMY: 94 },
    "25ft_slideout_2018_economy": { PREMIUM: 214, PRIME: 159, SHOULDER: 99, ECONOMY: 94 },
    "23ft_2020_2026": { PREMIUM: 224, PRIME: 174, SHOULDER: 109, ECONOMY: 84 },
  },
  classB: {
    "23ft_2021_2023": { PREMIUM: 244, PRIME: 189, SHOULDER: 119, ECONOMY: 94 },
  },
  trailer: {
    "19ft_2023": { PREMIUM: 174, PRIME: 134, SHOULDER: 89, ECONOMY: 84 },
    "27ft_bunks_2024": { PREMIUM: 199, PRIME: 149, SHOULDER: 99, ECONOMY: 94 },
  },
};

describe("PDF daily rate tables (config vs PDF)", () => {
  for (const [vehicleType, models] of Object.entries(PDF_DAILY_RATES)) {
    for (const [modelKey, seasons] of Object.entries(models)) {
      it(`${vehicleType} / ${modelKey} matches PDF`, () => {
        const row = PRICING[vehicleType][modelKey];
        assert.ok(row, `Missing pricing row ${vehicleType}.${modelKey}`);
        for (const season of ["PREMIUM", "PRIME", "SHOULDER", "ECONOMY"]) {
          assert.strictEqual(
            row[season],
            seasons[season],
            `${vehicleType}.${modelKey}.${season}`,
          );
        }
      });
    }
  }

  it("contains exactly the approved vehicle pricing rows", () => {
    assert.deepStrictEqual(PRICING, PDF_DAILY_RATES);
  });
});

describe("Rental option labels", () => {
  it("lists exactly the approved vehicle models", () => {
    assert.deepStrictEqual(getRentalOptions().vehicleTypes, [
      {
        id: "classA",
        label: "Class A",
        defaultModel: "30ft_2024",
        models: [
          { id: "30ft_2024", label: "Class A - 30 with slide out - 2024" },
          { id: "32ft_2017", label: "Class A - 32 with slide out/bunks - Economy 2017" },
          { id: "34ft_2023", label: "Class A - 34 with slide out - 2023" },
          { id: "35_36ft_slideout_bunks_2025", label: "Class A - 35-36 with slide out/bunks" },
        ],
      },
      {
        id: "classB",
        label: "Class B",
        defaultModel: "23ft_2021_2023",
        models: [
          { id: "23ft_2021_2023", label: "Class B - 23 - 2021-2023" },
        ],
      },
      {
        id: "classC",
        label: "Class C",
        defaultModel: "25ft_slideout_2021_2023",
        models: [
          { id: "31ft_slideout_bunks_2019", label: "Class C - 31 with slide out/bunks - 2019" },
          { id: "25ft_slideout_2021_2023", label: "Class C - 25 with slide out - 2021-2023" },
          { id: "25ft_slideout_2018_economy", label: "Class C - 25 with slide out - Economy 2018" },
          { id: "23ft_2020_2026", label: "Class C - 23 - 2020-2026" },
        ],
      },
      {
        id: "trailer",
        label: "Travel Trailer",
        defaultModel: "19ft_2023",
        models: [
          { id: "19ft_2023", label: "Travel Trailer - 19 - 2023" },
          { id: "27ft_bunks_2024", label: "Travel Trailer - 27 + bunks - 2024" },
        ],
      },
    ]);
  });
});

describe("Season boundaries (MM-DD, inclusive ranges)", () => {
  const y = "2026";
  const cases = [
    ["05-14", "ECONOMY", "May 14 → ECONOMY"],
    ["05-15", "SHOULDER", "May 15 → SHOULDER"],
    ["06-10", "SHOULDER", "Jun 10 → SHOULDER"],
    ["06-11", "PRIME", "Jun 11 → PRIME"],
    ["06-30", "PRIME", "Jun 30 → PRIME"],
    ["07-01", "PREMIUM", "Jul 1 → PREMIUM"],
    ["08-31", "PREMIUM", "Aug 31 → PREMIUM"],
    ["09-01", "PRIME", "Sep 1 → PRIME"],
    ["09-30", "PRIME", "Sep 30 → PRIME"],
    ["10-01", "SHOULDER", "Oct 1 → SHOULDER"],
    ["10-25", "SHOULDER", "Oct 25 → SHOULDER"],
    ["10-26", "ECONOMY", "Oct 26 → ECONOMY"],
  ];

  for (const [mmdd, expected, label] of cases) {
    it(label, () => {
      assert.strictEqual(getSeason(parseISO(`${y}-${mmdd}`)), expected);
    });
  }
});

describe("Multi-day totals & season spans", () => {
  it("sums PRIME + PREMIUM when rental crosses Jul 1 (Class C 25ft)", () => {
    const q = calculateRentalQuote({
      startDate: "2026-06-28",
      endDate: "2026-07-02",
      vehicleType: "classC",
      vehicleModel: "25ft_slideout_2021_2023",
      kmPackages: 0,
      extraKm: 0,
      generatorHours: 0,
      cancellationWaiver: false,
      windshieldCoverage: false,
      generatorDailyUnlimited: false,
    });
    const expected = 189 * 3 + 244 * 2;
    assert.strictEqual(q.breakdown.dailyRateTotal, expected);
  });

  it("Class C 23ft differs from Class B 23ft in PREMIUM", () => {
    const c = calculateRentalQuote({
      startDate: "2026-07-01",
      endDate: "2026-07-05",
      vehicleType: "classC",
      vehicleModel: "23ft_2020_2026",
      kmPackages: 0,
      extraKm: 0,
      generatorHours: 0,
      cancellationWaiver: false,
      windshieldCoverage: false,
      generatorDailyUnlimited: false,
    });
    const b = calculateRentalQuote({
      startDate: "2026-07-01",
      endDate: "2026-07-05",
      vehicleType: "classB",
      vehicleModel: "23ft_2021_2023",
      kmPackages: 0,
      extraKm: 0,
      generatorHours: 0,
      cancellationWaiver: false,
      windshieldCoverage: false,
      generatorDailyUnlimited: false,
    });
    assert.strictEqual(c.breakdown.dailyRateTotal, 224 * 5);
    assert.strictEqual(b.breakdown.dailyRateTotal, 244 * 5);
    assert.strictEqual(c.breakdown.prepFee, 149);
    assert.strictEqual(b.breakdown.prepFee, 149);
  });
});

describe("Class C models resolve under classC", () => {
  it("accepts classC + 25ft_slideout_2021_2023 (economy winter)", () => {
    const q = calculateRentalQuote({
      startDate: "2026-01-01",
      endDate: "2026-01-05",
      vehicleType: "classC",
      vehicleModel: "25ft_slideout_2021_2023",
      kmPackages: 0,
      extraKm: 0,
      generatorHours: 0,
      cancellationWaiver: false,
      windshieldCoverage: false,
      generatorDailyUnlimited: false,
    });
    assert.strictEqual(q.breakdown.dailyRateTotal, 94 * 5);
  });
});
