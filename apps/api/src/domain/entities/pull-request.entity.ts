import type { Author } from "@/domain/entities/author.entity.js";
import type { Repository } from "@/domain/entities/repository.entity.js";
import type { PullRequestState } from "@/domain/enums/pull-request-state.enum.js";

export class PullRequest {
  constructor(
    readonly repository: Repository,
    readonly number: number,
    readonly title: string,
    readonly author: Author,
    readonly state: PullRequestState,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}
}
