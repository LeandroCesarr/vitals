import { faker } from "@faker-js/faker";

import { Author } from "@/domain/entities/author.entity.js";

import { Builder } from "./builder.js";

export class AuthorBuilder extends Builder<Author> {
  private name = faker.internet.username();

  withName(name: string): this {
    this.name = name;
    return this;
  }

  build(): Author {
    return new Author(this.name);
  }
}
