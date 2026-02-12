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

const parsePrivateKey = (key) => {
  if (!key) return key;
  return key.replace(/\\n/g, "\n");
};

const createAuth = () => {
  return new GoogleAuth({
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
};

const formatLeadRow = (lead, isValid) => ({
  first_name: lead.first_name || "",
  last_name: lead.last_name || "",
  email: lead.email || "",
  phone: lead.phone || "",
  validated: isValid ? "yes" : "no",
  sent_to_crm: "no",
});

exports.checkLeadExists = async (email) => {
  if (!checkSheetEnv()) {
    return null;
  }

  try {
    const auth = createAuth();
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);

    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();

    return rows.find((row) => row.get("email") === email) || null;
  } catch (err) {
    logger.error("Error checking for existing lead:", err.message || err);
    return null;
  }
};

exports.markLeadAsSentToCRM = async (email) => {
  if (!checkSheetEnv()) {
    return;
  }

  try {
    const auth = createAuth();
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);

    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();

    const row = rows.find((r) => r.get("email") === email);
    if (row) {
      row.assign({ sent_to_crm: "yes" });
      await row.save();
      logger.info(`Lead marked as sent to CRM: ${email}`);
    }
  } catch (err) {
    logger.error("Error marking lead as sent to CRM:", err.message || err);
  }
};

exports.appendLeadToSheet = async (lead, isValid) => {
  if (!checkSheetEnv()) {
    logger.warn("Google Sheets env vars not configured, skipping sheet append");
    return true;
  }

  try {
    const existingLead = await exports.checkLeadExists(lead.email);
    if (existingLead) {
      logger.warn(`Duplicate lead detected, skipping append: ${lead.email}`);
      return false;
    }

    const auth = createAuth();
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);

    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];

    await sheet.addRow(formatLeadRow(lead, isValid));
    logger.info(
      `Lead appended to sheet (validated: ${isValid ? "yes" : "no"}): ${lead.first_name} ${lead.last_name}`,
    );
    return true;
  } catch (err) {
    logger.error("Google Sheets append error:", err.message || err);
    throw err;
  }
};

exports.isSheetConfigured = () => checkSheetEnv();
