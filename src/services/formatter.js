const sanitizeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatHtmlValue = (value) =>
  sanitizeHtml(String(value)).replace(/\r?\n/g, "<br>");

const line = (label, value) =>
  value != null && String(value).trim() !== "" ? `${label}: ${String(value).trim()}` : null;

const leadSourceTitle = (platform) => {
  if (platform === "rental-calculator") return "New Lead from Rental Calculator";
  if (platform === "manychat") return "New Lead from ManyChat";
  return "New Lead";
};

exports.formatLeadEmail = (lead) => {
  const hasCalculatorSummary =
    lead.platform === "rental-calculator" &&
    lead.calculator_request_summary != null &&
    String(lead.calculator_request_summary).trim() !== "";

  const calculatorFields = hasCalculatorSummary
    ? [{ label: "Rental calculator selections", value: lead.calculator_request_summary }]
    : [
        { label: "Vehicle type", value: lead.vehicle_type },
        { label: "Vehicle / unit", value: lead.vehicle_model },
        { label: "Start date", value: lead.rental_start },
        { label: "End date", value: lead.rental_end },
        { label: "Add-ons & options", value: lead.rental_extras },
      ];

  const fields = [
    { label: "First Name", value: lead.first_name },
    { label: "Last Name", value: lead.last_name },
    { label: "Email", value: lead.email },
    { label: "Phone", value: lead.phone },
    { label: "Quoted total (calculator)", value: lead.quoted_total },
    { label: "Address", value: lead.address },
    ...calculatorFields,
    { label: "Customer notes", value: lead.customer_notes },
    { label: "Interest", value: lead.interest },
    { label: "Notes", value: lead.notes },
    { label: "Platform", value: lead.platform },
    { label: "Campaign", value: lead.campaign },
    { label: "Date", value: new Date().toLocaleString() },
  ].filter((field) => field.value != null && String(field.value).trim() !== "");

  const textLines = fields.map((field) => `${field.label}: ${String(field.value).trim()}`);
  const htmlRows = fields
    .map(
      (field) =>
        `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:700;background:#f9f9f9;vertical-align:top;">${sanitizeHtml(
          field.label
        )}</td><td style="padding:8px;border:1px solid #ddd;vertical-align:top;">${formatHtmlValue(field.value)}</td></tr>`
    )
    .join("");

  const subject = `New Lead | ${lead.first_name || ""} ${lead.last_name || ""}`.trim();
  const title = leadSourceTitle(lead.platform);

  return {
    subject,
    text: `${title}\n\n${textLines.join("\n")}\n`,
    html: `<!DOCTYPE html>
<html>
  <body style="font-family:Arial,Helvetica,sans-serif;color:#222;line-height:1.5;margin:0;padding:0;">
    <div style="max-width:680px;margin:0 auto;padding:24px;background:#fff;">
      <h2 style="margin-bottom:16px;color:#111;">${sanitizeHtml(title)}</h2>
      <table style="width:100%;border-collapse:collapse;border:1px solid #ddd;">
        ${htmlRows}
      </table>
      <p style="margin-top:20px;color:#555;font-size:13px;">This lead was submitted through the customer request flow.</p>
    </div>
  </body>
</html>`,
  };
};
