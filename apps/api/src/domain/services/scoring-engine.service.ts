import { Inject, Injectable } from "@nestjs/common";

import { RULES_CONFIG, type RulesConfig } from "@/domain/config/rules-config.js";
import type { Tag } from "@/domain/entities/tag.entity.js";

export interface ScoringResult {
  readonly rawScore: number;
  readonly rulesVersion: string;
}

@Injectable()
export class ScoringEngineService {
  constructor(@Inject(RULES_CONFIG) private readonly rulesConfig: RulesConfig) {}

  score(tags: Tag[]): ScoringResult {
    const rawScore = tags.reduce((total, tag) => total + this.scoreTag(tag), 0);

    return { rawScore, rulesVersion: this.rulesConfig.version };
  }

  private scoreTag(tag: Tag): number {
    const weight = this.rulesConfig.weights[tag.metric] ?? 0;
    return weight * tag.level;
  }
}
