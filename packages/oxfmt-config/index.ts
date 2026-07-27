import type { OxfmtConfig } from "oxfmt";

const base: OxfmtConfig = {
  ignorePatterns: ["dist/**", ".next/**", "coverage/**"],
};

export default base;
