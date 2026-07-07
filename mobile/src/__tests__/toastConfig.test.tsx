import i18n from "../i18n";
import { donePhrase } from "../components/toastConfig";

describe("donePhrase", () => {
  it("returns a deterministic neutral confirmation naming the pet", () => {
    expect(donePhrase(i18n.t, "رکسی")).toBe(
      i18n.t("tasks.done.confirm", { name: "رکسی" }),
    );
  });

  it("falls back to the bare done label without a pet name", () => {
    expect(donePhrase(i18n.t)).toBe(i18n.t("tasks.undo.done"));
  });
});
