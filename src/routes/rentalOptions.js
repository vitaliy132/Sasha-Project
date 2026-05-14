const express = require("express");

const { getRentalOptions } = require("../services/rentalQuote");
const { HTTP_STATUS } = require("../utils/constants");

const router = express.Router();

router.get("/", (req, res) => {
  res.status(HTTP_STATUS.OK).json(getRentalOptions());
});

module.exports = router;
