const dedupeEmails = (addresses) => {
  const seen = new Set();
  const result = [];
  for (const address of addresses) {
    const trimmed = String(address || "").trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
};

const emailsExcept = (addresses, exclude) => {
  const skip = String(exclude || "")
    .trim()
    .toLowerCase();
  if (!skip) return dedupeEmails(addresses);
  return dedupeEmails(addresses).filter((address) => address.toLowerCase() !== skip);
};

/**
 * Lead mail recipients:
 * - CRM_EMAIL and optional CRM_EMAIL2 always receive a copy (Bcc when LEAD_EMAIL_TO is the visible To).
 * - When LEAD_EMAIL_TO is set and differs from CRM inboxes, the visible To uses LEAD_EMAIL_TO.
 */
const getLeadNotificationRecipients = (env = process.env) => {
  const crm = String(env.CRM_EMAIL || "").trim();
  const crm2 = String(env.CRM_EMAIL2 || "").trim();
  const publicTo = String(env.LEAD_EMAIL_TO || "").trim();
  const crmInboxes = dedupeEmails([crm, crm2]);

  const usePublicTo =
    publicTo.length > 0 &&
    !crmInboxes.some((address) => address.toLowerCase() === publicTo.toLowerCase());

  if (usePublicTo) {
    return {
      to: publicTo,
      bcc: crmInboxes.length ? crmInboxes : undefined,
    };
  }

  const to = crm || crm2;
  const bcc = emailsExcept(crmInboxes, to);
  return { to, bcc: bcc.length ? bcc : undefined };
};

module.exports = { getLeadNotificationRecipients };
