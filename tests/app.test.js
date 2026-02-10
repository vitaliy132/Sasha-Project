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

let server;
let baseUrl;

describe("Env and config", () => {
  it("required env keys are set in test", () => {
    const required = ["WEBHOOK_SECRET", "SMTP_HOST", "SMTP_USER", "SMTP_PASS", "CRM_EMAIL"];
    required.forEach((key) => {
      assert.ok(process.env[key]?.trim(), `Missing env: ${key}`);
    });
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
      assert.ok(body.health);
      assert.ok(body.envCheck);
    });
  });

  describe("GET /health", () => {
    it("returns 200 OK", async () => {
      const res = await fetch(baseUrl + "/health");
      assert.strictEqual(res.status, 200);
      assert.strictEqual(await res.text(), "OK");
    });
  });

  describe("GET /api/env-check", () => {
    it("returns env key presence without values", async () => {
      const res = await fetch(baseUrl + "/api/env-check");
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.ok, true);
      assert.ok(body.keys.WEBHOOK_SECRET === true);
      assert.ok(body.keys.CRM_EMAIL === true);
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
      assert.strictEqual(await res.text(), "Invalid lead data");
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
  it("formats lead email with required fields", () => {
    const lead = {
      first_name: "Jane",
      last_name: "Doe",
      email: "jane@example.com",
      phone: "1234567890",
      platform: "manychat",
    };
    const body = formatLeadEmail(lead);
    assert.ok(body.includes("First Name: Jane"));
    assert.ok(body.includes("Last Name: Doe"));
    assert.ok(body.includes("Email: jane@example.com"));
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
    assert.ok(body.includes("New Lead from ManyChat"));
  });
});
