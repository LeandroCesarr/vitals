import { describe, expect, it } from "vitest";

import { HealthCalculatorService } from "@/domain/services/health-calculator.service.js";

describe("HealthCalculatorService", () => {
  it("computes health as 100 minus the raw score", () => {
    const service = new HealthCalculatorService();

    expect(service.calculate(30)).toBe(70);
  });

  it("floors health at 0 instead of going negative", () => {
    const service = new HealthCalculatorService();

    expect(service.calculate(150)).toBe(0);
  });

  it("returns health 100 for a raw score of 0", () => {
    const service = new HealthCalculatorService();

    expect(service.calculate(0)).toBe(100);
  });
});
