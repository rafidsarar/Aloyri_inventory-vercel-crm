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
  ]),
  {
    files: ["app/**/*.{ts,tsx}", "lib/**/*.ts", "db/**/*.ts"],
    rules: {
      // The current CRM predates this lint rule and uses explicit any at API/UI
      // boundaries. TypeScript strict mode and runtime Zod validation remain
      // enforced; new correctness checks should not be hidden by legacy style debt.
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["app/promotions/promotions-client.tsx", "app/crm-sections/orders.tsx"],
    rules: {
      // These established client loaders intentionally refresh server-backed state
      // from effects. Keep the release gate focused on correctness while these
      // loaders are migrated to a subscription/data-fetching abstraction.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["components/ui/**/*.{ts,tsx}", "hooks/use-mobile.ts"],
    rules: {
      // These files are vendored verbatim from shadcn@4.17.0. Keep the
      // registry source intact while applying the stricter rules to Site code.
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
