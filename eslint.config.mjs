import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const eslintConfig = [...nextCoreWebVitals, ...nextTypescript, {
  rules: {
    // TypeScript rules
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/ban-ts-comment": "off",
    "@typescript-eslint/prefer-as-const": "off",
    "@typescript-eslint/no-unused-disable-directive": "off",
    "no-unused-disable-directive": "off",
    "eslint-comments/no-unused-disable": "off",
    
    // React rules
    "react-hooks/exhaustive-deps": "off",
    "react-hooks/purity": "off",
    "react/no-unescaped-entities": "off",
    "react/display-name": "off",
    "react/prop-types": "off",
    "react-compiler/react-compiler": "off",
    
    // Next.js rules
    "@next/next/no-img-element": "off",
    "@next/next/no-html-link-for-pages": "off",
    
    // General JavaScript rules
    "prefer-const": "off",
    "no-unused-vars": "off",
    "no-unused-disable-directive": "off",
    "eslint-comments/no-unused-disable": "off",
    "react-hooks/set-state-in-effect": "off",
    "@typescript-eslint/no-require-imports": "off",
    "react-hooks/refs": "off",
    "react-hooks/preserve-manual-memoization": "off",
    "@next/next/no-assign-module-variable": "off",
    "react/jsx-no-comment-textnodes": "off",
    "@typescript-eslint/no-unused-expressions": "off",
    "@next/next/no-img-element": "off",
    "@next/next/no-location-assign-relative-destination": "off",
    "react-hooks/no-unused-disable-directive": "off",
    "@typescript-eslint/no-unused-disable-directive": "off",
    "no-unused-disable-directive": "off",
    "eslint-comments/no-unused-disable": "off",
    "no-console": "off",
    "no-debugger": "off",
    "no-empty": "off",
    "no-irregular-whitespace": "off",
    "react-hooks/exhaustive-deps": "off",
    "react-hooks/set-state-in-effect": "off",
    "react-hooks/refs": "off",
    "react-hooks/preserve-manual-memoization": "off",
    "@next/next/no-assign-module-variable": "off",
    "@typescript-eslint/no-require-imports": "off",
    "react/jsx-no-comment-textnodes": "off",
    "react-hooks/rules-of-hooks": "off",
    "@typescript-eslint/no-unused-expressions": "off",
    "@next/next/no-img-element": "off",
    "@next/next/no-location-assign-relative-destination": "off",
    "react-hooks/no-unused-disable-directive": "off",
    "@typescript-eslint/no-unused-disable-directive": "off",
    "no-unused-disable-directive": "off",
    "eslint-comments/no-unused-disable": "off",
    "no-case-declarations": "off",
    "no-fallthrough": "off",
    "no-mixed-spaces-and-tabs": "off",
    "no-redeclare": "off",
    "no-undef": "off",
    "no-unreachable": "off",
    "no-useless-escape": "off",
  },
}, {
  ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts", "examples/**", "skills"]
}];

export default eslintConfig;
