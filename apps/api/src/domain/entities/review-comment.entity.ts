import type { Author } from "@/domain/entities/author.entity.js";

export class ReviewComment {
  constructor(
    readonly id: string,
    readonly author: Author,
    readonly body: string,
    readonly createdAt: Date,
  ) {}
}
