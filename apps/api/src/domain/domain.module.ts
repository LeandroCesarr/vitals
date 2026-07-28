import { Module } from "@nestjs/common";

import { loadRulesConfig, RULES_CONFIG } from "@/domain/config/rules-config.js";
import { HealthCalculatorService } from "@/domain/services/health-calculator.service.js";
import { ScoringEngineService } from "@/domain/services/scoring-engine.service.js";
import { TagParserService } from "@/domain/services/tag-parser.service.js";

@Module({
  providers: [
    { provide: RULES_CONFIG, useFactory: loadRulesConfig },
    TagParserService,
    ScoringEngineService,
    HealthCalculatorService,
  ],
  exports: [TagParserService, ScoringEngineService, HealthCalculatorService],
})
export class DomainModule {}
