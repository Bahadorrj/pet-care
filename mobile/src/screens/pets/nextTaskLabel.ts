import {
  tehranDayOffset,
  tehranDayOfWeek,
  toTehranTime,
} from "../../lib/taskSchedule";
import { toPersianDigits, utcIsoToTehranShortJalali } from "../../lib/jalali";

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

type T = (key: string, opts?: Record<string, unknown>) => string;

function weekdayLabel(t: T, isoUtc: string): string {
  return t(
    `tasks.weekday_full.${WEEKDAY_KEYS[tehranDayOfWeek(new Date(isoUtc))]}`,
  );
}

/** Localized "next occurrence" label — time only for today, else relative day + time. */
export function nextTaskLabel(
  t: T,
  isoUtc: string,
  now: Date = new Date(),
): string {
  const time = toPersianDigits(toTehranTime(isoUtc));
  const offset = tehranDayOffset(isoUtc, now);
  if (offset <= 0) return t("pets.next_task_today", { time });
  if (offset === 1) return t("pets.next_task_tomorrow", { time });
  return t("pets.next_task_weekday", {
    weekday: weekdayLabel(t, isoUtc),
    time,
  });
}

export interface NextTaskRowParts {
  /** Calendar date + relative day — "۲۳/۴، سه‌شنبه". */
  primary: string;
  /** Time only — "۹:۰۰". */
  secondary: string;
}

/** Two-line variant for task-row display: date + relative day on top, time below. */
export function nextTaskRowParts(
  t: T,
  isoUtc: string,
  now: Date = new Date(),
): NextTaskRowParts {
  const time = toPersianDigits(toTehranTime(isoUtc));
  const date = toPersianDigits(utcIsoToTehranShortJalali(isoUtc));
  const offset = tehranDayOffset(isoUtc, now);
  const day =
    offset <= 0
      ? t("pets.task_row.today")
      : offset === 1
        ? t("pets.task_row.tomorrow")
        : weekdayLabel(t, isoUtc);
  return {
    primary: t("pets.task_row.date_day", { date, day }),
    secondary: time,
  };
}
