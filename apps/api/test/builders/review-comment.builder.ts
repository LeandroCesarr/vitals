import { faker } from "@faker-js/faker";

import type { Author } from "@/domain/entities/author.entity.js";
import { ReviewComment } from "@/domain/entities/review-comment.entity.js";

import { AuthorBuilder } from "./author.builder.js";
import { Builder } from "./builder.js";

export class ReviewCommentBuilder extends Builder<ReviewComment> {
  private id = faker.string.uuid();
  private author = new AuthorBuilder().build();
  private body = faker.lorem.sentence();
  private createdAt = faker.date.recent();

  withId(id: string): this {
    this.id = id;
    return this;
  }

  withAuthor(author: Author): this {
    this.author = author;
    return this;
  }

  withBody(body: string): this {
    this.body = body;
    return this;
  }

  withCreatedAt(createdAt: Date): this {
    this.createdAt = createdAt;
    return this;
  }

  build(): ReviewComment {
    return new ReviewComment(this.id, this.author, this.body, this.createdAt);
  }
}
