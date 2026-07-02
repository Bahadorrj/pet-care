/**
 * Builds the per-message pet-context bundle sent to the chat backend
 * (spec 13, ADR-0019). Pure function — screens supply store data and a
 * log getter; shapes mirror backend/app/schemas/chat.py exactly.
 */
import type { Pet, Schedule, Task, TaskLog } from "../db/types";
import { adherence } from "./taskSchedule";
import {
  tehranTodayJalali,
  toPersianDigits,
  utcIsoToTehranJalali,
} from "./jalali";

export interface PetTaskSummaryCtx {
  type: string;
  title: string | null;
  scheduleText: string;
  adherence7d: string | null;
}

export interface PetCtx {
  name: string;
  species: string;
  speciesOther: string | null;
  gender: string | null;
  breed: string | null;
  weight: string | null;
  notes: string | null;
  tasks: PetTaskSummaryCtx[];
}

export interface PetContextBundle {
  pets: PetCtx[];
  scope: "selected" | "all";
  todayJalali: string;
}

// db/types Schedule uses 0=Sun for weekdays
const WEEKDAYS_FA = [
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
  "شنبه",
];

const UNITS_FA = { hours: "ساعت", days: "روز", months: "ماه" } as const;

export function scheduleText(s: Schedule): string {
  switch (s.kind) {
    case "daily_times":
      return `هر روز ${toPersianDigits(s.times.join("، "))}`;
    case "weekdays":
      return `${s.days.map((d) => WEEKDAYS_FA[d]).join("، ")} ${toPersianDigits(
        s.times.join("، "),
      )}`;
    case "interval":
      return `هر ${toPersianDigits(s.n)} ${UNITS_FA[s.unit]}`;
    case "one_off":
      return `یک‌بار در ${toPersianDigits(utcIsoToTehranJalali(s.at))}`;
  }
}

export function buildPetContext(
  pets: Pet[],
  tasks: Task[],
  getLogs: (taskId: string) => TaskLog[],
  selectedPetIds: string[],
): PetContextBundle {
  const scope = selectedPetIds.length > 0 ? "selected" : "all";
  const included =
    scope === "selected"
      ? pets.filter((p) => selectedPetIds.includes(p.id))
      : pets;
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  return {
    scope,
    todayJalali: toPersianDigits(tehranTodayJalali()),
    pets: included.map((p) => ({
      name: p.name,
      species: p.species,
      speciesOther: p.speciesOther,
      gender: p.gender,
      breed: p.breed,
      weight:
        p.weightValue != null
          ? `${toPersianDigits(p.weightValue)} ${
              p.weightUnit === "g" ? "گرم" : "کیلوگرم"
            }`
          : null,
      notes: p.notes,
      tasks: tasks
        .filter((t) => t.petId === p.id && t.active)
        .map((t) => {
          const ratio = adherence(t, getLogs(t.id), since);
          return {
            type: t.type,
            title: t.title,
            scheduleText: scheduleText(t.schedule),
            adherence7d:
              ratio == null
                ? null
                : `${toPersianDigits(Math.round(ratio * 100))}٪`,
          };
        }),
    })),
  };
}
