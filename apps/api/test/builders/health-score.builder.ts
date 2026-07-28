import { faker } from "@faker-js/faker";

import { HealthScore } from "@/domain/entities/health-score.entity.js";

import { Builder } from "./builder.js";

export class HealthScoreBuilder extends Builder<HealthScore> {
  private rawScore = faker.number.int({ min: 0, max: 100 });
  private health?: number;
  private rulesVersion = "v1";

  withRawScore(rawScore: number): this {
    this.rawScore = rawScore;
    return this;
  }

  withHealth(health: number): this {
    this.health = health;
    return this;
  }

  withRulesVersion(rulesVersion: string): this {
    this.rulesVersion = rulesVersion;
    return this;
  }

  build(): HealthScore {
    return new HealthScore(
      this.rawScore,
      this.health ?? Math.max(0, 100 - this.rawScore),
      this.rulesVersion,
    );
  }
}
