import { describe, expect, it } from "vitest";

import { ScoringEngineService } from "@/domain/services/scoring-engine.service.js";
import { RulesConfigBuilder } from "@test/builders/rules-config.builder.js";
import { TagBuilder } from "@test/builders/tag.builder.js";

describe("ScoringEngineService", () => {
  it("scores a single tag as weight × level", () => {
    const rulesConfig = new RulesConfigBuilder().withWeights({ lint: 5 }).build();
    const service = new ScoringEngineService(rulesConfig);

    const result = service.score([new TagBuilder().withMetric("lint").withLevel(2).build()]);

    expect(result.rawScore).toBe(10);
  });

  it("sums the score across multiple tags", () => {
    const rulesConfig = new RulesConfigBuilder().withWeights({ lint: 5, sql: 15 }).build();
    const service = new ScoringEngineService(rulesConfig);

    const result = service.score([
      new TagBuilder().withMetric("lint").withLevel(1).build(),
      new TagBuilder().withMetric("sql").withLevel(1).build(),
    ]);

    expect(result.rawScore).toBe(20);
  });

  it("contributes 0 for a tag whose metric is absent from weights, without throwing", () => {
    const rulesConfig = new RulesConfigBuilder().withWeights({ lint: 5 }).build();
    const service = new ScoringEngineService(rulesConfig);

    const result = service.score([new TagBuilder().withMetric("unknown").withLevel(3).build()]);

    expect(result.rawScore).toBe(0);
  });

  it("carries the injected rules configuration's version in the result", () => {
    const rulesConfig = new RulesConfigBuilder().withVersion("v7").build();
    const service = new ScoringEngineService(rulesConfig);

    const result = service.score([new TagBuilder().build()]);

    expect(result.rulesVersion).toBe("v7");
  });

  it("yields raw score 0 with rulesVersion still present for an empty tag list", () => {
    const rulesConfig = new RulesConfigBuilder().withVersion("v3").build();
    const service = new ScoringEngineService(rulesConfig);

    const result = service.score([]);

    expect(result).toEqual({ rawScore: 0, rulesVersion: "v3" });
  });
});
