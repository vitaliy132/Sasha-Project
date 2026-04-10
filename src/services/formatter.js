const line = (label, value) =>
  value != null && String(value).trim() !== "" ? `${label}: ${String(value).trim()}` : null;

const leadSourceTitle = (platform) => {
  if (platform === "rental-calculator") return "New Lead from Rental Calculator";
  if (platform === "manychat") return "New Lead from ManyChat";
  return "New Lead";
};

exports.formatLeadEmail = (lead) => {
  const lines = [
    line("First Name", lead.first_name),
    line("Last Name", lead.last_name),
    line("Email", lead.email),
    line("Phone", lead.phone),
    line("Interest", lead.interest),
    line("Notes", lead.notes),
    line("Platform", lead.platform),
    line("Campaign", lead.campaign),
    line("Date", new Date().toISOString()),
  ].filter(Boolean);

  return `${leadSourceTitle(lead.platform)}\n\n${lines.join("\n")}\n`;
};
