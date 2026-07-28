import type { PullRequest } from "@/domain/entities/pull-request.entity.js";
import type { ReviewComment } from "@/domain/entities/review-comment.entity.js";

export const VCS_PROVIDER_PORT = Symbol("VCS_PROVIDER_PORT");

export interface VcsProviderPort {
  fetchPullRequest(repoFullName: string, prNumber: number): Promise<PullRequest>;
  fetchReviewComments(repoFullName: string, prNumber: number): Promise<ReviewComment[]>;
}
