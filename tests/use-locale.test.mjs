import "global-jsdom/register";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import React from "react";
import { renderHook, act } from "@testing-library/react";

const source = readFileSync(new URL("../src/lib/use-locale.tsx", import.meta.url), "utf8");
// Transpile with reactJsx so it uses React.createElement
const js = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.React, // Changes JSX from _jsx to React.createElement
  }
}).outputText;

const customRequire = (id) => {
  if (id === "react") return React;
  if (id === "@/lib/i18n") {
    return {
      DEFAULT_LOCALE: "en",
      LOCALES: ["en", "it", "es", "fr", "de", "pt", "ru"],
      translate: (locale, key) => {
        if (key === "hello") return `Hello {name}`;
        return `translated_${locale}_${key}`;
      }
    };
  }
  throw new Error(`Cannot find module '${id}'`);
};

let reloadCalled = false;
// Replace the transpile-evaluated `window.location.reload`
// with a mock window before passing it into `new Function`.
// Since window.location cannot be overwritten in global-jsdom,
// we will just inject a mock window variable into the evaluation scope!

const mockWindow = {
  location: {
    reload: () => { reloadCalled = true; }
  }
};

const mod = { exports: {} };
// Inject our mockWindow as window
new Function("module", "exports", "require", "React", "window", "document", js)(mod, mod.exports, customRequire, React, mockWindow, document);
const { useLocale, LocaleProvider } = mod.exports;

test("useLocale hook fallback without provider", () => {
  const { result } = renderHook(() => useLocale("en"));
  assert.equal(result.current.locale, "en");
  assert.equal(typeof result.current.setLocale, "function");
  assert.equal(typeof result.current.t, "function");

  // Test fallback t interpolation
  assert.equal(result.current.t("hello", { name: "World" }), "Hello World");
  assert.equal(result.current.t("missing"), "translated_en_missing");
});

test("LocaleProvider initializes with initialLocale", () => {
  const wrapper = ({ children }) => React.createElement(LocaleProvider, { initialLocale: "it" }, children);
  const { result } = renderHook(() => useLocale(), { wrapper });

  assert.equal(result.current.locale, "it");
  assert.equal(result.current.t("test"), "translated_it_test");
});

test("setLocale updates cookie, internal state, and calls window.location.reload", () => {
  reloadCalled = false;

  // Clear cookie
  document.cookie = "locale=; expires=Thu, 01 Jan 1970 00:00:00 GMT";

  const wrapper = ({ children }) => React.createElement(LocaleProvider, { initialLocale: "en" }, children);
  const { result } = renderHook(() => useLocale(), { wrapper });

  assert.equal(result.current.locale, "en");

  act(() => {
    result.current.setLocale("it");
  });

  assert.equal(result.current.locale, "it");
  assert.match(document.cookie, /locale=it/);
  assert.equal(reloadCalled, true);
});

test("setLocale ignores unsupported locales", () => {
  reloadCalled = false;

  document.cookie = "locale=; expires=Thu, 01 Jan 1970 00:00:00 GMT";

  const wrapper = ({ children }) => React.createElement(LocaleProvider, { initialLocale: "en" }, children);
  const { result } = renderHook(() => useLocale(), { wrapper });

  act(() => {
    result.current.setLocale("xx"); // Unsupported
  });

  assert.equal(result.current.locale, "en"); // Should not change
  assert.doesNotMatch(document.cookie, /locale=xx/);
  assert.equal(reloadCalled, false);
});

test("t function interpolates variables correctly", () => {
  const wrapper = ({ children }) => React.createElement(LocaleProvider, { initialLocale: "en" }, children);
  const { result } = renderHook(() => useLocale(), { wrapper });

  assert.equal(result.current.t("hello", { name: "Alice" }), "Hello Alice");
  // Missing variable fallback
  assert.equal(result.current.t("hello", {}), "Hello {name}");
});
