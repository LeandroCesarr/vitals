import type { VcsProvider } from "@/domain/enums/vcs-provider.enum.js";

export class Repository {
  constructor(
    readonly vcsProvider: VcsProvider,
    readonly fullName: string,
  ) {}
}
