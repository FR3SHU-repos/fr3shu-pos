import next from "eslint-config-next";

/**
 * eslint-config-next@16 already ships a flat-config array
 * (next/core-web-vitals + next/typescript). No FlatCompat needed.
 */
const eslintConfig = [
  ...next,
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts", "coverage/**"],
  },
  {
    rules: {
      // Next 16 ships this new rule as an error. Our client pages legitimately
      // fetch-on-mount through the typed API client and setState with the result
      // (the pattern React's own docs endorse when there is no framework loader).
      // Kept as a warning so real misuse is still surfaced. See DECISIONS.md.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default eslintConfig;
