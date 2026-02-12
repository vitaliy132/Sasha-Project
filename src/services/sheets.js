// Google Sheets service
// Appends validated and unvalidated leads to Google Sheets
const { GoogleAuth } = require("google-auth-library");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const logger = require("../utils/logger");

const REQUIRED_SHEET_ENV = [
  "GOOGLE_SHEET_ID",
  "GOOGLE_PROJECT_ID",
  "GOOGLE_CLIENT_EMAIL",
  "GOOGLE_PRIVATE_KEY",
];

const hasEnv = (key) => !!process.env[key]?.trim();
const checkSheetEnv = () => REQUIRED_SHEET_ENV.every((key) => hasEnv(key));

// Parse private key - handle escaped newlines from .env
const parsePrivateKey = (key) => {
  if (!key) return key;
  return key.replace(/\\n/g, "\n");
};

/**
 * Append lead to Google Sheets with validation status
 * @param {Object} lead - Lead data object
 * @param {boolean} isValid - Whether lead passed validation
 */
exports.appendLeadToSheet = async (lead, isValid) => {
  if (!checkSheetEnv()) {
    logger.warn("Google Sheets env vars not configured, skipping sheet append");
    return;
  }

  try {
    const auth = new GoogleAuth({
      projectId: process.env.GOOGLE_PROJECT_ID,
      credentials: {
        type: "service_account",
        project_id: process.env.GOOGLE_PROJECT_ID,
        private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID || "",
        private_key: parsePrivateKey(process.env.GOOGLE_PRIVATE_KEY),
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);

    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0]; // First sheet

    // Append lead with validation status (only required fields)
    await sheet.addRow({
      first_name: lead.first_name || "",
      last_name: lead.last_name || "",
      email: lead.email || "",
      phone: lead.phone || "",
      validated: isValid ? "yes" : "no",
    });

    logger.info(
      `Lead appended to sheet (validated: ${isValid ? "yes" : "no"}): ${lead.first_name} ${lead.last_name}`,
    );
  } catch (err) {
    logger.error("Google Sheets append error:", err.message || err);
    throw err;
  }
};

/**
 * Check if Google Sheets is properly configured
 */
exports.isSheetConfigured = () => checkSheetEnv();
