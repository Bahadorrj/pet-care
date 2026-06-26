/**
 * taskNotifications.ts
 * Local notification scheduling via @notifee/react-native.
 *
 * Public API:
 *   initTaskNotifications(navRef)  — call once at app start (channel + seam + tap handler)
 *   syncNotifications()             — cancel-all then re-register triggers for next 60 days
 *   handleNotificationEvent(event)  — action/press handler (fore + background)
 */

import { AppState } from "react-native";
import notifee, {
  TriggerType,
  AndroidImportance,
  EventType,
} from "@notifee/react-native";
import type { NavigationContainerRef } from "@react-navigation/native";
import { t } from "i18next";

import { listTasks, logOccurrence } from "../db/tasks";
import { getPet } from "../db/pets";
import { expandOccurrences } from "./taskSchedule";
import { setTasksSyncNotifications } from "../store/tasksStore";
import type { RootTabParamList } from "../navigation/RootNavigator";

// ponytail: fixed constants, no config object needed
const CHANNEL_ID = "tasks";
const WINDOW_DAYS = 60;
const CAP = 200;
const SNOOZE_MS = 15 * 60 * 1000;
// Coalesce a burst of mutations and keep the (heavy) sync off the tick that
// triggered it. 800ms swallows a quick run of adds without delaying a single
// edit's notifications noticeably.
const SYNC_DEBOUNCE_MS = 800;

// ponytail: one notification shape, reused by initial schedule + snooze reschedule.
// `label` (resolved task title) + `petName` are carried in `data` so the snooze
// reschedule can rebuild the same content without a db/i18n lookup in the
// headless background context.
function buildTaskNotification(args: {
  taskId: string;
  dueAt: string;
  label: string;
  petName: string;
}) {
  const { taskId, dueAt, label, petName } = args;
  return {
    title: label,
    body: petName
      ? t("tasks.notif.body", { pet: petName })
      : t("tasks.notif.body_generic"),
    android: {
      channelId: CHANNEL_ID,
      pressAction: { id: "default" },
      actions: [
        { title: t("tasks.action.done"), pressAction: { id: "done" } },
        { title: t("tasks.action.skip"), pressAction: { id: "skip" } },
        { title: t("tasks.action.snooze"), pressAction: { id: "snooze" } },
      ],
    },
    data: { taskId, dueAt, label, petName },
  };
}

// ---------------------------------------------------------------------------
// syncNotifications — pure scheduling logic (unit-tested)
// ---------------------------------------------------------------------------

export async function syncNotifications(): Promise<void> {
  const now = new Date();
  const from = now;
  const to = new Date(now.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Collect {taskId, dueAt} for all active tasks within window
  const tasks = listTasks().filter((c) => c.active);

  type Entry = {
    taskId: string;
    dueAt: string;
    label: string;
    petName: string;
  };
  const entries: Entry[] = [];

  for (const task of tasks) {
    const label = task.title?.trim() || t(`tasks.type.${task.type}`);
    const petName = getPet(task.petId)?.name ?? "";
    const occurrences = expandOccurrences(task, from, to);
    for (const dueAt of occurrences) {
      entries.push({ taskId: task.id, dueAt, label, petName });
    }
  }

  // Sort nearest-first, cap at 200
  entries.sort(
    (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime(),
  );
  const scheduled = entries.slice(0, CAP);

  // Cancel existing scheduled triggers first (leaves displayed/non-trigger ones alone)
  await notifee.cancelTriggerNotifications();

  // Register each selected occurrence
  for (const entry of scheduled) {
    await notifee.createTriggerNotification(buildTaskNotification(entry), {
      type: TriggerType.TIMESTAMP,
      timestamp: new Date(entry.dueAt).getTime(),
    });
  }
}

// ---------------------------------------------------------------------------
// scheduleSyncNotifications — debounced, deferred entry point for the store seam
// ---------------------------------------------------------------------------
//
// syncNotifications does ~60 days of occurrence expansion across every task
// plus up to 200 native trigger calls. Running it inline on a mutation blocks
// the JS thread during the add/transition; this defers it past the current tick
// and collapses rapid mutations (e.g. adding several tasks) into one resync.

let _syncTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleSyncNotifications(): void {
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => {
    _syncTimer = null;
    void syncNotifications();
  }, SYNC_DEBOUNCE_MS);
}

// Run a pending debounced sync immediately. Called when the app backgrounds so
// a just-added/deleted task's triggers are (un)scheduled before the OS suspends
// JS — otherwise the 800ms timer could be killed with the resync still pending.
export function flushSyncNotifications(): void {
  if (_syncTimer) {
    clearTimeout(_syncTimer);
    _syncTimer = null;
    void syncNotifications();
  }
}

// ---------------------------------------------------------------------------
// handleNotificationEvent — maps Notifee events to side effects
// Safe to call from both foreground and headless background contexts.
// Background: must NOT touch zustand store or navigation (not alive in headless).
// ---------------------------------------------------------------------------

export async function handleNotificationEvent(event: {
  type: number;
  detail: {
    pressAction?: { id: string };
    notification?: {
      data?: {
        taskId?: string;
        dueAt?: string;
        label?: string;
        petName?: string;
      };
    };
  };
}): Promise<void> {
  const { type, detail } = event;

  if (type !== EventType.ACTION_PRESS) {
    // PRESS (default body tap) and DISMISSED are handled elsewhere or ignored
    return;
  }

  const actionId = detail.pressAction?.id;
  const data = detail.notification?.data;
  const taskId = data?.taskId;
  const dueAt = data?.dueAt;

  if (!taskId || !dueAt) return;

  if (actionId === "done") {
    logOccurrence(taskId, dueAt, "done");
  } else if (actionId === "skip") {
    logOccurrence(taskId, dueAt, "skipped");
  } else if (actionId === "snooze") {
    // ponytail: fixed +15min offset per plan; no log written on snooze
    await notifee.createTriggerNotification(
      buildTaskNotification({
        taskId,
        dueAt,
        label: data?.label ?? "",
        petName: data?.petName ?? "",
      }),
      {
        type: TriggerType.TIMESTAMP,
        timestamp: Date.now() + SNOOZE_MS,
      },
    );
  }
}

// ---------------------------------------------------------------------------
// initTaskNotifications — call once at app start
// ---------------------------------------------------------------------------

export async function initTaskNotifications(
  navRef: NavigationContainerRef<RootTabParamList>,
): Promise<void> {
  // Create Android channel (idempotent)
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: "Task Reminders",
    importance: AndroidImportance.HIGH,
  });

  // Request permission (Android 13+, iOS)
  await notifee.requestPermission();

  // Wire the store seam so mutations re-sync automatically. Debounced/deferred
  // so the heavy sync never runs inline on the mutation/transition tick.
  setTasksSyncNotifications(scheduleSyncNotifications);

  // Flush any pending debounced sync when leaving the foreground, so a mutation
  // made right before backgrounding still reaches notifee before JS suspends.
  AppState.addEventListener("change", (state) => {
    if (state !== "active") flushSyncNotifications();
  });

  // Consolidated foreground handler: default press navigates, action buttons act.
  // Mutually exclusive — a body PRESS never falls through to the action handler.
  notifee.onForegroundEvent((event) => {
    if (event.type === EventType.PRESS && navRef.isReady()) {
      navRef.navigate("Tasks");
    } else if (event.type === EventType.ACTION_PRESS) {
      // fire-and-forget; handler is self-contained (db write / reschedule)
      handleNotificationEvent(event);
    }
  });

  // Handle tap from cold start
  const initial = await notifee.getInitialNotification();
  if (initial && navRef.isReady()) {
    navRef.navigate("Tasks");
  }

  // Initial sync after db is ready
  await syncNotifications();
}
