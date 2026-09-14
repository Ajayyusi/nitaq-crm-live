/**
 * Light is the default theme; dark only when a user explicitly chose it.
 *
 * `main` shipped the opposite (dark unless "light" was stored), and the two
 * places that decide the theme — the pre-hydration script in app/layout.tsx
 * and ThemeProvider — must agree or the page flashes one theme then the other.
 * These guards fail if either drifts back to dark-by-default.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");

describe("theme default", () => {
  const layout = read("app", "layout.tsx");
  const provider = read("components", "theme", "ThemeProvider.tsx");

  it("pre-hydration script only adds dark when 'dark' was stored", () => {
    const script = layout.match(/__html:\s*`([^`]*)`/)?.[1] ?? "";
    expect(script).toContain("localStorage.getItem('theme')==='dark'");
    // The old dark-by-default forms
    expect(script).not.toMatch(/!==\s*'light'/);
    expect(script).not.toMatch(/catch\s*\(e\)\s*\{\s*document\.documentElement\.classList\.add\('dark'\)/);
  });

  it("ThemeProvider starts light and only honours an explicit dark choice", () => {
    expect(provider).toMatch(/useState<Theme>\("light"\)/);
    expect(provider).toMatch(/stored === "dark" \? "dark" : "light"/);
  });

  it("browser chrome colour matches the light panel for everyone", () => {
    expect(layout).toMatch(/<meta name="theme-color" content="#EEF1F5" \/>/);
    expect(layout).not.toMatch(/theme-color"[^>]*prefers-color-scheme: dark/);
  });
});
