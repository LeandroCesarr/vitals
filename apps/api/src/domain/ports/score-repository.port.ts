import type { HealthScore } from "@/domain/entities/health-score.entity.js";
import type { PullRequest } from "@/domain/entities/pull-request.entity.js";

export const SCORE_REPOSITORY_PORT = Symbol("SCORE_REPOSITORY_PORT");

export interface ScoreRepositoryPort {
  save(pullRequest: PullRequest, score: HealthScore): Promise<void>;
}
