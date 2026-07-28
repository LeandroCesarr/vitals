import { faker } from "@faker-js/faker";

import type { RulesConfig } from "@/domain/config/rules-config.js";

import { Builder } from "./builder.js";

export class RulesConfigBuilder extends Builder<RulesConfig> {
  private version = `v${faker.number.int({ min: 1, max: 9 })}`;
  private weights: Readonly<Record<string, number>> = {
    lint: faker.number.int({ min: 1, max: 30 }),
    sql: faker.number.int({ min: 1, max: 30 }),
    security: faker.number.int({ min: 1, max: 30 }),
  };

  withVersion(version: string): this {
    this.version = version;
    return this;
  }

  withWeights(weights: Readonly<Record<string, number>>): this {
    this.weights = weights;
    return this;
  }

  build(): RulesConfig {
    return { version: this.version, weights: this.weights };
  }
}
