export abstract class Builder<T> {
  abstract build(): T;

  buildMany(count: number): T[] {
    return Array.from({ length: count }, () => this.build());
  }
}
