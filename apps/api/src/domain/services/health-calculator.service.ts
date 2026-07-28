import { Injectable } from "@nestjs/common";

@Injectable()
export class HealthCalculatorService {
  calculate(rawScore: number): number {
    return Math.max(0, 100 - rawScore);
  }
}
