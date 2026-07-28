import { faker } from "@faker-js/faker";

import type { Author } from "@/domain/entities/author.entity.js";
import { PullRequest } from "@/domain/entities/pull-request.entity.js";
import type { Repository } from "@/domain/entities/repository.entity.js";
import { PullRequestState } from "@/domain/enums/pull-request-state.enum.js";

import { AuthorBuilder } from "./author.builder.js";
import { Builder } from "./builder.js";
import { RepositoryBuilder } from "./repository.builder.js";

export class PullRequestBuilder extends Builder<PullRequest> {
  private repository = new RepositoryBuilder().build();
  private number = faker.number.int({ min: 1, max: 9999 });
  private title = faker.lorem.sentence();
  private author = new AuthorBuilder().build();
  private state = PullRequestState.OPEN;
  private createdAt = faker.date.past();
  private updatedAt = faker.date.recent();

  withRepository(repository: Repository): this {
    this.repository = repository;
    return this;
  }

  withNumber(number: number): this {
    this.number = number;
    return this;
  }

  withTitle(title: string): this {
    this.title = title;
    return this;
  }

  withAuthor(author: Author): this {
    this.author = author;
    return this;
  }

  withState(state: PullRequestState): this {
    this.state = state;
    return this;
  }

  withCreatedAt(createdAt: Date): this {
    this.createdAt = createdAt;
    return this;
  }

  withUpdatedAt(updatedAt: Date): this {
    this.updatedAt = updatedAt;
    return this;
  }

  build(): PullRequest {
    return new PullRequest(
      this.repository,
      this.number,
      this.title,
      this.author,
      this.state,
      this.createdAt,
      this.updatedAt,
    );
  }
}
