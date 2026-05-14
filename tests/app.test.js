/**
 * Tests for sasha-project API and env handling.
 * Run: npm test
 */
const http = require("node:http");
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");

// Set test env before requiring app (so startup doesn't exit)
process.env.NODE_ENV = "test";
process.env.WEBHOOK_SECRET = "test-secret";
process.env.SMTP_HOST = "smtp.test.com";
process.env.SMTP_USER = "test@test.com";
process.env.SMTP_PASS = "test-pass";
process.env.CRM_EMAIL = "crm@test.com";

const app = require("../src/app.js");
const schema = require("../src/validators/lead.schema.js");
const { formatLeadEmail } = require("../src/services/formatter.js");
const { runRentalQuoteValidationTests } = require("../src/services/rentalQuote.js");
const {
  DEFAULT_SENDGRID_FROM,
  resolveFromAddress,
  validateSendGridFrom,
} = require("../src/services/emailConfig.js");

let server;
let baseUrl;

describe("Env and config", () => {
  it("required env keys are set in test", () => {
    const required = ["WEBHOOK_SECRET", "SMTP_HOST", "SMTP_USER", "SMTP_PASS", "CRM_EMAIL"];
    required.forEach((key) => {
      assert.ok(process.env[key]?.trim(), `Missing env: ${key}`);
    });
  });

  it("defaults SendGrid sender to the configured default", () => {
    const from = resolveFromAddress({ SENDGRID_API_KEY: "SG.test" });

    assert.strictEqual(from, DEFAULT_SENDGRID_FROM);
    assert.strictEqual(from, "quote@rvvacations.com");
  });

  it("accepts custom SendGrid senders without a domain restriction", () => {
    const customError = validateSendGridFrom({
      SENDGRID_API_KEY: "SG.test",
      SENDGRID_FROM: "quote@rvvacations.com",
    });
    const alternateError = validateSendGridFrom({
      SENDGRID_API_KEY: "SG.test",
      SENDGRID_FROM: "old-sender@example.com",
    });

    assert.strictEqual(customError, null);
    assert.strictEqual(alternateError, null);
  });
});

describe("API", () => {
  before(() => {
    return new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, () => {
        baseUrl = "http://localhost:" + server.address().port;
        resolve();
      });
    });
  });

  after(() => {
    if (server) server.close();
  });

  describe("GET /", () => {
    it("returns JSON with status and links", async () => {
      const res = await fetch(baseUrl + "/");
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.status, "ok");
      assert.ok(body.activeEndpoints);
      assert.ok(body.debugEndpoints);
    });
  });

  describe("GET /health", () => {
    it("returns 200 OK", async () => {
      const res = await fetch(baseUrl + "/health");
      assert.strictEqual(res.status, 200);
      assert.strictEqual(await res.text(), "OK");
    });
  });

  describe("GET /rental-options", () => {
    it("returns vehicle choices without exposing rate tables", async () => {
      const res = await fetch(baseUrl + "/rental-options");
      assert.strictEqual(res.status, 200);
      const body = await res.json();

      assert.strictEqual(body.minimumRentalDays, 5);
      assert.ok(Array.isArray(body.vehicleTypes));
      assert.ok(body.vehicleTypes.length > 0);

      const classC = body.vehicleTypes.find((type) => type.id === "classC");
      assert.ok(classC);
      assert.strictEqual(classC.label, "Class C");
      assert.strictEqual(classC.defaultModel, "25ft_slideout_2021_2023");
      assert.ok(classC.models.some((model) => model.id === "25ft_slideout_2021_2023"));
      assert.strictEqual(classC.models.some((model) => "PREMIUM" in model), false);

      const classB = body.vehicleTypes.find((type) => type.id === "classB");
      assert.ok(classB);
      assert.deepStrictEqual(classB.models, [
        { id: "23ft_2021_2023", label: "Class B - 23 - 2021-2023" },
      ]);
    });
  });

  describe("GET /api/env-check", () => {
    it("returns env key presence without values", async () => {
      const res = await fetch(baseUrl + "/api/env-check");
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.ok, true);
      assert.ok(body.required.WEBHOOK_SECRET === true);
      assert.ok(body.required.CRM_EMAIL === true);
    });
  });

  describe("POST /calculate-rental", () => {
    it("returns a full quote breakdown", async () => {
      const res = await fetch(baseUrl + "/calculate-rental", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: "2026-01-01",
          endDate: "2026-01-05",
          vehicleType: "classC",
          vehicleModel: "25ft_slideout_2021_2023",
          kmPackages: 1,
          generatorHours: 2,
          extraKm: 10,
        }),
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.total, 1517.65);
      assert.strictEqual(body.totalFormatted, "$1517.65");
      assert.ok(body.summaryMessage.includes("Your estimated total for this rental is $1517.65."));
      assert.ok(body.summaryMessage.includes("CDW Plus"));
      assert.ok(body.summaryMessage.includes("A $3000 security deposit is required on all rentals."));
      assert.ok(body.summaryMessage.includes("An additional $1000 awning deposit applies if awning use is selected."));
      assert.strictEqual(body.breakdown.days, 5);
      assert.strictEqual(body.breakdown.dailyRateTotal, 470);
      assert.strictEqual(body.breakdown.cdw, 210);
      assert.strictEqual(body.breakdown.prepFee, 149);
      assert.strictEqual(body.breakdown.kmPackages, 350);
      assert.strictEqual(body.breakdown.hitch, 0);
      assert.strictEqual(body.breakdown.winterization, 149.95);
      assert.strictEqual(body.breakdown.extraKm, 4.1);
      assert.strictEqual(body.breakdown.generator, 10);
      assert.strictEqual(body.breakdown.cancellationWaiver, 0);
      assert.strictEqual(body.breakdown.windshield, 0);
      assert.strictEqual(body.breakdown.tax, 174.6);
      assert.strictEqual(body.lineItems.length, 13);
      assert.strictEqual(body.lineItems[0].name, "Daily Rental");
    });

    it("rejects rentals shorter than the minimum rental period", async () => {
      const res = await fetch(baseUrl + "/calculate-rental", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: "2026-07-01",
          endDate: "2026-07-03",
          vehicleType: "classA",
          vehicleModel: "30ft_2024",
          kmPackages: 0,
          extraKm: 0,
          generatorHours: 0,
        }),
      });

      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.match(body.message, /Minimum rental period is 5 days/);
    });

    it("returns 400 when vehicleModel is unknown", async () => {
      const res = await fetch(baseUrl + "/calculate-rental", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: "2026-01-01",
          endDate: "2026-01-05",
          vehicleType: "classC",
          vehicleModel: "__unknown_model__",
          kmPackages: 0,
        }),
      });
      assert.strictEqual(res.status, 400);
    });

    it("includes trailer towing requirements message", async () => {
      const res = await fetch(baseUrl + "/calculate-rental", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: "2026-06-01",
          endDate: "2026-06-05",
          vehicleType: "trailer",
          vehicleModel: "19ft_2023",
          kmPackages: 0,
        }),
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.ok(body.summaryMessage.includes("Please note: You must have a properly rated tow vehicle"));
      assert.ok(body.summaryMessage.includes("CDW Plus"));
      assert.strictEqual(body.breakdown.hitch, 150);
      assert.strictEqual(body.breakdown.dailyRateTotal, 89 * 5);
      assert.strictEqual(body.breakdown.cdw, 210);
      assert.strictEqual(body.total, 1078.02);
    });
  });

  describe("GET /api/leads/manychat", () => {
    it("returns 200 and a helpful message", async () => {
      const res = await fetch(baseUrl + "/api/leads/manychat");
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.method, "POST");
      assert.strictEqual(body.path, "/api/leads/manychat");
    });
  });

  describe("POST /submit-lead", () => {
    it("returns 400 for short name", async () => {
      const res = await fetch(baseUrl + "/submit-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "J",
          email: "jane@example.com",
          phone: "1234567890",
          quote: "$100",
        }),
      });
      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.ok(body.message);
    });

    it("returns 400 for invalid email", async () => {
      const res = await fetch(baseUrl + "/submit-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Jane Doe",
          email: "not-email",
          phone: "1234567890",
          quote: "$100",
        }),
      });
      assert.strictEqual(res.status, 400);
    });
  });

  describe("POST /api/leads/manychat", () => {
    it("returns 401 without x-webhook-secret", async () => {
      const res = await fetch(baseUrl + "/api/leads/manychat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: "Jane",
          last_name: "Doe",
          email: "jane@example.com",
          phone: "1234567890",
          platform: "manychat",
        }),
      });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(await res.text(), "Unauthorized");
    });

    it("returns 401 with wrong x-webhook-secret", async () => {
      const res = await fetch(baseUrl + "/api/leads/manychat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": "wrong-secret",
        },
        body: JSON.stringify({
          first_name: "Jane",
          last_name: "Doe",
          email: "jane@example.com",
          phone: "1234567890",
          platform: "manychat",
        }),
      });
      assert.strictEqual(res.status, 401);
    });

    it("returns 400 for invalid body (missing required)", async () => {
      const res = await fetch(baseUrl + "/api/leads/manychat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": process.env.WEBHOOK_SECRET,
        },
        body: JSON.stringify({ first_name: "J" }),
      });
      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(
        body.message,
        "Lead data incomplete or invalid. Appended to sheets with validated: no"
      );
      assert.ok(Array.isArray(body.errors));
      assert.ok(body.errors.length > 0);
    });

    it("returns 400 for invalid email", async () => {
      const res = await fetch(baseUrl + "/api/leads/manychat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": process.env.WEBHOOK_SECRET,
        },
        body: JSON.stringify({
          first_name: "Jane",
          last_name: "Doe",
          email: "not-an-email",
          phone: "1234567890",
          platform: "manychat",
        }),
      });
      assert.strictEqual(res.status, 400);
    });
  });
});

describe("Rental quote validation suite (logged cases)", () => {
  it("runRentalQuoteValidationTests passes all business-rule cases", () => {
    runRentalQuoteValidationTests({ silent: true, strict: true });
  });
});

describe("Lead schema", () => {
  it("validates correct payload", () => {
    const { error, value } = schema.validate({
      first_name: "Jane",
      last_name: "Doe",
      email: "jane@example.com",
      phone: "1234567890",
      platform: "manychat",
    });
    assert.strictEqual(error, undefined);
    assert.strictEqual(value.first_name, "Jane");
    assert.strictEqual(value.email, "jane@example.com");
  });

  it("rejects short first_name", () => {
    const { error } = schema.validate({
      first_name: "J",
      last_name: "Doe",
      email: "j@e.com",
      phone: "1234567890",
      platform: "manychat",
    });
    assert.ok(error);
  });
});

describe("Formatter", () => {
  it("uses rental calculator title for that platform", () => {
    const lead = {
      first_name: "Jane",
      last_name: "Doe",
      email: "jane@example.com",
      phone: "1234567890",
      platform: "rental-calculator",
      notes: "Quote: $100",
    };
    const body = formatLeadEmail(lead);
    assert.ok(body.text.startsWith("Outdoor Travel Rental Lead"));
    assert.ok(body.html.includes("<h2>Outdoor Travel Rental Lead</h2>"));
  });

  it("formats lead email with required fields", () => {
    const lead = {
      first_name: "Jane",
      last_name: "Doe",
      email: "jane@example.com",
      phone: "1234567890",
      platform: "manychat",
    };
    const body = formatLeadEmail(lead);
    assert.strictEqual(typeof body.text, "string");
    assert.strictEqual(typeof body.html, "string");
    assert.ok(body.text.includes("First Name: Jane"));
    assert.ok(body.text.includes("Last Name: Doe"));
    assert.ok(body.text.includes("Email: jane@example.com"));
    assert.ok(body.html.includes("New Lead from ManyChat"));
    assert.ok(body.html.includes("<strong>Customer:</strong> Jane Doe"));
    assert.ok(body.html.includes("<strong>Email:</strong> jane@example.com"));
  });

  it("includes rental calculator selections block for calculator leads", () => {
    const summary = [
      "Start date: 2026-06-01",
      "End date: 2026-06-10",
      "Vehicle type: Class A",
      "Vehicle model: Class A 30 (2024-2026)",
      "Generator option selected: None ($0)",
    ].join("\n");
    const lead = {
      first_name: "Jane",
      last_name: "Doe",
      email: "jane@example.com",
      phone: "1234567890",
      platform: "rental-calculator",
      quoted_total: "$1,000.00",
      calculator_request_summary: summary,
    };
    const body = formatLeadEmail(lead);
    assert.ok(body.text.includes("Rental calculator selections:"));
    assert.ok(body.text.includes("Start date: 2026-06-01"));
    assert.ok(body.text.includes("Vehicle type: Class A"));
    assert.ok(body.text.includes("Generator option selected: None ($0)"));
    assert.ok(body.html.includes("<h3>Trip Details</h3>"));
    assert.ok(body.html.includes("<strong>Start:</strong> 2026-06-01"));
    assert.ok(body.html.includes("<strong>Vehicle:</strong> Class A"));
    assert.ok(body.html.includes("<strong>Total Quote:</strong> $1,000.00"));
    assert.ok(!body.text.includes("Rental start:"));
  });

  it("omits empty optional fields", () => {
    const lead = {
      first_name: "Jane",
      last_name: "Doe",
      email: "j@e.com",
      phone: "1234567890",
      platform: "manychat",
      notes: "",
    };
    const body = formatLeadEmail(lead);
    assert.ok(body.text.includes("New Lead from ManyChat"));
    assert.ok(!body.text.includes("Notes:"));
  });
});
