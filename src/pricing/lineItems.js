const { formatCurrency } = require("../utils/pricingUtils");

const buildLineItems = (b) => {
  const items = [
    { name: "Daily Rental", value: b.dailyRateTotal },
    { name: "CDW", value: b.cdw },
    { name: "Prep Fee", value: b.prepFee },
    { name: "KM Packages", value: b.kmPackages },
  ];

  if (b.bikeRack > 0) {
    items.push({ name: "Bike Rack", value: b.bikeRack });
  }

  items.push({ name: "Hitch", value: b.hitch });

  if (b.winterization > 0) {
    items.push({ name: "Winterization", value: b.winterization });
  }

  items.push(
    { name: "Extra KM", value: b.extraKm },
    { name: "Generator", value: b.generator },
    { name: "Cancellation Waiver", value: b.cancellationWaiver },
    { name: "Windshield Coverage", value: b.windshield },
    { name: "Kitchen Kit", value: b.kitchenKit },
    { name: "Bedding Kit", value: b.beddingKit },
    { name: "Tax", value: b.tax },
  );

  return items;
};

const buildSummaryMessage = ({ total, vehicleType }) => {
  const intro = `Your estimated total for this rental is ${formatCurrency(total)}. As indicated below, this includes the daily rental rate, preparation fee, kilometer packages where applicable, taxes, a full tank of propane, CDW Plus (Collision Damage Waiver), and a full demonstration of the vehicle.`;
  const trailerNote =
    vehicleType === "trailer"
      ? " Please note: You must have a properly rated tow vehicle with hitch receiver, brake controller, and electrical adaptor installed."
      : "";
  const deposits =
    " A $3000 security deposit is required on all rentals. An additional $1000 awning deposit applies if awning use is selected.";
  return `${intro}${trailerNote}${deposits}`;
};

module.exports = {
  buildLineItems,
  buildSummaryMessage,
};
