// Logger utility
const log = (level, ...args) => {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level}]`;
  const fn = level === "error" ? console.error : console.log;
  fn(prefix, ...args);
};

module.exports = {
  info: (...args) => log("INFO", ...args),
  error: (...args) => log("ERROR", ...args),
  warn: (...args) => log("WARN", ...args),
  debug: (...args) => log("DEBUG", ...args),
};
