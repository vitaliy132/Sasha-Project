const { HTTP_STATUS, MESSAGES } = require("../utils/constants");
const logger = require("../utils/logger");

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    logger.error("Unhandled error:", err.message || err);
    if (!res.headersSent) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: MESSAGES.SERVER_ERROR, message: "An unexpected error occurred" });
    }
  });
};

const validateWebhookSecret = (req, res, next) => {
  const secret = req.headers["x-webhook-secret"];
  if (secret !== process.env.WEBHOOK_SECRET) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).send(MESSAGES.UNAUTHORIZED);
  }
  next();
};

module.exports = { asyncHandler, validateWebhookSecret };