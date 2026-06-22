# Today → Tasks Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the read-only Today tab into a todo hub with Overdue / Today / Next-7-days sections, quick ad-hoc task creation, pet+type filters, a daily progress counter, checkbox completion with undo, and a per-row action sheet.

**Architecture:** No new tables. Occurrences are derived over a `[today−7d, today+7d)` UTC window via the existing pure `occurrencesForDay` engine, then bucketed by a new pure helper. Ad-hoc todos are `one_off` chores (`type: 'other'`). Two small data-layer additions (`getLogsInRange`, `removeLog`) back log-window loading and undo. The Today tab is wrapped in a stack so rows can navigate to the existing `ChoreFormScreen` for Edit / "More options".

**Tech Stack:** Expo SDK 56, React Native, TypeScript, Zustand, react-navigation (bottom-tabs + native-stack), i18next (fa, RTL), jest-expo + @testing-library/react-native. Design tokens from `src/theme/theme.ts`.

## Global Constraints

- Tehran time is a fixed **+03:30** offset (no DST). Times shown/entered are Tehran wall-clock; stored `dueAt`/`at` are UTC ISO. Convert via `toUtcIso` / the +210min shift.
- `tsc --noEmit` must be **0 errors** — this is the gate (no lint script). Run `npx tsc --noEmit` from `mobile/`.
- i18n keys are **flat** (`keySeparator`/`nsSeparator` disabled): `"today.section.overdue"` is a literal key. All user-facing strings live in `src/i18n/fa.json`. Persian/Farsi copy only.
- Use theme tokens (`colors`, `spacing`, `radius`, `typography`, `fonts`) — never hard-code. Touch targets ≥ 44pt for primary actions.
- Reuse UI primitives in `src/components/ui/` (`Button`, `TextField`).
- Native modules (`@notifee/react-native`, `expo-sqlite`, `expo-crypto`) are mocked in tests.
- Overdue look-back and upcoming look-ahead are both **7 days** (`LOOKBACK_DAYS` / `LOOKAHEAD_DAYS`).
- Run a single jest file with `npx jest src/__tests__/<file>` from `mobile/`.

---

## File Structure

**New files:**
- `mobile/src/lib/taskBuckets.ts` — pure: Tehran day range, full compute window, bucket an `Occurrence[]` into overdue/today/upcoming.
- `mobile/src/navigation/TodayStack.tsx` — native stack wrapping the Tasks list + `ChoreFormScreen`.
- `mobile/src/screens/today/QuickAddSheet.tsx` — modal sheet to create a `one_off` `other` chore.
- `mobile/src/__tests__/taskBuckets.test.ts` — unit tests for bucketing.
- `mobile/src/__tests__/QuickAddSheet.test.tsx` — component tests for quick-add.

**Modified files:**
- `mobile/src/db/chores.ts` — add `getLogsInRange`, `removeLog`.
- `mobile/src/store/choresStore.ts` — add `windowOccurrences` state + `unmarkOccurrence`; compute window on every mutation.
- `mobile/src/screens/chores/ChoreFormScreen.tsx` — `export` three existing pure helpers (`tehranTodayJalali`, `jalaliToGregorian`, `isValidTime`) for reuse.
- `mobile/src/navigation/RootNavigator.tsx` — point the Today tab at `TodayStack`.
- `mobile/src/screens/today/TodayScreen.tsx` — full rewrite (sections, filters, progress, checkbox+undo, action sheet, FAB).
- `mobile/src/i18n/fa.json` — new `today.*` keys.
- `mobile/src/__tests__/choresStore.test.ts` — extend the expo-sqlite mock for the new SQL; add `unmarkOccurrence` + `windowOccurrences` tests.
- `mobile/src/__tests__/RootNavigator.test.tsx` — extend the choresStore mock with `windowOccurrences`/`unmarkOccurrence`.
- `mobile/src/__tests__/TodayScreen.test.tsx` — rewrite for the new UI.
- `mobile/CLAUDE.md` — refresh the stale tab description.

---

## Task 1: Pure bucketing helper

**Files:**
- Create: `mobile/src/lib/taskBuckets.ts`
- Test: `mobile/src/__tests__/taskBuckets.test.ts`

**Interfaces:**
- Consumes: `Occurrence` from `../db/types`.
- Produces:
  - `LOOKBACK_DAYS = 7`, `LOOKAHEAD_DAYS = 7` (numbers)
  - `tehranTodayUtcRange(now: Date): { start: number; end: number }` — UTC ms of the Tehran calendar day containing `now`.
  - `taskWindowUtcRange(now: Date): { start: number; end: number }` — `[start−7d, end+7d)` in UTC ms.
  - `BucketedOccurrences { overdue: Occurrence[]; today: Occurrence[]; upcoming: Occurrence[] }`
  - `bucketOccurrences(occs: Occurrence[], now: Date): BucketedOccurrences`

- [ ] **Step 1: Write the failing test**

Create `mobile/src/__tests__/taskBuckets.test.ts`:

```typescript
import {
  tehranTodayUtcRange,
  taskWindowUtcRange,
  bucketOccurrences,
  LOOKBACK_DAYS,
  LOOKAHEAD_DAYS,
} from '../lib/taskBuckets';
import type { Occurrence } from '../db/types';

// now = Tehran 2026-06-20 10:00  → UTC 2026-06-20T06:30:00Z
const NOW = new Date('2026-06-20T06:30:00.000Z');

const make = (id: string, dueAt: string, status: Occurrence['status'] = 'pending'): Occurrence => ({
  chore: {
    id,
    petId: 'pet-1',
    type: 'feeding',
    title: null,
    schedule: { kind: 'daily_times', times: ['08:00'] },
    endKind: 'never',
    endUntil: null,
    endCount: null,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  dueAt,
  status,
});

describe('taskBuckets – Tehran day range', () => {
  test('tehranTodayUtcRange spans Tehran midnight→midnight in UTC', () => {
    const { start, end } = tehranTodayUtcRange(NOW);
    // Tehran 2026-06-20 00:00 = UTC 2026-06-19T20:30:00Z
    expect(new Date(start).toISOString()).toBe('2026-06-19T20:30:00.000Z');
    expect(end - start).toBe(24 * 60 * 60 * 1000);
  });

  test('taskWindowUtcRange extends ±7 days around the Tehran day', () => {
    const day = tehranTodayUtcRange(NOW);
    const win = taskWindowUtcRange(NOW);
    expect(day.start - win.start).toBe(LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    expect(win.end - day.end).toBe(LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);
  });
});

describe('taskBuckets – bucketOccurrences', () => {
  test('places occurrences in overdue / today / upcoming', () => {
    const yesterday = make('a', '2026-06-19T05:00:00.000Z', 'missed'); // before today start
    const todayOcc = make('b', '2026-06-20T03:00:00.000Z', 'pending'); // within today
    const inThreeDays = make('c', '2026-06-23T05:00:00.000Z', 'pending'); // upcoming
    const result = bucketOccurrences([inThreeDays, todayOcc, yesterday], NOW);
    expect(result.overdue.map((o) => o.chore.id)).toEqual(['a']);
    expect(result.today.map((o) => o.chore.id)).toEqual(['b']);
    expect(result.upcoming.map((o) => o.chore.id)).toEqual(['c']);
  });

  test('done/skipped past occurrences are excluded from overdue', () => {
    const donePast = make('d', '2026-06-19T05:00:00.000Z', 'done');
    const skippedPast = make('e', '2026-06-19T05:00:00.000Z', 'skipped');
    const result = bucketOccurrences([donePast, skippedPast], NOW);
    expect(result.overdue).toHaveLength(0);
  });

  test('overdue older than the 7-day look-back is dropped', () => {
    const old = make('f', '2026-06-10T05:00:00.000Z', 'missed'); // 10 days before
    const result = bucketOccurrences([old], NOW);
    expect(result.overdue).toHaveLength(0);
  });

  test('upcoming beyond the 7-day look-ahead is dropped', () => {
    const far = make('g', '2026-06-29T05:00:00.000Z', 'pending'); // 9 days ahead
    const result = bucketOccurrences([far], NOW);
    expect(result.upcoming).toHaveLength(0);
  });

  test('each bucket is sorted chronologically by dueAt', () => {
    const later = make('h', '2026-06-23T05:00:00.000Z');
    const sooner = make('i', '2026-06-22T05:00:00.000Z');
    const result = bucketOccurrences([later, sooner], NOW);
    expect(result.upcoming.map((o) => o.chore.id)).toEqual(['i', 'h']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/__tests__/taskBuckets.test.ts`
Expected: FAIL — "Cannot find module '../lib/taskBuckets'".

- [ ] **Step 3: Write the implementation**

Create `mobile/src/lib/taskBuckets.ts`:

```typescript
/**
 * Pure bucketing for the Tasks tab — no I/O.
 * Splits a window of Occurrences into overdue / today / upcoming relative to
 * the Tehran calendar day. Overdue look-back and upcoming look-ahead are both
 * capped at 7 days so recurring chores don't pile up forever.
 */

import type { Occurrence } from '../db/types';

// ponytail: fixed +03:30, mirrors choreSchedule
const TEHRAN_OFFSET_MS = (3 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const LOOKBACK_DAYS = 7;
export const LOOKAHEAD_DAYS = 7;

/** UTC ms range of the Tehran calendar day containing `now`. */
export function tehranTodayUtcRange(now: Date): { start: number; end: number } {
  const tehran = new Date(now.getTime() + TEHRAN_OFFSET_MS);
  const tehranMidnightAsUtc = Date.UTC(
    tehran.getUTCFullYear(),
    tehran.getUTCMonth(),
    tehran.getUTCDate(),
  );
  const start = tehranMidnightAsUtc - TEHRAN_OFFSET_MS; // UTC instant of Tehran 00:00
  return { start, end: start + DAY_MS };
}

/** Full compute window for the tab: [today−7d, today+7d) in UTC ms. */
export function taskWindowUtcRange(now: Date): { start: number; end: number } {
  const { start, end } = tehranTodayUtcRange(now);
  return { start: start - LOOKBACK_DAYS * DAY_MS, end: end + LOOKAHEAD_DAYS * DAY_MS };
}

export interface BucketedOccurrences {
  overdue: Occurrence[];
  today: Occurrence[];
  upcoming: Occurrence[];
}

const byDue = (a: Occurrence, b: Occurrence): number =>
  a.dueAt < b.dueAt ? -1 : a.dueAt > b.dueAt ? 1 : 0;

export function bucketOccurrences(occs: Occurrence[], now: Date): BucketedOccurrences {
  const { start, end } = tehranTodayUtcRange(now);
  const lookbackStart = start - LOOKBACK_DAYS * DAY_MS;
  const lookaheadEnd = end + LOOKAHEAD_DAYS * DAY_MS;

  const overdue: Occurrence[] = [];
  const today: Occurrence[] = [];
  const upcoming: Occurrence[] = [];

  for (const o of occs) {
    const ms = new Date(o.dueAt).getTime();
    if (ms < start) {
      if (ms >= lookbackStart && o.status !== 'done' && o.status !== 'skipped') {
        overdue.push(o);
      }
    } else if (ms < end) {
      today.push(o);
    } else if (ms < lookaheadEnd) {
      upcoming.push(o);
    }
  }

  overdue.sort(byDue);
  today.sort(byDue);
  upcoming.sort(byDue);
  return { overdue, today, upcoming };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/__tests__/taskBuckets.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/lib/taskBuckets.ts mobile/src/__tests__/taskBuckets.test.ts
git commit -m "feat(today): pure occurrence bucketing helper"
```

---

## Task 2: DB log helpers + store window/undo

**Files:**
- Modify: `mobile/src/db/chores.ts` (add two functions after `getLogsForDay`, ~line 180)
- Modify: `mobile/src/store/choresStore.ts`
- Test: `mobile/src/__tests__/choresStore.test.ts` (extend mock + add tests)

**Interfaces:**
- Consumes: `taskWindowUtcRange` from `../lib/taskBuckets`; `occurrencesForDay` from `../lib/choreSchedule`.
- Produces:
  - `getLogsInRange(startIso: string, endIso: string): ChoreLog[]` (db)
  - `removeLog(choreId: string, dueAt: string): void` (db)
  - store state field `windowOccurrences: Occurrence[]`
  - store action `unmarkOccurrence(choreId: string, dueAt: string): Promise<void>`

- [ ] **Step 1: Extend the expo-sqlite mock in `choresStore.test.ts`**

The new SQL would be misrouted by the existing mock branches. In `mobile/src/__tests__/choresStore.test.ts`:

In `runSync`, **before** the existing `if (u.startsWith('DELETE FROM CHORE_LOGS WHERE CHORE_ID')` block (~line 102), add a chore_id+due_at delete branch:

```typescript
      if (u.startsWith('DELETE FROM CHORE_LOGS') && u.includes('AND DUE_AT')) {
        const [chore_id, due_at] = params as string[];
        s.chore_logs = s.chore_logs.filter(
          (r) => !(r.chore_id === chore_id && r.due_at === due_at),
        );
        return;
      }
```

In `getAllSync`, **before** the existing `if (u.includes('FROM CHORE_LOGS') && u.includes('AND DUE_AT') && !u.includes('LIKE'))` block (~line 130), add a range branch:

```typescript
      // getLogsInRange (due_at >= ? AND due_at < ?)
      if (u.includes('FROM CHORE_LOGS') && u.includes('>=')) {
        const [startIso, endIso] = params as string[];
        return s.chore_logs.filter(
          (r) => (r.due_at as string) >= startIso && (r.due_at as string) < endIso,
        ) as unknown as T[];
      }
```

- [ ] **Step 2: Write the failing store tests**

Append to `mobile/src/__tests__/choresStore.test.ts`:

```typescript
// ---------------------------------------------------------------------------
// 9. windowOccurrences + unmarkOccurrence
// ---------------------------------------------------------------------------

describe('choresStore – windowOccurrences', () => {
  test('windowOccurrences includes a future (upcoming) occurrence beyond today', async () => {
    jest.setSystemTime(new Date('2026-06-18T10:00:00.000Z'));
    const { useChoresStore } = loadFreshChoresStore();
    await useChoresStore.getState().addChore(makeChoreInput()); // daily 08:00

    jest.setSystemTime(new Date('2026-06-20T06:30:00.000Z'));
    await useChoresStore.getState().load();

    const win = useChoresStore.getState().windowOccurrences;
    // daily chore → at least one occurrence strictly after today's end
    const todayEnd = new Date('2026-06-20T20:30:00.000Z').getTime(); // Tehran 06-21 00:00
    expect(win.some((o) => new Date(o.dueAt).getTime() >= todayEnd)).toBe(true);
  });
});

describe('choresStore – unmarkOccurrence', () => {
  test('unmark removes a done log so the occurrence reverts to missed/pending', async () => {
    jest.setSystemTime(new Date('2026-06-18T10:00:00.000Z'));
    const { useChoresStore } = loadFreshChoresStore();
    await useChoresStore.getState().addChore(makeChoreInput());

    jest.setSystemTime(new Date('2026-06-20T06:30:00.000Z'));
    await useChoresStore.getState().load();

    const occ = useChoresStore.getState().occurrences[0];
    await useChoresStore.getState().markOccurrence(occ.chore.id, occ.dueAt, 'done');
    expect(
      useChoresStore.getState().occurrences.find((o) => o.dueAt === occ.dueAt)?.status,
    ).toBe('done');

    await useChoresStore.getState().unmarkOccurrence(occ.chore.id, occ.dueAt);
    const reverted = useChoresStore.getState().occurrences.find((o) => o.dueAt === occ.dueAt);
    expect(reverted?.status).toBe('missed'); // past-due, no log
  });
});
```

- [ ] **Step 3: Run the new tests to verify they fail**

Run: `npx jest src/__tests__/choresStore.test.ts -t "windowOccurrences|unmarkOccurrence"`
Expected: FAIL — `windowOccurrences` undefined / `unmarkOccurrence is not a function`.

- [ ] **Step 4: Add the db helpers**

In `mobile/src/db/chores.ts`, after `getLogsForDay` (~line 180) add:

```typescript
export function getLogsInRange(startIso: string, endIso: string): ChoreLog[] {
  const rows = db.getAllSync<ChoreLogRow>(
    'SELECT * FROM chore_logs WHERE due_at >= ? AND due_at < ? ORDER BY due_at ASC',
    [startIso, endIso],
  );
  return rows.map(rowToChoreLog);
}

export function removeLog(choreId: string, dueAt: string): void {
  db.runSync('DELETE FROM chore_logs WHERE chore_id = ? AND due_at = ?', [choreId, dueAt]);
}
```

- [ ] **Step 5: Add window computation + unmark to the store**

In `mobile/src/store/choresStore.ts`:

Update the db import to include the new functions:

```typescript
import {
  insertChore,
  listChores,
  updateChore as dbUpdateChore,
  deleteChore as dbDeleteChore,
  logOccurrence,
  getLogsForDay,
  getLogsInRange,
  removeLog,
  getLogsForChore as dbGetLogsForChore,
} from '../db/chores';
```

Add the taskBuckets import below the existing `choreSchedule` import:

```typescript
import { taskWindowUtcRange } from '../lib/taskBuckets';
```

Add a window-compute helper after `computeTodayOccurrences` (~line 80):

```typescript
function computeWindowOccurrences(chores: Chore[]): Occurrence[] {
  const { start, end } = taskWindowUtcRange(new Date());
  const startIso = new Date(start).toISOString();
  const endIso = new Date(end).toISOString();
  const logs: ChoreLog[] = getLogsInRange(startIso, endIso);
  const activeChores = chores.filter((c) => c.active);
  return occurrencesForDay(activeChores, logs, { start: new Date(start), end: new Date(end) });
}
```

Extend the `ChoresState` interface — add the field and action:

```typescript
  occurrences: Occurrence[];
  windowOccurrences: Occurrence[];
```

```typescript
  markOccurrence: (choreId: string, dueAt: string, status: ChoreLog['status']) => Promise<void>;
  unmarkOccurrence: (choreId: string, dueAt: string) => Promise<void>;
```

In the store factory, seed the new field at init (next to `initialOccurrences`):

```typescript
  const initialChores = listChores();
  const initialOccurrences = computeTodayOccurrences(initialChores);
  const initialWindow = computeWindowOccurrences(initialChores);

  return {
    chores: initialChores,
    occurrences: initialOccurrences,
    windowOccurrences: initialWindow,
```

In **every** place that currently does `set({ chores, occurrences })` or `set({ occurrences })`, also set `windowOccurrences`. Concretely:

`load`:
```typescript
    load: async () => {
      const chores = listChores();
      const occurrences = computeTodayOccurrences(chores);
      const windowOccurrences = computeWindowOccurrences(chores);
      set({ chores, occurrences, windowOccurrences });
    },
```

`addChore`, `updateChore`, `deleteChore`, `toggleActive` each replace their
`const occurrences = ...; set({ chores, occurrences });` with:
```typescript
      const chores = listChores();
      const occurrences = computeTodayOccurrences(chores);
      const windowOccurrences = computeWindowOccurrences(chores);
      set({ chores, occurrences, windowOccurrences });
      _syncNotifications();
```

`markOccurrence` replaces its body's recompute/set with:
```typescript
    markOccurrence: async (choreId, dueAt, status) => {
      logOccurrence(choreId, dueAt, status);
      const chores = get().chores;
      const occurrences = computeTodayOccurrences(chores);
      const windowOccurrences = computeWindowOccurrences(chores);
      set({ occurrences, windowOccurrences });
      _syncNotifications();
    },
```

Add `unmarkOccurrence` after `markOccurrence`:
```typescript
    unmarkOccurrence: async (choreId, dueAt) => {
      removeLog(choreId, dueAt);
      const chores = get().chores;
      const occurrences = computeTodayOccurrences(chores);
      const windowOccurrences = computeWindowOccurrences(chores);
      set({ occurrences, windowOccurrences });
      _syncNotifications();
    },
```

- [ ] **Step 6: Run the store tests**

Run: `npx jest src/__tests__/choresStore.test.ts`
Expected: PASS (existing 8 groups + the 2 new ones).

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add mobile/src/db/chores.ts mobile/src/store/choresStore.ts mobile/src/__tests__/choresStore.test.ts
git commit -m "feat(today): window occurrences + unmark (undo) in chores store"
```

---

## Task 3: Today stack navigation

**Files:**
- Create: `mobile/src/navigation/TodayStack.tsx`
- Modify: `mobile/src/navigation/RootNavigator.tsx`
- Test: `mobile/src/__tests__/RootNavigator.test.tsx`

**Interfaces:**
- Produces: `TodayStackParamList { TodayMain: undefined; ChoreForm: { petId: string; choreId?: string } }`, `TodayNavigationProp`, default-export `TodayStack`.
- The tab keeps the route name **`Today`** (notifications navigate to `'Today'` — see `choreNotifications.ts:163`). The stack's initial route is `TodayMain`.

- [ ] **Step 1: Update the RootNavigator test's choresStore mock**

In `mobile/src/__tests__/RootNavigator.test.tsx`, extend the choresStore mock selector state (the screen will read `windowOccurrences` and `unmarkOccurrence`). Replace the mock factory's `selector({...})` object (~line 50) with:

```typescript
    selector({
      chores: [],
      occurrences: [],
      windowOccurrences: [],
      load: jest.fn().mockResolvedValue(undefined),
      markOccurrence: jest.fn().mockResolvedValue(undefined),
      unmarkOccurrence: jest.fn().mockResolvedValue(undefined),
    }),
```

Also widen the selector's param type to include the new members:

```typescript
    selector: (s: {
      chores: unknown[];
      occurrences: unknown[];
      windowOccurrences: unknown[];
      load: () => Promise<void>;
      markOccurrence: () => Promise<void>;
      unmarkOccurrence: () => Promise<void>;
    }) => unknown,
```

> The existing `RootNavigator` tests assert the three tab labels and that
> `today-empty` is visible by default — both still hold after wrapping Today in a
> stack whose initial route renders `TodayScreen` with empty `windowOccurrences`.

- [ ] **Step 2: Run the RootNavigator test to confirm the baseline still passes**

Run: `npx jest src/__tests__/RootNavigator.test.tsx`
Expected: PASS (no behavior change yet — mock widened only).

- [ ] **Step 3: Create the stack**

Create `mobile/src/navigation/TodayStack.tsx`:

```typescript
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import TodayScreen from '../screens/today/TodayScreen';
import ChoreFormScreen from '../screens/chores/ChoreFormScreen';
import { colors } from '../theme/theme';

export type TodayStackParamList = {
  TodayMain: undefined;
  ChoreForm: { petId: string; choreId?: string };
};

export type TodayNavigationProp = NativeStackNavigationProp<TodayStackParamList>;

const Stack = createNativeStackNavigator<TodayStackParamList>();

export default function TodayStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.ink,
        headerTitle: '',
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="TodayMain" component={TodayScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ChoreForm" component={ChoreFormScreen} />
    </Stack.Navigator>
  );
}
```

- [ ] **Step 4: Point the tab at the stack**

In `mobile/src/navigation/RootNavigator.tsx`:

Replace the import:
```typescript
import TodayScreen from '../screens/today/TodayScreen';
```
with:
```typescript
import TodayStack from './TodayStack';
```

Change the Today `Tab.Screen` `component`:
```typescript
      <Tab.Screen
        name="Today"
        component={TodayStack}
        options={{
          tabBarLabel: t('tab.today'),
          tabBarIcon: ({ color, size }) => <Ionicons name="today-outline" color={color} size={size} />,
        }}
      />
```

- [ ] **Step 5: Run the RootNavigator test + typecheck**

Run: `npx jest src/__tests__/RootNavigator.test.tsx`
Expected: PASS (tab labels render; `today-empty` visible via the stack's initial route).
Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/navigation/TodayStack.tsx mobile/src/navigation/RootNavigator.tsx mobile/src/__tests__/RootNavigator.test.tsx
git commit -m "feat(today): wrap Today tab in a navigation stack"
```

---

## Task 4: Quick-add sheet

**Files:**
- Modify: `mobile/src/screens/chores/ChoreFormScreen.tsx` (export 3 helpers)
- Modify: `mobile/src/i18n/fa.json` (quick-add keys — added here so the component renders real strings in tests)
- Create: `mobile/src/screens/today/QuickAddSheet.tsx`
- Test: `mobile/src/__tests__/QuickAddSheet.test.tsx`

**Interfaces:**
- Consumes: `maskTime` (already exported), and newly-exported `tehranTodayJalali`, `jalaliToGregorian`, `isValidTime` from `../chores/ChoreFormScreen`; `toUtcIso` from `../../lib/choreSchedule`; `useChoresStore` (`addChore`); `usePetsStore` (`pets`); `useNavigation<TodayNavigationProp>`.
- Produces: default-export `QuickAddSheet` with props `{ visible: boolean; onClose: () => void }`.

> **Deliberate simplification (ponytail):** "More options →" navigates to
> `ChoreForm` with the selected `petId` only; the typed title is **not** carried
> across (would require threading a new param through the stack + form state).
> Document with a `// ponytail:` comment.

- [ ] **Step 1: Export the three helpers from ChoreFormScreen**

In `mobile/src/screens/chores/ChoreFormScreen.tsx`, add the `export` keyword to these existing functions (no logic change):
- `function tehranTodayJalali()` → `export function tehranTodayJalali()`
- `function jalaliToGregorian(jalaliStr: string): string | null` → `export function jalaliToGregorian(...)`
- `function isValidTime(s: string): boolean` → `export function isValidTime(...)`

- [ ] **Step 2: Add quick-add i18n keys**

In `mobile/src/i18n/fa.json`, add (place near the existing `today.*` keys):

```json
  "today.quick.heading": "کار جدید",
  "today.quick.title": "عنوان",
  "today.quick.title_placeholder": "مثلاً خرید خاک گربه",
  "today.quick.pet": "حیوان",
  "today.quick.date": "تاریخ",
  "today.quick.time": "ساعت",
  "today.quick.add": "افزودن",
  "today.quick.more": "گزینه‌های بیشتر ←",
  "today.quick.no_pets": "ابتدا یک حیوان اضافه کنید",
  "today.quick.invalid": "تاریخ یا ساعت نامعتبر است",
  "today.quick.cancel": "انصراف",
```

- [ ] **Step 3: Write the failing component test**

Create `mobile/src/__tests__/QuickAddSheet.test.tsx`:

```typescript
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockAddChore = jest.fn().mockResolvedValue(undefined);
const mockNavigate = jest.fn();

jest.mock('../store/choresStore', () => ({
  useChoresStore: (selector: (s: { addChore: typeof mockAddChore }) => unknown) =>
    selector({ addChore: mockAddChore }),
}));

jest.mock('../store/petsStore', () => ({
  usePetsStore: (selector: (s: { pets: { id: string; name: string }[] }) => unknown) =>
    selector({ pets: [{ id: 'pet-1', name: 'رکسی' }] }),
}));

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

import '../i18n';
import QuickAddSheet from '../screens/today/QuickAddSheet';

beforeEach(() => {
  mockAddChore.mockClear();
  mockNavigate.mockClear();
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-06-20T06:30:00.000Z'));
});
afterEach(() => jest.useRealTimers());

describe('QuickAddSheet', () => {
  test('Add creates a one_off chore of type other with the typed title', async () => {
    const onClose = jest.fn();
    const { getByTestId } = render(<QuickAddSheet visible onClose={onClose} />);

    fireEvent.changeText(getByTestId('quickadd-title'), 'خرید خاک');
    fireEvent.changeText(getByTestId('quickadd-time'), '18:00');
    fireEvent.press(getByTestId('quickadd-add'));

    await waitFor(() => expect(mockAddChore).toHaveBeenCalledTimes(1));
    const arg = mockAddChore.mock.calls[0][0];
    expect(arg.type).toBe('other');
    expect(arg.title).toBe('خرید خاک');
    expect(arg.petId).toBe('pet-1');
    expect(arg.schedule.kind).toBe('one_off');
    expect(arg.endKind).toBe('never');
    expect(arg.active).toBe(true);
    expect(onClose).toHaveBeenCalled();
  });

  test('More options navigates to ChoreForm with the selected pet', () => {
    const { getByTestId } = render(<QuickAddSheet visible onClose={jest.fn()} />);
    fireEvent.press(getByTestId('quickadd-more'));
    expect(mockNavigate).toHaveBeenCalledWith('ChoreForm', { petId: 'pet-1' });
  });

  test('invalid time shows an error and does not create', async () => {
    const { getByTestId, queryByText } = render(<QuickAddSheet visible onClose={jest.fn()} />);
    fireEvent.changeText(getByTestId('quickadd-title'), 'x');
    fireEvent.changeText(getByTestId('quickadd-time'), '99:99');
    fireEvent.press(getByTestId('quickadd-add'));
    await waitFor(() => expect(queryByText('تاریخ یا ساعت نامعتبر است')).toBeTruthy());
    expect(mockAddChore).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx jest src/__tests__/QuickAddSheet.test.tsx`
Expected: FAIL — "Cannot find module '../screens/today/QuickAddSheet'".

- [ ] **Step 5: Implement the sheet**

Create `mobile/src/screens/today/QuickAddSheet.tsx`:

```typescript
/**
 * QuickAddSheet — fast ad-hoc todo creation.
 * Creates a one_off chore (type 'other'). "More options" jumps to the full
 * ChoreFormScreen for recurring setups.
 * ponytail: plain RN Modal — no bottom-sheet lib installed.
 */

import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import { useChoresStore } from '../../store/choresStore';
import { usePetsStore } from '../../store/petsStore';
import { toUtcIso } from '../../lib/choreSchedule';
import {
  maskTime,
  isValidTime,
  tehranTodayJalali,
  jalaliToGregorian,
} from '../chores/ChoreFormScreen';
import type { TodayNavigationProp } from '../../navigation/TodayStack';
import { colors, fonts, radius, spacing, typography } from '../../theme/theme';

/** Tehran wall-clock HH:MM for the next round hour (capped at 23:00). */
function nextRoundHourTehran(): string {
  const tehranMs = Date.now() + (3 * 60 + 30) * 60 * 1000;
  const h = new Date(tehranMs).getUTCHours();
  // ponytail: cap at 23:00 — a 23:xx "now" would otherwise roll to a past slot
  const next = Math.min(h + 1, 23);
  return `${String(next).padStart(2, '0')}:00`;
}

type Props = { visible: boolean; onClose: () => void };

export default function QuickAddSheet({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const navigation = useNavigation<TodayNavigationProp>();
  const pets = usePetsStore(useShallow((s) => s.pets));
  const addChore = useChoresStore((s) => s.addChore);

  const [title, setTitle] = useState('');
  const [petId, setPetId] = useState<string | null>(pets[0]?.id ?? null);
  const [date, setDate] = useState(tehranTodayJalali());
  const [time, setTime] = useState(nextRoundHourTehran());
  const [error, setError] = useState('');

  const reset = () => {
    setTitle('');
    setDate(tehranTodayJalali());
    setTime(nextRoundHourTehran());
    setError('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleAdd = async () => {
    if (!petId) {
      setError(t('today.quick.no_pets'));
      return;
    }
    const greg = jalaliToGregorian(date);
    if (!greg || !isValidTime(time)) {
      setError(t('today.quick.invalid'));
      return;
    }
    const at = toUtcIso(time, greg);
    await addChore({
      petId,
      type: 'other',
      title: title.trim() || null,
      schedule: { kind: 'one_off', at },
      endKind: 'never',
      endUntil: null,
      endCount: null,
      active: true,
    });
    close();
  };

  const handleMore = () => {
    if (!petId) {
      setError(t('today.quick.no_pets'));
      return;
    }
    // ponytail: title not carried to the full form — would need a new stack param
    navigation.navigate('ChoreForm', { petId });
    close();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} />
      <View style={styles.sheet}>
        <Text style={styles.heading}>{t('today.quick.heading')}</Text>

        <Text style={styles.label}>{t('today.quick.title')}</Text>
        <TextField
          testID="quickadd-title"
          placeholder={t('today.quick.title_placeholder')}
          value={title}
          onChangeText={setTitle}
          accessibilityLabel={t('today.quick.title')}
        />

        <Text style={styles.label}>{t('today.quick.pet')}</Text>
        {pets.length === 0 ? (
          <Text style={styles.noPets}>{t('today.quick.no_pets')}</Text>
        ) : (
          <View style={styles.chipRow}>
            {pets.map((p) => (
              <Pressable
                key={p.id}
                testID={`quickadd-pet-${p.id}`}
                onPress={() => setPetId(p.id)}
                style={[styles.chip, petId === p.id && styles.chipSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected: petId === p.id }}
              >
                <Text style={[styles.chipText, petId === p.id && styles.chipTextSelected]}>
                  {p.name}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.whenRow}>
          <View style={styles.whenCol}>
            <Text style={styles.label}>{t('today.quick.date')}</Text>
            <TextField
              testID="quickadd-date"
              value={date}
              onChangeText={(v) => { setDate(v); if (error) setError(''); }}
              keyboardType="numeric"
              accessibilityLabel={t('today.quick.date')}
            />
          </View>
          <View style={styles.whenCol}>
            <Text style={styles.label}>{t('today.quick.time')}</Text>
            <TextField
              testID="quickadd-time"
              value={time}
              onChangeText={(v) => { setTime(maskTime(time, v)); if (error) setError(''); }}
              keyboardType="numeric"
              accessibilityLabel={t('today.quick.time')}
            />
          </View>
        </View>

        {error !== '' && <Text style={styles.error}>{error}</Text>}

        <Pressable testID="quickadd-more" onPress={handleMore} style={styles.moreBtn}>
          <Text style={styles.moreText}>{t('today.quick.more')}</Text>
        </Pressable>

        <Button testID="quickadd-add" label={t('today.quick.add')} onPress={handleAdd} />
        <Pressable testID="quickadd-cancel" onPress={close} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>{t('today.quick.cancel')}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(26,26,23,0.35)' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  heading: {
    fontFamily: typography.title.fontFamily,
    fontSize: typography.title.fontSize,
    lineHeight: typography.title.lineHeight,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: fonts.semibold,
    color: colors.inkMuted,
    marginTop: spacing.sm,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: 44,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipText: { fontSize: typography.body.fontSize, fontFamily: fonts.regular, color: colors.inkMuted },
  chipTextSelected: { fontFamily: fonts.medium, color: colors.primary },
  noPets: { fontFamily: fonts.regular, fontSize: typography.body.fontSize, color: colors.inkMuted },
  whenRow: { flexDirection: 'row', gap: spacing.md },
  whenCol: { flex: 1 },
  error: {
    fontSize: typography.caption.fontSize,
    fontFamily: fonts.regular,
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  moreBtn: { minHeight: 44, justifyContent: 'center', marginTop: spacing.xs },
  moreText: { fontFamily: fonts.medium, fontSize: typography.body.fontSize, color: colors.primary },
  cancelBtn: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontFamily: fonts.medium, fontSize: typography.body.fontSize, color: colors.inkMuted },
});
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx jest src/__tests__/QuickAddSheet.test.tsx`
Expected: PASS (all three cases).

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add mobile/src/screens/today/QuickAddSheet.tsx mobile/src/screens/chores/ChoreFormScreen.tsx mobile/src/i18n/fa.json mobile/src/__tests__/QuickAddSheet.test.tsx
git commit -m "feat(today): quick-add sheet for ad-hoc one-off todos"
```

---

## Task 5: Tasks screen — sections, filters, progress, checkbox + undo

**Files:**
- Modify: `mobile/src/screens/today/TodayScreen.tsx` (full rewrite)
- Modify: `mobile/src/i18n/fa.json` (section/progress/filter/undo keys)
- Test: `mobile/src/__tests__/TodayScreen.test.tsx` (rewrite)

**Interfaces:**
- Consumes: `windowOccurrences`, `load`, `markOccurrence`, `unmarkOccurrence` from `useChoresStore`; `pets` from `usePetsStore`; `bucketOccurrences` + `tehranTodayUtcRange` from `../../lib/taskBuckets`.
- Produces (testIDs later tasks rely on): section headers `today-section-overdue|today|upcoming`; rows `today-row-${choreId}`; checkbox `today-check-${choreId}`; row body button `today-rowbtn-${choreId}`; progress `today-progress`; pet filter `today-filter-pet-all` / `today-filter-pet-${petId}`; type filter trigger `today-filter-type`; undo bar `today-undo` with `today-undo-btn`; empty `today-empty`; no-match `today-no-match`.

- [ ] **Step 1: Add section/progress/filter/undo i18n keys**

In `mobile/src/i18n/fa.json`, add:

```json
  "today.section.overdue": "عقب‌افتاده",
  "today.section.today": "امروز",
  "today.section.upcoming": "۷ روز آینده",
  "today.section.empty_overdue": "چیزی عقب نیفتاده",
  "today.section.empty_today": "کاری برای امروز نیست",
  "today.section.empty_upcoming": "برنامه‌ای برای روزهای آینده نیست",
  "today.progress": "{{done}} از {{total}} انجام شد",
  "today.filter.all": "همه",
  "today.filter.type": "نوع",
  "today.no_match": "کاری با این فیلترها پیدا نشد",
  "today.clear_filters": "پاک‌کردن فیلترها",
  "today.undo_done": "انجام شد",
  "today.undo": "بازگرداندن",
  "today.action.menu": "گزینه‌ها",
```

- [ ] **Step 2: Rewrite the TodayScreen test**

Replace the contents of `mobile/src/__tests__/TodayScreen.test.tsx` with:

```typescript
/**
 * TodayScreen (Tasks tab) tests.
 * The store mock exposes windowOccurrences; the screen buckets + filters them.
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

const mockLoad = jest.fn().mockResolvedValue(undefined);
const mockMark = jest.fn().mockResolvedValue(undefined);
const mockUnmark = jest.fn().mockResolvedValue(undefined);
let mockWindow: unknown[] = [];

jest.mock('../store/choresStore', () => ({
  useChoresStore: (selector: (s: {
    windowOccurrences: unknown[];
    load: typeof mockLoad;
    markOccurrence: typeof mockMark;
    unmarkOccurrence: typeof mockUnmark;
  }) => unknown) =>
    selector({
      windowOccurrences: mockWindow,
      load: mockLoad,
      markOccurrence: mockMark,
      unmarkOccurrence: mockUnmark,
    }),
}));

jest.mock('../store/petsStore', () => ({
  usePetsStore: (selector: (s: { pets: { id: string; name: string }[] }) => unknown) =>
    selector({ pets: [{ id: 'pet-1', name: 'رکسی' }, { id: 'pet-2', name: 'میا' }] }),
}));

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
  useNavigation: () => ({ navigate: jest.fn() }),
}));

import '../i18n';
import TodayScreen from '../screens/today/TodayScreen';
import type { Occurrence } from '../db/types';

// now is set per-test; build occurrences relative to it.
const NOW = new Date('2026-06-20T06:30:00.000Z'); // Tehran 2026-06-20 10:00

const make = (
  id: string,
  dueAt: string,
  status: Occurrence['status'] = 'pending',
  petId = 'pet-1',
  type: Occurrence['chore']['type'] = 'feeding',
): Occurrence => ({
  chore: {
    id, petId, type, title: null,
    schedule: { kind: 'daily_times', times: ['08:00'] },
    endKind: 'never', endUntil: null, endCount: null, active: true,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  },
  dueAt, status,
});

beforeEach(() => {
  mockLoad.mockClear();
  mockMark.mockClear();
  mockUnmark.mockClear();
  mockWindow = [];
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
});
afterEach(() => jest.useRealTimers());

describe('TodayScreen – empty', () => {
  test('shows the whole-screen empty state when window has no items', () => {
    mockWindow = [];
    const { getByTestId } = render(<TodayScreen />);
    expect(getByTestId('today-empty')).toBeTruthy();
  });
});

describe('TodayScreen – buckets', () => {
  test('renders overdue, today and upcoming sections with their rows', () => {
    mockWindow = [
      make('a', '2026-06-19T05:00:00.000Z', 'missed'),  // overdue
      make('b', '2026-06-20T03:00:00.000Z', 'pending'), // today
      make('c', '2026-06-23T05:00:00.000Z', 'pending'), // upcoming
    ];
    const { getByTestId } = render(<TodayScreen />);
    expect(getByTestId('today-section-overdue')).toBeTruthy();
    expect(getByTestId('today-section-today')).toBeTruthy();
    expect(getByTestId('today-section-upcoming')).toBeTruthy();
    expect(getByTestId('today-row-a')).toBeTruthy();
    expect(getByTestId('today-row-b')).toBeTruthy();
    expect(getByTestId('today-row-c')).toBeTruthy();
  });
});

describe('TodayScreen – progress', () => {
  test('counts done over actionable today items (skipped excluded)', () => {
    mockWindow = [
      make('b1', '2026-06-20T01:00:00.000Z', 'done'),
      make('b2', '2026-06-20T02:00:00.000Z', 'pending'),
      make('b3', '2026-06-20T03:00:00.000Z', 'missed'),
      make('b4', '2026-06-20T04:00:00.000Z', 'skipped'), // excluded from denominator
    ];
    const { getByTestId } = render(<TodayScreen />);
    // 1 done of (done+pending+missed)=3
    expect(getByTestId('today-progress')).toHaveTextContent('۱ از ۳');
  });
});

describe('TodayScreen – filters', () => {
  test('pet filter narrows rows to the selected pet', () => {
    mockWindow = [
      make('p1', '2026-06-20T03:00:00.000Z', 'pending', 'pet-1'),
      make('p2', '2026-06-20T04:00:00.000Z', 'pending', 'pet-2'),
    ];
    const { getByTestId, queryByTestId } = render(<TodayScreen />);
    fireEvent.press(getByTestId('today-filter-pet-pet-2'));
    expect(queryByTestId('today-row-p1')).toBeNull();
    expect(getByTestId('today-row-p2')).toBeTruthy();
  });
});

describe('TodayScreen – checkbox + undo', () => {
  test('checking marks done; undo reverts via unmarkOccurrence', async () => {
    const occ = make('x', '2026-06-20T03:00:00.000Z', 'pending');
    mockWindow = [occ];
    const { getByTestId } = render(<TodayScreen />);

    fireEvent.press(getByTestId('today-check-x'));
    await waitFor(() => expect(mockMark).toHaveBeenCalledWith('x', occ.dueAt, 'done'));

    fireEvent.press(getByTestId('today-undo-btn'));
    await waitFor(() => expect(mockUnmark).toHaveBeenCalledWith('x', occ.dueAt));
  });

  test('the undo bar auto-dismisses after the timeout', () => {
    const occ = make('y', '2026-06-20T03:00:00.000Z', 'pending');
    mockWindow = [occ];
    const { getByTestId, queryByTestId } = render(<TodayScreen />);
    fireEvent.press(getByTestId('today-check-y'));
    expect(getByTestId('today-undo')).toBeTruthy();
    act(() => { jest.advanceTimersByTime(4500); });
    expect(queryByTestId('today-undo')).toBeNull();
  });
});
```

> Note: the progress assertion uses Persian digits (`۱ از ۳`) because i18next
> renders interpolated numbers as-is; the screen formats counts with
> `toLocaleString('fa-IR')` (Step 3). If `toHaveTextContent` matching proves
> brittle across environments, assert on `today-progress` existence + a
> `toLocaleString('fa-IR')` of the numbers built in the test.

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx jest src/__tests__/TodayScreen.test.tsx`
Expected: FAIL — screen still reads `occurrences`, has no sections/filters/progress/checkbox testIDs.

- [ ] **Step 4: Rewrite TodayScreen**

Replace the contents of `mobile/src/screens/today/TodayScreen.tsx` with:

```typescript
import React from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { useChoresStore } from '../../store/choresStore';
import { usePetsStore } from '../../store/petsStore';
import { bucketOccurrences } from '../../lib/taskBuckets';
import QuickAddSheet from './QuickAddSheet';
import RowActionSheet from './RowActionSheet';
import { colors, fonts, radius, spacing, typography } from '../../theme/theme';
import { CHORE_TYPE_ICON } from '../../theme/icons';
import type { TodayNavigationProp } from '../../navigation/TodayStack';
import type { ChoreType, Occurrence } from '../../db/types';

const ALL_TYPES: ChoreType[] = ['feeding', 'meds', 'play', 'grooming', 'vet', 'other'];

function toTehranTime(isoUtc: string): string {
  const tehranMs = new Date(isoUtc).getTime() + (3 * 60 + 30) * 60 * 1000;
  const d = new Date(tehranMs);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

function isOverdue(occ: Occurrence): boolean {
  return (
    occ.status === 'missed' ||
    (occ.status === 'pending' && occ.dueAt < new Date().toISOString())
  );
}

// Today bucket: overdue-first then chronological (stale-pending handling).
function sortToday(occs: Occurrence[]): Occurrence[] {
  return [...occs].sort((a, b) => {
    const ao = isOverdue(a) ? 0 : 1;
    const bo = isOverdue(b) ? 0 : 1;
    if (ao !== bo) return ao - bo;
    return a.dueAt < b.dueAt ? -1 : a.dueAt > b.dueAt ? 1 : 0;
  });
}

const STATUS_COLOR: Record<Occurrence['status'], string> = {
  pending: colors.inkMuted,
  missed: colors.danger,
  done: colors.primary,
  skipped: colors.inkMuted,
};

// ── Row ─────────────────────────────────────────────────────────────────────
type RowProps = {
  occ: Occurrence;
  petName: string;
  onToggleDone: () => void;
  onOpenMenu: () => void;
};

function TaskRow({ occ, petName, onToggleDone, onOpenMenu }: RowProps) {
  const { t } = useTranslation();
  const { chore, dueAt, status } = occ;
  const isDone = status === 'done';
  const isSkipped = status === 'skipped';
  const overdue = isOverdue(occ);

  return (
    <View testID={`today-row-${chore.id}`} style={[styles.row, overdue && styles.rowOverdue]}>
      <Pressable
        testID={`today-check-${chore.id}`}
        onPress={onToggleDone}
        style={styles.checkbox}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isDone }}
        accessibilityLabel={t('chores.action.done')}
      >
        <Ionicons
          name={isDone ? 'checkbox' : 'square-outline'}
          size={24}
          color={isDone ? colors.primary : colors.inkFaint}
        />
      </Pressable>

      <Pressable
        testID={`today-rowbtn-${chore.id}`}
        onPress={onOpenMenu}
        style={styles.rowBody}
        accessibilityRole="button"
        accessibilityLabel={t('today.action.menu')}
      >
        <MaterialCommunityIcons
          name={CHORE_TYPE_ICON[chore.type]}
          size={22}
          color={colors.primary}
          style={styles.typeIcon}
        />
        <View style={styles.rowInfo}>
          <Text style={styles.petName} numberOfLines={1}>{petName}</Text>
          <Text
            style={[styles.choreTitle, (isDone || isSkipped) && styles.choreTitleDone]}
            numberOfLines={1}
          >
            {chore.title ?? t(`chores.type.${chore.type}`)}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.time}>{toTehranTime(dueAt)}</Text>
            <View style={[styles.badge, { backgroundColor: STATUS_COLOR[status] + '22' }]}>
              <Text style={[styles.badgeText, { color: STATUS_COLOR[status] }]}>
                {t(`chores.status.${status}`)}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

// ── Screen ──────────────────────────────────────────────────────────────────
export default function TodayScreen() {
  const { t } = useTranslation();
  const isFocused = useIsFocused();
  const navigation = useNavigation<TodayNavigationProp>();

  const windowOccurrences = useChoresStore((s) => s.windowOccurrences);
  const load = useChoresStore((s) => s.load);
  const markOccurrence = useChoresStore((s) => s.markOccurrence);
  const unmarkOccurrence = useChoresStore((s) => s.unmarkOccurrence);
  const pets = usePetsStore(useShallow((s) => s.pets));

  const [petFilter, setPetFilter] = React.useState<string | null>(null); // null = all
  const [typeFilter, setTypeFilter] = React.useState<ChoreType[]>([]); // empty = all
  const [typeSheet, setTypeSheet] = React.useState(false);
  const [quickAdd, setQuickAdd] = React.useState(false);
  const [menuOcc, setMenuOcc] = React.useState<Occurrence | null>(null);
  const [undo, setUndo] = React.useState<{ choreId: string; dueAt: string } | null>(null);
  const undoTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (isFocused) load();
  }, [isFocused, load]);

  React.useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current); }, []);

  const petNameById = React.useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of pets) m[p.id] = p.name;
    return m;
  }, [pets]);

  const filtered = React.useMemo(() => {
    return windowOccurrences.filter((o) => {
      if (petFilter && o.chore.petId !== petFilter) return false;
      if (typeFilter.length > 0 && !typeFilter.includes(o.chore.type)) return false;
      return true;
    });
  }, [windowOccurrences, petFilter, typeFilter]);

  const buckets = React.useMemo(() => bucketOccurrences(filtered, new Date()), [filtered]);

  // Progress: today only, done / (done + pending + missed)
  const progress = React.useMemo(() => {
    const today = buckets.today;
    const done = today.filter((o) => o.status === 'done').length;
    const total = today.filter((o) => o.status !== 'skipped').length;
    return { done, total };
  }, [buckets.today]);

  const onToggleDone = (occ: Occurrence) => {
    if (occ.status === 'done') {
      unmarkOccurrence(occ.chore.id, occ.dueAt);
      return;
    }
    markOccurrence(occ.chore.id, occ.dueAt, 'done');
    setUndo({ choreId: occ.chore.id, dueAt: occ.dueAt });
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 4000);
  };

  const onUndo = () => {
    if (!undo) return;
    unmarkOccurrence(undo.choreId, undo.dueAt);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo(null);
  };

  const sections = [
    { key: 'overdue', title: t('today.section.overdue'), empty: t('today.section.empty_overdue'), data: buckets.overdue },
    { key: 'today', title: t('today.section.today'), empty: t('today.section.empty_today'), data: sortToday(buckets.today) },
    { key: 'upcoming', title: t('today.section.upcoming'), empty: t('today.section.empty_upcoming'), data: buckets.upcoming },
  ];

  const hasAny = windowOccurrences.length > 0;
  const hasMatch = filtered.length > 0;
  const filtersActive = petFilter !== null || typeFilter.length > 0;

  if (!hasAny) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.empty} testID="today-empty">
          <MaterialCommunityIcons name="leaf" size={48} color={colors.inkFaint} />
          <Text style={styles.emptyTitle}>{t('today.empty_title')}</Text>
          <Text style={styles.emptySubtitle}>{t('today.empty_subtitle')}</Text>
        </View>
        <Fab onPress={() => setQuickAdd(true)} label={t('today.quick.heading')} />
        <QuickAddSheet visible={quickAdd} onClose={() => setQuickAdd(false)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Progress */}
      {progress.total > 0 && (
        <Text style={styles.progress} testID="today-progress">
          {t('today.progress', {
            done: progress.done.toLocaleString('fa-IR'),
            total: progress.total.toLocaleString('fa-IR'),
          })}
        </Text>
      )}

      {/* Filters */}
      <View style={styles.filterBar}>
        <Pressable
          testID="today-filter-pet-all"
          onPress={() => setPetFilter(null)}
          style={[styles.fchip, petFilter === null && styles.fchipOn]}
        >
          <Text style={[styles.fchipText, petFilter === null && styles.fchipTextOn]}>
            {t('today.filter.all')}
          </Text>
        </Pressable>
        {pets.map((p) => (
          <Pressable
            key={p.id}
            testID={`today-filter-pet-${p.id}`}
            onPress={() => setPetFilter(p.id)}
            style={[styles.fchip, petFilter === p.id && styles.fchipOn]}
          >
            <Text style={[styles.fchipText, petFilter === p.id && styles.fchipTextOn]}>
              {p.name}
            </Text>
          </Pressable>
        ))}
        <Pressable
          testID="today-filter-type"
          onPress={() => setTypeSheet(true)}
          style={[styles.fchip, typeFilter.length > 0 && styles.fchipOn]}
        >
          <Text style={[styles.fchipText, typeFilter.length > 0 && styles.fchipTextOn]}>
            {t('today.filter.type')}
          </Text>
        </Pressable>
      </View>

      {!hasMatch ? (
        <View style={styles.empty} testID="today-no-match">
          <Text style={styles.emptyTitle}>{t('today.no_match')}</Text>
          {filtersActive && (
            <Pressable onPress={() => { setPetFilter(null); setTypeFilter([]); }}>
              <Text style={styles.clear}>{t('today.clear_filters')}</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(occ) => `${occ.chore.id}-${occ.dueAt}`}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader} testID={`today-section-${section.key}`}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionCount}>
                {section.data.length.toLocaleString('fa-IR')}
              </Text>
            </View>
          )}
          renderSectionFooter={({ section }) =>
            section.data.length === 0 ? (
              <Text style={styles.sectionEmpty}>{section.empty}</Text>
            ) : null
          }
          renderItem={({ item }) => (
            <TaskRow
              occ={item}
              petName={petNameById[item.chore.petId] ?? ''}
              onToggleDone={() => onToggleDone(item)}
              onOpenMenu={() => setMenuOcc(item)}
            />
          )}
        />
      )}

      {/* Undo toast */}
      {undo && (
        <View style={styles.undoBar} testID="today-undo">
          <Text style={styles.undoText}>{t('today.undo_done')}</Text>
          <Pressable testID="today-undo-btn" onPress={onUndo}>
            <Text style={styles.undoAction}>{t('today.undo')}</Text>
          </Pressable>
        </View>
      )}

      <Fab onPress={() => setQuickAdd(true)} label={t('today.quick.heading')} />

      <QuickAddSheet visible={quickAdd} onClose={() => setQuickAdd(false)} />
      <RowActionSheet
        occ={menuOcc}
        onClose={() => setMenuOcc(null)}
        onSkip={(o) => markOccurrence(o.chore.id, o.dueAt, 'skipped')}
        onEdit={(o) => navigation.navigate('ChoreForm', { petId: o.chore.petId, choreId: o.chore.id })}
      />
      <TypeFilterSheet
        visible={typeSheet}
        selected={typeFilter}
        onToggle={(ty) =>
          setTypeFilter((prev) => (prev.includes(ty) ? prev.filter((x) => x !== ty) : [...prev, ty]))
        }
        onClose={() => setTypeSheet(false)}
      />
    </SafeAreaView>
  );
}

// ── FAB ─────────────────────────────────────────────────────────────────────
function Fab({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable testID="today-fab" onPress={onPress} style={styles.fab} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name="add" size={28} color={colors.onPrimary} />
    </Pressable>
  );
}

// ── Type filter sheet ────────────────────────────────────────────────────────
function TypeFilterSheet({
  visible, selected, onToggle, onClose,
}: { visible: boolean; selected: ChoreType[]; onToggle: (t: ChoreType) => void; onClose: () => void }) {
  const { t } = useTranslation();
  if (!visible) return null;
  return (
    <View style={styles.sheetOverlay}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={styles.sheet}>
        {ALL_TYPES.map((ty) => (
          <Pressable
            key={ty}
            testID={`today-type-opt-${ty}`}
            onPress={() => onToggle(ty)}
            style={[styles.typeOpt, selected.includes(ty) && styles.typeOptOn]}
          >
            <Text style={[styles.typeOptText, selected.includes(ty) && styles.typeOptTextOn]}>
              {t(`chores.type.${ty}`)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  progress: {
    fontFamily: fonts.semibold,
    fontSize: typography.bodyLg.fontSize,
    color: colors.ink,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  filterBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  fchip: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  fchipOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  fchipText: { fontFamily: fonts.regular, fontSize: typography.caption.fontSize, color: colors.inkMuted },
  fchipTextOn: { fontFamily: fonts.medium, color: colors.primary },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionTitle: { fontFamily: fonts.semibold, fontSize: typography.label.fontSize, color: colors.inkMuted },
  sectionCount: { fontFamily: fonts.regular, fontSize: typography.caption.fontSize, color: colors.inkFaint },
  sectionEmpty: {
    fontFamily: fonts.regular,
    fontSize: typography.caption.fontSize,
    color: colors.inkFaint,
    paddingVertical: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, minHeight: 64 },
  rowOverdue: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    marginHorizontal: -spacing.sm,
  },
  checkbox: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  typeIcon: { width: 28, textAlign: 'center' },
  rowInfo: { flex: 1, gap: spacing.xs },
  petName: { fontSize: typography.caption.fontSize, fontFamily: fonts.semibold, color: colors.inkMuted },
  choreTitle: { fontSize: typography.body.fontSize, fontFamily: fonts.medium, color: colors.ink },
  choreTitleDone: { color: colors.inkFaint, textDecorationLine: 'line-through' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  time: { fontSize: typography.caption.fontSize, fontFamily: fonts.regular, color: colors.inkMuted },
  badge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontFamily: fonts.semibold, lineHeight: 16 },
  undoBar: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.ink,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  undoText: { fontFamily: fonts.medium, fontSize: typography.body.fontSize, color: colors.onPrimary },
  undoAction: { fontFamily: fonts.semibold, fontSize: typography.body.fontSize, color: '#7FD3AE' },
  fab: {
    position: 'absolute',
    insetInlineEnd: spacing.xl,
    bottom: spacing.xxl,
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.xxl },
  emptyTitle: { fontSize: typography.bodyLg.fontSize, fontFamily: fonts.semibold, color: colors.ink, textAlign: 'center' },
  emptySubtitle: { fontSize: typography.body.fontSize, fontFamily: fonts.regular, color: colors.inkMuted, textAlign: 'center' },
  clear: { fontFamily: fonts.medium, fontSize: typography.body.fontSize, color: colors.primary, marginTop: spacing.sm },
  sheetOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(26,26,23,0.35)' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  typeOpt: {
    minHeight: 44,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeOptOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  typeOptText: { fontFamily: fonts.regular, fontSize: typography.body.fontSize, color: colors.inkMuted },
  typeOptTextOn: { fontFamily: fonts.medium, color: colors.primary },
});
```

> This file imports `./RowActionSheet`, created in Task 6. Until then the screen
> won't compile — that's expected; Task 5's tests that don't touch the menu still
> drive the rest. To keep Task 5 independently green, create a **temporary stub**
> `mobile/src/screens/today/RowActionSheet.tsx` now (replaced fully in Task 6):
>
> ```typescript
> import React from 'react';
> import type { Occurrence } from '../../db/types';
> type Props = {
>   occ: Occurrence | null;
>   onClose: () => void;
>   onSkip: (o: Occurrence) => void;
>   onEdit: (o: Occurrence) => void;
> };
> // ponytail: stub — full sheet lands in Task 6
> export default function RowActionSheet(_props: Props) {
>   return null;
> }
> ```

- [ ] **Step 5: Run the screen test to verify it passes**

Run: `npx jest src/__tests__/TodayScreen.test.tsx`
Expected: PASS (empty, buckets, progress, filters, checkbox+undo, auto-dismiss).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add mobile/src/screens/today/TodayScreen.tsx mobile/src/screens/today/RowActionSheet.tsx mobile/src/i18n/fa.json mobile/src/__tests__/TodayScreen.test.tsx
git commit -m "feat(today): sectioned tasks list with filters, progress, checkbox+undo"
```

---

## Task 6: Row action sheet (Skip / Edit / Delete)

**Files:**
- Modify (replace stub): `mobile/src/screens/today/RowActionSheet.tsx`
- Modify: `mobile/src/i18n/fa.json` (action-sheet keys)
- Test: `mobile/src/__tests__/TodayScreen.test.tsx` (add menu cases)

**Interfaces:**
- Consumes: `Occurrence` from `../../db/types`; `deleteChore` from `useChoresStore`; RN `Alert`.
- Produces: default-export `RowActionSheet` with props `{ occ: Occurrence | null; onClose: () => void; onSkip: (o: Occurrence) => void; onEdit: (o: Occurrence) => void }`. Renders nothing when `occ` is null. testIDs: `today-action-skip`, `today-action-edit`, `today-action-delete`.

- [ ] **Step 1: Add action-sheet i18n keys**

In `mobile/src/i18n/fa.json`, add:

```json
  "today.action.skip": "رد کردن",
  "today.action.edit": "ویرایش",
  "today.action.delete": "حذف",
  "today.action.delete_confirm_title": "حذف کار",
  "today.action.delete_recurring": "این کار و همهٔ تکرارهای آن حذف شود؟",
  "today.action.delete_oneoff": "این کار حذف شود؟",
  "today.action.cancel": "انصراف",
```

- [ ] **Step 2: Add the failing menu tests**

Append to `mobile/src/__tests__/TodayScreen.test.tsx`:

```typescript
import { Alert } from 'react-native';

describe('TodayScreen – row action sheet', () => {
  test('opening the row menu and pressing Skip marks skipped', async () => {
    const occ = make('m1', '2026-06-20T03:00:00.000Z', 'pending');
    mockWindow = [occ];
    const { getByTestId } = render(<TodayScreen />);
    fireEvent.press(getByTestId('today-rowbtn-m1'));
    fireEvent.press(getByTestId('today-action-skip'));
    await waitFor(() => expect(mockMark).toHaveBeenCalledWith('m1', occ.dueAt, 'skipped'));
  });

  test('Delete asks for confirmation then calls deleteChore', async () => {
    const spy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      // press the destructive (second) button
      const confirm = buttons?.[1];
      confirm?.onPress?.();
    });
    const occ = make('m2', '2026-06-20T03:00:00.000Z', 'pending');
    mockWindow = [occ];
    const { getByTestId } = render(<TodayScreen />);
    fireEvent.press(getByTestId('today-rowbtn-m2'));
    fireEvent.press(getByTestId('today-action-delete'));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('m2'));
    spy.mockRestore();
  });
});
```

Add `mockDelete` to the choresStore mock at the top of the file. Update the mock factory (and its selector state object) to include:

```typescript
const mockDelete = jest.fn().mockResolvedValue(undefined);
```
and within the `selector({...})` state add `deleteChore: mockDelete,` plus `deleteChore: typeof mockDelete;` in the selector param type. Add `mockDelete.mockClear();` to `beforeEach`.

- [ ] **Step 3: Run to verify failure**

Run: `npx jest src/__tests__/TodayScreen.test.tsx -t "row action sheet"`
Expected: FAIL — stub renders nothing, no `today-action-*` testIDs.

- [ ] **Step 4: Implement the action sheet**

Replace `mobile/src/screens/today/RowActionSheet.tsx` with:

```typescript
/**
 * RowActionSheet — Skip / Edit / Delete for a task row.
 * ponytail: plain Modal + RN Alert confirm for delete — no extra deps.
 */

import React from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useChoresStore } from '../../store/choresStore';
import { colors, fonts, radius, spacing, typography } from '../../theme/theme';
import type { Occurrence } from '../../db/types';

type Props = {
  occ: Occurrence | null;
  onClose: () => void;
  onSkip: (o: Occurrence) => void;
  onEdit: (o: Occurrence) => void;
};

export default function RowActionSheet({ occ, onClose, onSkip, onEdit }: Props) {
  const { t } = useTranslation();
  const deleteChore = useChoresStore((s) => s.deleteChore);

  if (!occ) return null;
  const current = occ;
  const isRecurring = current.chore.schedule.kind !== 'one_off';

  const confirmDelete = () => {
    Alert.alert(
      t('today.action.delete_confirm_title'),
      isRecurring ? t('today.action.delete_recurring') : t('today.action.delete_oneoff'),
      [
        { text: t('today.action.cancel'), style: 'cancel' },
        {
          text: t('today.action.delete'),
          style: 'destructive',
          onPress: () => {
            deleteChore(current.chore.id);
            onClose();
          },
        },
      ],
    );
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <Pressable
          testID="today-action-skip"
          style={styles.action}
          onPress={() => { onSkip(current); onClose(); }}
        >
          <Text style={styles.actionText}>{t('today.action.skip')}</Text>
        </Pressable>
        <Pressable
          testID="today-action-edit"
          style={styles.action}
          onPress={() => { onEdit(current); onClose(); }}
        >
          <Text style={styles.actionText}>{t('today.action.edit')}</Text>
        </Pressable>
        <Pressable testID="today-action-delete" style={styles.action} onPress={confirmDelete}>
          <Text style={[styles.actionText, styles.delete]}>{t('today.action.delete')}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(26,26,23,0.35)' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  action: { minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontFamily: fonts.medium, fontSize: typography.bodyLg.fontSize, color: colors.ink },
  delete: { color: colors.danger },
});
```

- [ ] **Step 5: Run the screen tests (all)**

Run: `npx jest src/__tests__/TodayScreen.test.tsx`
Expected: PASS (earlier cases + the two menu cases).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add mobile/src/screens/today/RowActionSheet.tsx mobile/src/i18n/fa.json mobile/src/__tests__/TodayScreen.test.tsx
git commit -m "feat(today): row action sheet — skip, edit, delete"
```

---

## Task 7: Docs refresh + full verification

**Files:**
- Modify: `mobile/CLAUDE.md`

- [ ] **Step 1: Update the stale tab description**

In `mobile/CLAUDE.md`, replace the first sentence of the **Architecture** section
(currently "Bottom-tab navigator (`src/navigation/RootNavigator.tsx`) with two
tabs: `Home` (HomeScreen) and `Profile` (ProfileStack). …") with an accurate
description:

```markdown
Bottom-tab navigator (`src/navigation/RootNavigator.tsx`) with three tabs: `Pets`
(PetsStack), `Today` (TodayStack), and `Profile` (ProfileStack). `RootTabParamList`
is the root typed contract. Each tab is a native stack: `TodayStack` hosts the
Tasks list (`TodayMain`) + `ChoreForm`; `PetsStack` hosts pets list/detail/forms +
`ChoreForm`; `ProfileStack` hosts `ProfileMain`, `Signin`, `Signup`.

The **Today (Tasks)** tab buckets chore occurrences over a `[today−7d, today+7d)`
window (`src/lib/taskBuckets.ts`) into Overdue / Today / Next-7-days, with pet/type
filters, a daily progress counter, checkbox completion + undo (`unmarkOccurrence`),
a per-row action sheet (skip/edit/delete), and a quick-add sheet that creates
`one_off` `other` chores.
```

- [ ] **Step 2: Run the full mobile test suite**

Run: `npx jest`
Expected: all suites pass (taskBuckets, choresStore, RootNavigator, QuickAddSheet, TodayScreen, and all pre-existing suites).

- [ ] **Step 3: Final typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add mobile/CLAUDE.md
git commit -m "docs(mobile): describe Tasks tab + three-tab stacks"
```

---

## Self-Review

**Spec coverage:**
- See beyond today (Overdue/Today/Next-7-days) → Task 1 (buckets) + Task 5 (sections).
- Add ad-hoc todos (one_off `other`) → Task 4 (QuickAddSheet).
- Organize/filter (pet + type) → Task 5 (filter bar + type sheet).
- Progress counter (today, skipped excluded) → Task 5.
- Checkbox completion + undo → Task 2 (`unmarkOccurrence`) + Task 5.
- Tap row → sheet (Skip/Edit/Delete; recurring delete copy) → Task 6.
- Bounded 7-day look-back/ahead → Task 1 constants.
- Data layer (`getLogsInRange`, `removeLog`) → Task 2.
- TodayStack for Edit/More-options navigation → Task 3.
- i18n keys, theme tokens, edge cases (midnight re-bucket on focus, filter-empty section footer, whole-list no-match) → Tasks 4–6.
- Docs refresh → Task 7.

**Placeholder scan:** No TBD/TODO; the only stub (`RowActionSheet` in Task 5) is explicitly temporary and fully replaced in Task 6. All code steps include complete code.

**Type consistency:** `windowOccurrences`/`unmarkOccurrence` names match across store (T2), mocks (T3/T5), and screen (T5). `TodayStackParamList.ChoreForm` shape `{ petId; choreId? }` matches `ChoreFormScreen`'s route usage and the navigate calls in T4/T5. `bucketOccurrences`/`tehranTodayUtcRange`/`taskWindowUtcRange` signatures consistent between T1, T2 (store), and T5 (screen). `RowActionSheet` prop type identical in the T5 stub and the T6 implementation.

**Known deliberate simplifications (ponytail):** quick-add "More options" doesn't carry the typed title; undo is toast-window only; next-round-hour caps at 23:00. All commented in code.
