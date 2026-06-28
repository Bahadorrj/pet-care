import type { TFunction } from "i18next";
import { cheerPhrase } from "../components/toastConfig";

// Echo the key (+ name) so we can assert which key was picked without i18n.
const t = ((key: string, opts?: { name?: string }) =>
  opts?.name ? `${key}|${opts.name}` : key) as unknown as TFunction;

describe("cheerPhrase", () => {
  test("picks an in-range cheer key and interpolates the name", () => {
    // Sample enough times to exercise the random branch.
    for (let i = 0; i < 50; i++) {
      const out = cheerPhrase(t, "میلو");
      expect(out).toMatch(/^tasks\.done\.cheer\.[0-2]\|میلو$/);
    }
  });

  test("falls back to «انجام شد» key when no pet name", () => {
    expect(cheerPhrase(t, undefined)).toBe("tasks.undo.done");
    expect(cheerPhrase(t, "")).toBe("tasks.undo.done");
  });
});
