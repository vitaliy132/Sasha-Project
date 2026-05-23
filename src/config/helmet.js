/**
 * Helmet options for iframe embedding.
 *
 * Set FRAME_ANCESTORS on Render (comma-separated origins, or "*" for any parent).
 * When allowing external parents, X-Frame-Options is disabled so CSP frame-ancestors
 * is the single source of truth (X-Frame-Options cannot express an allow-list).
 */
function parseFrameAncestors(env = process.env) {
  const raw = env.FRAME_ANCESTORS?.trim();
  if (!raw) return ["'self'"];
  if (raw === "*") return ["*"];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function allowsExternalEmbedding(frameAncestors) {
  return frameAncestors.includes("*") || frameAncestors.some((value) => value !== "'self'");
}

function getHelmetOptions(env = process.env) {
  const frameAncestors = parseFrameAncestors(env);
  const options = {
    contentSecurityPolicy: {
      directives: {
        frameAncestors,
      },
    },
  };

  if (allowsExternalEmbedding(frameAncestors)) {
    options.xFrameOptions = false;
  }

  return options;
}

module.exports = {
  parseFrameAncestors,
  allowsExternalEmbedding,
  getHelmetOptions,
};
