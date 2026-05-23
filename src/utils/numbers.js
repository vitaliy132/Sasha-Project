const toFiniteNumber = (value, defaultValue = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : defaultValue;
};

const toNonNegativeNumber = (value, defaultValue = 0) => {
  const n = toFiniteNumber(value, defaultValue);
  return n < 0 ? defaultValue : n;
};

const toNonNegativeInteger = (value, defaultValue = 0) => {
  const n = Math.trunc(toFiniteNumber(value, defaultValue));
  if (!Number.isFinite(n) || n < 0) return defaultValue;
  return n;
};

/** @param {unknown} value @param {number} [fallback] */
function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

module.exports = {
  toFiniteNumber,
  toNonNegativeNumber,
  toNonNegativeInteger,
  num,
};
