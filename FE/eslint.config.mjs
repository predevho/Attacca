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
    rules: {
      // `_` 접두사는 "일부러 안 쓰는 인자"라는 뜻으로 쓴다.
      // fetch 목처럼 시그니처를 맞추려고 인자를 선언해야 하는 자리가 있는데
      // (인자를 비우면 mock.calls가 빈 튜플로 추론돼 타입 검사가 무력해진다),
      // 그걸 미사용 경고로 잡으면 시그니처를 지우는 쪽으로 몰린다.
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
    },
  },
]);

export default eslintConfig;
