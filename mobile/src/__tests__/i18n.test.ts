/**
 * i18n setup tests
 *
 * Verifies:
 * 1. Every one of the 13 Farsi string keys resolves to its exact expected value.
 * 2. RTL configuration is applied at module init via I18nManager spies.
 *
 * RTL spy strategy:
 *   ES module `import` statements are hoisted above any executable code by the
 *   TypeScript/Babel transform, so placing jest.spyOn() before an `import`
 *   statement does not work — the module runs before the spies exist.
 *   Instead, we use jest.isolateModules() which loads a fresh module instance
 *   inside a synchronous sandbox. We also mock react-native so we can intercept
 *   I18nManager calls before requiring the i18n module inside that sandbox.
 */

// ---------------------------------------------------------------------------
// Translation tests — import i18n directly; module caching is fine here
// because we only care about the translated strings.
// ---------------------------------------------------------------------------

import i18n from "../i18n/index";

const t = (key: string): string => i18n.t(key);

describe("i18n – Farsi translations", () => {
  beforeAll(async () => {
    if (!i18n.isInitialized) {
      await new Promise<void>((resolve) => i18n.on("initialized", resolve));
    }
  });

  const cases: [string, string][] = [
    ["app.name", "پت‌کر"],
    ["home.signin_signup", "ورود / ثبت‌نام"],
    ["home.profile", "پروفایل"],
    ["auth.email", "ایمیل"],
    ["auth.password", "رمز عبور"],
    ["auth.signin", "ورود"],
    ["auth.signup", "ثبت‌نام"],
    ["auth.no_account", "حساب نداری؟ ثبت‌نام کن"],
    ["auth.has_account", "قبلاً ثبت‌نام کردی؟ وارد شو"],
    ["auth.error.invalid_credentials", "ایمیل یا رمز عبور اشتباه است"],
    ["auth.error.email_taken", "این ایمیل قبلاً ثبت شده"],
    ["auth.error.weak_password", "رمز عبور باید حداقل ۸ کاراکتر باشد"],
    ["auth.error.network", "خطای شبکه. دوباره تلاش کنید"],
  ];

  test.each(cases)('t("%s") returns correct Farsi string', (key, expected) => {
    expect(t(key)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// RTL config tests
//
// jest.isolateModules() creates a fresh module registry synchronously.
// Inside it we require react-native first, attach spies to I18nManager, then
// require the i18n module — guaranteeing the module-init code runs after spies
// are in place. The outer `import` of react-native is NOT used here; we rely
// on require() inside the sandbox so we get the same instance the i18n module
// will receive.
// ---------------------------------------------------------------------------

describe("i18n – RTL configuration applied at module init", () => {
  let allowRTLSpy: jest.SpyInstance;
  let forceRTLSpy: jest.SpyInstance;

  beforeAll(() => {
    jest.isolateModules(() => {
      const { I18nManager } =
        require("react-native") as typeof import("react-native");
      allowRTLSpy = jest.spyOn(I18nManager, "allowRTL");
      forceRTLSpy = jest.spyOn(I18nManager, "forceRTL");

      // Load the i18n module fresh — its top-level side-effects run now,
      // after the spies are attached.
      require("../i18n/index");
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test("I18nManager.allowRTL was called with true", () => {
    expect(allowRTLSpy).toHaveBeenCalledWith(true);
  });

  test("I18nManager.forceRTL was called with true", () => {
    expect(forceRTLSpy).toHaveBeenCalledWith(true);
  });
});
