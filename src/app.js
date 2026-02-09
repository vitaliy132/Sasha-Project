// Main application entry point
require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");

const logger = require("./utils/logger");
const app = express();

const requiredEnv = ["WEBHOOK_SECRET", "SMTP_HOST", "SMTP_USER", "SMTP_PASS", "CRM_EMAIL"];
const missing = requiredEnv.filter((key) => !process.env[key]?.trim());
if (missing.length) {
  logger.error("Missing required env:", missing.join(", "));
  process.exit(1);
}

app.use(helmet());
app.use(cors());
app.use(morgan("combined"));
app.use(express.json());

app.get("/health", (req, res) => res.status(200).send("OK"));
app.use("/api/leads", require("./routes/leads"));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  logger.info("Lead service running on port", port);
});
