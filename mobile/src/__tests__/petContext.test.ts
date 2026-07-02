import { buildPetContext, scheduleText } from "../lib/petContext";
import type { Pet, Task } from "../db/types";

const basePet: Pet = {
  id: "p1",
  name: "پیشی",
  species: "cat",
  speciesOther: null,
  gender: "female",
  photoUri: null,
  notes: "به ماهی حساسیت داره",
  breed: "پرشین",
  weightValue: 3.5,
  weightUnit: "kg",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const feedingTask: Task = {
  id: "t1",
  petId: "p1",
  type: "feeding",
  title: null,
  schedule: { kind: "daily_times", times: ["08:00", "18:00"] },
  endKind: "never",
  endUntil: null,
  endCount: null,
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const noLogs = () => [];

describe("scheduleText", () => {
  it("renders each schedule kind in persian", () => {
    expect(scheduleText({ kind: "daily_times", times: ["08:00"] })).toBe(
      "هر روز ۰۸:۰۰",
    );
    expect(
      scheduleText({ kind: "interval", n: 12, unit: "hours", anchor: "x" }),
    ).toBe("هر ۱۲ ساعت");
    expect(
      scheduleText({ kind: "weekdays", days: [5], times: ["09:00"] }),
    ).toContain("جمعه");
  });
});

describe("buildPetContext", () => {
  it("includes all pets when nothing selected, with derived fields", () => {
    const bundle = buildPetContext([basePet], [feedingTask], noLogs, []);
    expect(bundle.scope).toBe("all");
    expect(bundle.pets).toHaveLength(1);
    expect(bundle.pets[0].weight).toBe("۳.۵ کیلوگرم");
    expect(bundle.pets[0].tasks[0].scheduleText).toBe("هر روز ۰۸:۰۰، ۱۸:۰۰");
    expect(bundle.todayJalali).toMatch(/^[۰-۹]{4}\//);
  });

  it("filters to selected pets and their tasks only", () => {
    const otherPet: Pet = {
      ...basePet,
      id: "p2",
      name: "هاپو",
      species: "dog",
    };
    const bundle = buildPetContext([basePet, otherPet], [feedingTask], noLogs, [
      "p2",
    ]);
    expect(bundle.scope).toBe("selected");
    expect(bundle.pets.map((p) => p.name)).toEqual(["هاپو"]);
    expect(bundle.pets[0].tasks).toEqual([]);
  });

  it("skips inactive tasks and handles null weight", () => {
    const bundle = buildPetContext(
      [{ ...basePet, weightValue: null, weightUnit: null }],
      [{ ...feedingTask, active: false }],
      noLogs,
      [],
    );
    expect(bundle.pets[0].weight).toBeNull();
    expect(bundle.pets[0].tasks).toEqual([]);
  });
});
