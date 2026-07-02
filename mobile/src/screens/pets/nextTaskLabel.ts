import {
  tehranDayOffset,
  tehranDayOfWeek,
  toTehranTime,
} from "../../lib/taskSchedule";
import { toPersianDigits } from "../../lib/jalali";

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/** Localized "next occurrence" label — time only for today, else relative day + time. */
export function nextTaskLabel(
  t: (key: string, opts?: Record<string, unknown>) => string,
  isoUtc: string,
  now: Date = new Date(),
): string {
  const time = toPersianDigits(toTehranTime(isoUtc));
  const offset = tehranDayOffset(isoUtc, now);
  if (offset <= 0) return t("pets.next_task_today", { time });
  if (offset === 1) return t("pets.next_task_tomorrow", { time });
  const weekday = t(
    `tasks.weekday_full.${WEEKDAY_KEYS[tehranDayOfWeek(new Date(isoUtc))]}`,
  );
  return t("pets.next_task_weekday", { weekday, time });
}
