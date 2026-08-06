/**
 * Cascade guard for app/globals.css.
 *
 * Tailwind v4 emits every utility inside `@layer utilities`. CSS written
 * OUTSIDE any layer beats layered CSS regardless of specificity — so a single
 * unlayered `body > * { position: relative }` once overrode `.fixed` on every
 * portaled dialog and drawer in the app, and shipped to production.
 *
 * These tests fail the build if that class of rule comes back.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const raw = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");
/** Comments explain this very bug — they must not trip the guard. */
const css = raw.replace(/\/\*[\s\S]*?\*\//g, "");

/** Strip @layer blocks, @utility blocks, @theme, and keyframes — what's left is unlayered. */
function unlayeredCss(source: string): string {
  let out = "";
  let i = 0;
  while (i < source.length) {
    const at = source.indexOf("@", i);
    if (at === -1) {
      out += source.slice(i);
      break;
    }
    out += source.slice(i, at);
    const header = source.slice(at, source.indexOf("{", at) + 1);
    // Blocks whose contents are NOT unlayered page CSS
    const isScoped =
      /^@(layer|utility|theme|keyframes|custom-variant|media\s+print)\b/.test(header);
    const braceStart = source.indexOf("{", at);
    if (braceStart === -1) {
      out += source.slice(at);
      break;
    }
    // Walk to the matching close brace
    let depth = 0;
    let j = braceStart;
    for (; j < source.length; j++) {
      if (source[j] === "{") depth++;
      else if (source[j] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    if (!isScoped) out += source.slice(at, j + 1);
    i = j + 1;
  }
  return out;
}

const unlayered = unlayeredCss(css);

describe("globals.css cascade safety", () => {
  it("never reintroduces the rule that broke every portaled dialog", () => {
    expect(css).not.toMatch(/body\s*>\s*\*/);
  });

  it("keeps base element styles inside @layer base", () => {
    expect(css).toMatch(/@layer\s+base\s*\{/);
    // The body/html rules must live inside that layer, not at top level
    const bodyRules = unlayered.match(/(^|[};])\s*(html|body)\s*[,{]/g) ?? [];
    expect(
      bodyRules,
      `Unlayered html/body rules found — wrap them in @layer base:\n${bodyRules.join("\n")}`
    ).toHaveLength(0);
  });

  it("declares no unlayered rule that could outrank a utility", () => {
    // Element, universal and pseudo-element selectors at the top level are the
    // dangerous ones. Class/attribute selectors in the legacy remap are
    // intentional (they carry !important to replace old arbitrary values).
    const offenders: string[] = [];
    const selectorBlocks = unlayered.match(/(^|})\s*([^{}@]+)\{/g) ?? [];
    for (const raw of selectorBlocks) {
      const selector = raw.replace(/^[}\s]*/, "").replace(/\{$/, "").trim();
      if (!selector || selector.startsWith("/*")) continue;
      // Allowed: class-, attribute- and id-anchored selectors, and ::selection-style
      // pseudo rules that no utility competes with.
      const anchored = /[.#\[]/.test(selector);
      const scrollbarOrSelection = /::-webkit-scrollbar|::selection|:focus-visible/.test(selector);
      if (!anchored && !scrollbarOrSelection) offenders.push(selector);
    }
    expect(
      offenders,
      `Unlayered element selectors can beat Tailwind utilities. Move them into @layer base:\n${offenders.join("\n")}`
    ).toHaveLength(0);
  });

  it("still ships the panel grain and the print override", () => {
    expect(css).toMatch(/background-attachment:\s*fixed/);
    expect(css).toMatch(/@media print/);
  });
});
