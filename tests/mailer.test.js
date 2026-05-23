const { describe, it } = require("node:test");
const assert = require("node:assert");
const { getLeadNotificationRecipients } = require("../src/services/leadRecipients");

describe("getLeadNotificationRecipients", () => {
  it("sends to CRM_EMAIL only when CRM_EMAIL2 is unset", () => {
    const { to, bcc } = getLeadNotificationRecipients({ CRM_EMAIL: "crm@example.com" });
    assert.strictEqual(to, "crm@example.com");
    assert.strictEqual(bcc, undefined);
  });

  it("Bccs CRM_EMAIL2 when both CRM inboxes are set", () => {
    const { to, bcc } = getLeadNotificationRecipients({
      CRM_EMAIL: "crm@example.com",
      CRM_EMAIL2: "crm2@example.com",
    });
    assert.strictEqual(to, "crm@example.com");
    assert.deepStrictEqual(bcc, ["crm2@example.com"]);
  });

  it("Bccs both CRM inboxes when LEAD_EMAIL_TO is the visible To", () => {
    const { to, bcc } = getLeadNotificationRecipients({
      CRM_EMAIL: "crm@example.com",
      CRM_EMAIL2: "crm2@example.com",
      LEAD_EMAIL_TO: "leads@example.com",
    });
    assert.strictEqual(to, "leads@example.com");
    assert.deepStrictEqual(bcc, ["crm@example.com", "crm2@example.com"]);
  });

  it("dedupes CRM_EMAIL2 when it matches CRM_EMAIL", () => {
    const { to, bcc } = getLeadNotificationRecipients({
      CRM_EMAIL: "crm@example.com",
      CRM_EMAIL2: "CRM@example.com",
    });
    assert.strictEqual(to, "crm@example.com");
    assert.strictEqual(bcc, undefined);
  });
});
