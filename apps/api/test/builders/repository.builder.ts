import { faker } from "@faker-js/faker";

import { Repository } from "@/domain/entities/repository.entity.js";
import { VcsProvider } from "@/domain/enums/vcs-provider.enum.js";

import { Builder } from "./builder.js";

export class RepositoryBuilder extends Builder<Repository> {
  private vcsProvider = VcsProvider.GITHUB;
  private fullName = `${faker.word.noun()}/${faker.word.noun()}`;

  withVcsProvider(vcsProvider: VcsProvider): this {
    this.vcsProvider = vcsProvider;
    return this;
  }

  withFullName(fullName: string): this {
    this.fullName = fullName;
    return this;
  }

  build(): Repository {
    return new Repository(this.vcsProvider, this.fullName);
  }
}
