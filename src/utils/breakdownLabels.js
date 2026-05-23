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

module.exports = {
  BREAKDOWN_LABELS,
  CURRENCY_BREAKDOWN_KEYS,
};
