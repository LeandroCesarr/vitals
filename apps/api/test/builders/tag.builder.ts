import { faker } from "@faker-js/faker";

import { Tag } from "@/domain/entities/tag.entity.js";

import { Builder } from "./builder.js";

export class TagBuilder extends Builder<Tag> {
  private metric: string = faker.helpers.arrayElement(["lint", "sql", "security"]);
  private level = faker.number.int({ min: 1, max: 3 });

  withMetric(metric: string): this {
    this.metric = metric;
    return this;
  }

  withLevel(level: number): this {
    this.level = level;
    return this;
  }

  build(): Tag {
    return new Tag(this.metric, this.level);
  }
}
