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

const hasValue = (value) => value != null && String(value).trim() !== "";

const cleanValue = (value) => String(value).trim();

const leadSourceTitle = (platform) => {
  if (platform === "rental-calculator") return "New Rental Lead";
  if (platform === "manychat") return "New Lead from ManyChat";
  return "New Lead";
};

const summaryLabel = (label) =>
  ({
    "Start date": "Start",
    "End date": "End",
    "Vehicle type": "Vehicle",
    "Vehicle model": "Vehicle Model",
    "Generator option selected": "Generator",
  }[label] || label);

const parseSummaryFields = (summary) =>
  cleanValue(summary)
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => {
      const separator = row.indexOf(":");
      if (separator === -1) return { label: "Detail", value: row };
      return {
        label: summaryLabel(row.slice(0, separator).trim()),
        value: row.slice(separator + 1).trim(),
      };
    });

const compactFields = (fields) => fields.filter((field) => hasValue(field.value));

const renderParagraphFields = (fields) =>
  fields
    .map(
      (field) =>
        `<p><strong>${sanitizeHtml(field.label)}:</strong> ${formatHtmlValue(field.value)}</p>`
    )
    .join("\n      ");

const renderListFields = (fields) =>
  fields
    .map(
      (field) =>
        `<li><strong>${sanitizeHtml(field.label)}:</strong> ${formatHtmlValue(field.value)}</li>`
    )
    .join("\n        ");

exports.formatLeadEmail = (lead) => {
  const hasCalculatorSummary =
    lead.platform === "rental-calculator" &&
    lead.calculator_request_summary != null &&
    String(lead.calculator_request_summary).trim() !== "";

  const customerName = [lead.first_name, lead.last_name].filter(hasValue).map(cleanValue).join(" ");

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

  const subject = `New Lead | ${lead.first_name || ""} ${lead.last_name || ""}`.trim();
  const title = leadSourceTitle(lead.platform);
  const calculatorTripFields = hasCalculatorSummary ? parseSummaryFields(lead.calculator_request_summary) : [];
  const tripFields = compactFields(
    hasCalculatorSummary
      ? [
          ...calculatorTripFields.slice(0, 4),
          { label: "Total Quote", value: lead.quoted_total },
          ...calculatorTripFields.slice(4),
        ]
      : [
          { label: "Start", value: lead.rental_start },
          { label: "End", value: lead.rental_end },
          { label: "Vehicle", value: lead.vehicle_type },
          { label: "Vehicle / Unit", value: lead.vehicle_model },
          { label: "Total Quote", value: lead.quoted_total },
          { label: "Add-ons & Options", value: lead.rental_extras },
        ]
  );
  const customerFields = compactFields([
    { label: "Customer", value: customerName },
    { label: "Email", value: lead.email },
    { label: "Phone", value: lead.phone },
    { label: "Address", value: lead.address },
  ]);
  const detailFields = compactFields([
    { label: "Customer notes", value: lead.customer_notes },
    { label: "Interest", value: lead.interest },
    { label: "Notes", value: lead.notes },
    { label: "Platform", value: lead.platform },
    { label: "Campaign", value: lead.campaign },
    { label: "Submitted", value: new Date().toLocaleString() },
  ]);
  const tripSection = tripFields.length
    ? `
      <hr />

      <h3>Trip Details</h3>
      <ul>
        ${renderListFields(tripFields)}
      </ul>`
    : "";
  const detailSection = detailFields.length
    ? `
      <hr />

      <h3>Lead Details</h3>
      ${renderParagraphFields(detailFields)}`
    : "";

  return {
    subject,
    text: `${title}\n\n${textLines.join("\n")}\n`,
    html: `<!DOCTYPE html>
<html>
  <body style="font-family:Arial,Helvetica,sans-serif;color:#222;line-height:1.5;margin:0;padding:0;background:#f6f7f9;">
    <div style="max-width:680px;margin:0 auto;padding:24px;background:#fff;">
      <h2>${sanitizeHtml(title)}</h2>

      ${renderParagraphFields(customerFields)}
      ${tripSection}
      ${detailSection}
      <p style="margin-top:20px;color:#555;font-size:13px;">This lead was submitted through the customer request flow.</p>
    </div>
  </body>
</html>`,
  };
};
