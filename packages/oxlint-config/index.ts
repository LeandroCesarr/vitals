import type { OxlintConfig } from "oxlint";

const base: OxlintConfig = {
  plugins: ["typescript", "unicorn", "oxc"],
  categories: {
    correctness: "error",
  },
  rules: {},
  env: {
    node: true,
  },
};

export default base;
