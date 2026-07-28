import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";

import { DomainModule } from "@/domain/domain.module.js";
import { HealthCalculatorService } from "@/domain/services/health-calculator.service.js";
import { ScoringEngineService } from "@/domain/services/scoring-engine.service.js";
import { TagParserService } from "@/domain/services/tag-parser.service.js";

describe("DomainModule", () => {
  it("resolves TagParserService, ScoringEngineService, and HealthCalculatorService", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [DomainModule],
    }).compile();

    expect(moduleRef.get(TagParserService)).toBeInstanceOf(TagParserService);
    expect(moduleRef.get(ScoringEngineService)).toBeInstanceOf(ScoringEngineService);
    expect(moduleRef.get(HealthCalculatorService)).toBeInstanceOf(HealthCalculatorService);
  });
});
