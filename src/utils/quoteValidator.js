/**
 * Quote validation utilities
 */

/**
 * Validate that a quote string is in proper currency format
 * Accepts formats like: $100, $1,234, $1,234.56, $0.99
 */
function isValidCurrencyFormat(quoteStr) {
  if (!quoteStr || typeof quoteStr !== 'string') return false;
  
  const trimmed = quoteStr.trim();
  
  // Must start with $
  if (!trimmed.startsWith('$')) return false;
  
  const numeric = trimmed.slice(1); // Remove $
  
  // Must have at least one digit
  if (!numeric.match(/\d/)) return false;
  
  // Reject if contains invalid characters (besides digits, commas, and one decimal point)
  if (!/^[\d,.]+$/.test(numeric)) return false;
  
  // Check comma placement is correct (groups of 3)
  const parts = numeric.split('.');
  const integerPart = parts[0];
  
  // Check decimal part if present
  if (parts.length > 2) {
    return false; // More than one decimal point
  }
  
  if (parts.length === 2 && parts[1].length !== 2) {
    return false; // Decimal part must be exactly 2 digits (cents)
  }
  
  // Validate comma placement in integer part
  if (integerPart.length > 3) {
    const withoutCommas = integerPart.replace(/,/g, '');
    
    // Reconstruct expected format with commas
    let expectedFormat = '';
    for (let i = withoutCommas.length - 1, count = 0; i >= 0; i--, count++) {
      if (count > 0 && count % 3 === 0) {
        expectedFormat = ',' + expectedFormat;
      }
      expectedFormat = withoutCommas[i] + expectedFormat;
    }
    
    if (integerPart !== expectedFormat) {
      return false;
    }
  }
  
  return true;
}

/**
 * Extract numeric value from currency string
 * Returns null if format is invalid
 */
function parseCurrencyValue(quoteStr) {
  if (!isValidCurrencyFormat(quoteStr)) return null;
  
  const numeric = quoteStr.slice(1).replace(/,/g, '');
  const value = parseFloat(numeric);
  
  return Number.isFinite(value) ? value : null;
}

module.exports = {
  isValidCurrencyFormat,
  parseCurrencyValue,
};
