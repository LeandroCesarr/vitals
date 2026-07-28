import { describe, expect, it } from "vitest";

import { loadRulesConfig } from "@/domain/config/rules-config.js";

describe("loadRulesConfig", () => {
  it("parses the shipped rules.json into the expected shape", () => {
    const config = loadRulesConfig();

    expect(config).toEqual({
      version: "v1",
      weights: {
        lint: 5,
        sql: 15,
        security: 25,
      },
    });
  });
});
