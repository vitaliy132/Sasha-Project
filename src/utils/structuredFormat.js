function titleizeKey(key) {
  return String(key)
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatStructuredValue(value, options = {}) {
  const {
    key = "",
    currencyKeys = null,
    formatCurrency = null,
    formatBool = null,
    labelMap = {},
  } = options;
  const boolFmt = formatBool || ((v) => (v ? "Yes" : "No"));

  if (value == null) return "";
  if (typeof value === "boolean") return boolFmt(value);
  if (typeof value === "number" && currencyKeys?.has(key) && formatCurrency) {
    return formatCurrency(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => formatStructuredValue(item, { ...options, key: "" })).join(", ");
  }
  if (typeof value === "object") {
    return formatObjectLines(value, labelMap, options).join("\n");
  }
  return String(value).trim();
}

function formatObjectLines(payload, labelMap = {}, options = {}) {
  return Object.entries(payload || {})
    .map(([key, value]) => {
      const formatted = formatStructuredValue(value, { ...options, key, labelMap });
      if (!formatted) return null;
      return `${labelMap[key] || titleizeKey(key)}: ${formatted}`;
    })
    .filter(Boolean);
}

function formatObjectBlock(payload, emptyText = "(none provided)", options = {}) {
  const lines = formatObjectLines(payload, {}, options);
  return lines.length ? lines.join("\n") : emptyText;
}

module.exports = {
  titleizeKey,
  formatStructuredValue,
  formatObjectLines,
  formatObjectBlock,
};
