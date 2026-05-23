/** Labels for rental options API and catalog. */
const VEHICLE_TYPE_LABEL = {
  classA: "Class A",
  classB: "Class B+ Mercedes",
  classC: "Class C",
  trailer: "Travel Trailer",
};

/** Short labels for CRM emails (matches rental calculator UI). */
const VEHICLE_TYPE_SHORT = {
  classA: "Class A",
  classB: "Class B+ Mercedes",
  classC: "Class C",
  trailer: "Travel trailer",
};

function shortVehicleTypeLabel(vehicleType) {
  if (!vehicleType) return "";
  return VEHICLE_TYPE_SHORT[vehicleType] || vehicleType;
}

module.exports = {
  VEHICLE_TYPE_LABEL,
  VEHICLE_TYPE_SHORT,
  shortVehicleTypeLabel,
};
