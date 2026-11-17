import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored registry code from `shadcn add` (shadcn/ui and ReUI). Kept as shipped so
    // `shadcn add --overwrite` can update it; our own code is linted.
    "components/ui/**",
    "components/reui/**",
  ]),
]);

export default eslintConfig;
