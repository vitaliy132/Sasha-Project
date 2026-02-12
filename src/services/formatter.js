const line = (label, value) =>
  value != null && String(value).trim() !== "" ? `${label}: ${String(value).trim()}` : null;

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

  return "New Lead from ManyChat\n\n" + lines.join("\n") + "\n";
};
