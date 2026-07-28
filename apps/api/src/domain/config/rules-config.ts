import { readFileSync } from "node:fs";
import { join } from "node:path";

export const RULES_CONFIG = Symbol("RULES_CONFIG");

export interface RulesConfig {
  readonly version: string;
  readonly weights: Readonly<Record<string, number>>;
}

const RULES_JSON_PATH = join(import.meta.dirname, "../../../rules.json");

export function loadRulesConfig(): RulesConfig {
  const raw = readFileSync(RULES_JSON_PATH, "utf-8");
  return JSON.parse(raw) as RulesConfig;
}
