import { describe, expect, it } from "vitest";

import { HealthScore } from "@/domain/entities/health-score.entity.js";
import { HealthCalculatorService } from "@/domain/services/health-calculator.service.js";
import { ScoringEngineService } from "@/domain/services/scoring-engine.service.js";
import { TagParserService } from "@/domain/services/tag-parser.service.js";
import { RulesConfigBuilder } from "@test/builders/rules-config.builder.js";

describe("domain pipeline (TagParserService -> ScoringEngineService -> HealthCalculatorService)", () => {
  it("chains the three real services into a HealthScore, with no mocking between them", () => {
    const rulesConfig = new RulesConfigBuilder()
      .withVersion("v1")
      .withWeights({ lint: 5, sql: 15 })
      .build();
    const tagParser = new TagParserService();
    const scoringEngine = new ScoringEngineService(rulesConfig);
    const healthCalculator = new HealthCalculatorService();

    const commentBody = "<!-- metric: lint level=2 --> looks good, but also [sql:1]";

    const tags = tagParser.parse(commentBody);
    const { rawScore, rulesVersion } = scoringEngine.score(tags);
    const health = healthCalculator.calculate(rawScore);
    const healthScore = new HealthScore(rawScore, health, rulesVersion);

    // rawScore = (lint: 5 × 2) + (sql: 15 × 1) = 25; health = 100 - 25 = 75
    expect(healthScore).toEqual(new HealthScore(25, 75, "v1"));
  });
});
