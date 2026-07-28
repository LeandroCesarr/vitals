export class HealthScore {
  constructor(
    readonly rawScore: number,
    readonly health: number,
    readonly rulesVersion: string,
  ) {}
}
