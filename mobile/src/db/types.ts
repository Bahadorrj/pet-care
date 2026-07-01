export type Species = "dog" | "cat" | "bird" | "rabbit" | "other";
export type Gender = "male" | "female";

export interface Pet {
  id: string; // uuid
  name: string;
  species: Species;
  speciesOther: string | null;
  gender: Gender | null;
  photoUri: string | null;
  notes: string | null;
  createdAt: string; // UTC ISO
  updatedAt: string; // UTC ISO
}

// Task types

export type TaskType =
  | "feeding"
  | "water"
  | "meds"
  | "play"
  | "grooming"
  | "vet"
  | "other";
export type EndKind = "never" | "until" | "after_n";

export type Schedule =
  | { kind: "daily_times"; times: string[] } // ["08:00","18:00"]
  | { kind: "weekdays"; days: number[]; times: string[] } // days 0..6, 0=Sun
  | {
      kind: "interval";
      n: number;
      unit: "hours" | "days" | "months";
      anchor: string;
    } // anchor = UTC ISO of first occurrence
  | { kind: "one_off"; at: string }; // at = UTC ISO

export interface Task {
  id: string;
  petId: string;
  type: TaskType;
  title: string | null;
  schedule: Schedule;
  endKind: EndKind;
  endUntil: string | null; // UTC ISO
  endCount: number | null;
  active: boolean;
  createdAt: string; // UTC ISO
  updatedAt: string;
}

export interface TaskLog {
  id: string;
  taskId: string;
  dueAt: string; // UTC ISO
  status: "done" | "skipped";
  createdAt: string;
}

// A derived view, not a table row:
export interface Occurrence {
  task: Task;
  dueAt: string; // UTC ISO
  status: "pending" | "done" | "skipped" | "missed";
}
