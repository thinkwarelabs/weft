import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/**", // Prisma client
  ]),

  // -------------------------------------------------------------------------
  // INHERITED DEBT — downgraded to a warning, deliberately.
  //
  // Four components ported from the Invoice app sync state inside an effect:
  // three reset a modal's form when it opens, one kicks off a data fetch. The
  // React Compiler rule flags all four. They work correctly today.
  //
  // Why warn and not error: the import zones below are a SECURITY control, and
  // a lint run that is permanently red is one nobody reads. Keeping the run
  // green is what makes a boundary violation visible.
  //
  // The correct fix for the modals is remounting via a `key` prop rather than
  // syncing state in an effect. Do it when these components are rewired to
  // Prisma in Step 2 (invoices/settings) and Step 7 (financials), then raise
  // this back to "error".
  //   - components/financials/ExpenseFormModal.tsx
  //   - components/financials/FinancialsDashboard.tsx
  //   - components/invoices/RecordPaymentModal.tsx
  //   - components/settings/ClientFormModal.tsx
  // -------------------------------------------------------------------------
  {
    files: ["src/components/**"],
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },

  // -------------------------------------------------------------------------
  // TRUST BOUNDARY ENFORCEMENT
  //
  // Clients touch exactly one surface. These rules make that a build failure
  // rather than a code-review question. If one of them fires, do not add an
  // eslint-disable — the import is telling you the design has drifted.
  // -------------------------------------------------------------------------
  {
    files: ["src/app/(client)/**", "src/app/api/client/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/lib/db", "**/lib/db.js", "@/lib/db"],
              message:
                "Client-facing code must not hold a Prisma client. Use the named functions in @/lib/client-scope, which resolve projectId from the verified cookie.",
            },
            {
              group: ["**/auth", "**/auth.config", "@/auth", "@/lib/auth/internal"],
              message:
                "Clients do not have NextAuth sessions. Use @/lib/auth/client-token.",
            },
            {
              group: [
                "**/lib/pdf/**",
                "**/lib/financials",
                "**/lib/money",
                "**/lib/gst",
                "**/lib/ideas",
                "**/lib/vault",
                "**/lib/drive",
              ],
              message:
                "Internal-only module. The client surface is Feedback and nothing else.",
            },
          ],
        },
      ],
    },
  },

  // The chokepoint itself may use Prisma, but must never reach into the
  // internal modules it is meant to be isolated from.
  {
    files: ["src/lib/client-scope.ts", "src/lib/auth/client-token.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/auth", "**/lib/auth/internal", "**/lib/pdf/**", "**/lib/ideas"],
              message:
                "The client boundary must not depend on internal auth or internal modules.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
