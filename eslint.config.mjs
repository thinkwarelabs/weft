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
  // TRUST BOUNDARY ENFORCEMENT
  //
  // Clients touch exactly one surface. These rules make that a build failure
  // rather than a code-review question. If one of them fires, do not add an
  // eslint-disable — the import is telling you the design has drifted.
  // -------------------------------------------------------------------------
  {
    // The whole client subtree, including its write endpoint at
    // src/app/(client)/f/api/. The src/app/api/client/** entry is kept so the
    // rule still applies if anyone reintroduces a route there — which they
    // shouldn't, since the Path=/f cookie would never reach it.
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
              // Exact specifiers, not a glob. `**/auth` also matched
              // @/lib/auth/client-token — the one auth module the client
              // surface MUST use — so the rule was blocking correct code while
              // saying the opposite in its message.
              group: [
                "@/auth",
                "@/auth.config",
                "@/lib/auth/internal",
                "**/lib/auth/internal",
              ],
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
