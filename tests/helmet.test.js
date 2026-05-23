const { describe, it } = require("node:test");
const assert = require("node:assert");
const {
  parseFrameAncestors,
  allowsExternalEmbedding,
  getHelmetOptions,
} = require("../src/config/helmet");

describe("helmet config", () => {
  it("defaults frame-ancestors to self only", () => {
    assert.deepStrictEqual(parseFrameAncestors({}), ["'self'"]);
    assert.strictEqual(allowsExternalEmbedding(["'self'"]), false);
    assert.strictEqual(getHelmetOptions({}).xFrameOptions, undefined);
  });

  it("allows any parent when FRAME_ANCESTORS is *", () => {
    assert.deepStrictEqual(parseFrameAncestors({ FRAME_ANCESTORS: "*" }), ["*"]);
    assert.strictEqual(allowsExternalEmbedding(["*"]), true);
    assert.strictEqual(getHelmetOptions({ FRAME_ANCESTORS: "*" }).xFrameOptions, false);
  });

  it("allows specific parent origins from a comma-separated list", () => {
    const ancestors = parseFrameAncestors({
      FRAME_ANCESTORS: "https://www.example.com, https://app.example.com",
    });
    assert.deepStrictEqual(ancestors, ["https://www.example.com", "https://app.example.com"]);
    assert.strictEqual(getHelmetOptions({ FRAME_ANCESTORS: ancestors.join(",") }).xFrameOptions, false);
  });
});
