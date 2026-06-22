/**
 * choreNotifications.ts
 * Local notification scheduling via @notifee/react-native.
 *
 * Public API:
 *   initChoreNotifications(navRef)  — call once at app start (channel + seam + tap handler)
 *   syncNotifications()             — cancel-all then re-register triggers for next 60 days
 *   handleNotificationEvent(event)  — action/press handler (fore + background)
 */

import notifee, { TriggerType, AndroidImportance, EventType } from '@notifee/react-native';
import type { NavigationContainerRef } from '@react-navigation/native';
import { t } from 'i18next';

import { listChores, logOccurrence } from '../db/chores';
import { getPet } from '../db/pets';
import { expandOccurrences } from './choreSchedule';
import { setChoresSyncNotifications } from '../store/choresStore';
import type { RootTabParamList } from '../navigation/RootNavigator';

// ponytail: fixed constants, no config object needed
const CHANNEL_ID = 'chores';
const WINDOW_DAYS = 60;
const CAP = 200;
const SNOOZE_MS = 15 * 60 * 1000;

// ponytail: one notification shape, reused by initial schedule + snooze reschedule.
// `label` (resolved chore title) + `petName` are carried in `data` so the snooze
// reschedule can rebuild the same content without a db/i18n lookup in the
// headless background context.
function buildChoreNotification(args: {
  choreId: string;
  dueAt: string;
  label: string;
  petName: string;
}) {
  const { choreId, dueAt, label, petName } = args;
  return {
    title: label,
    body: petName ? t('chores.notif.body', { pet: petName }) : t('chores.notif.body_generic'),
    android: {
      channelId: CHANNEL_ID,
      pressAction: { id: 'default' },
      actions: [
        { title: t('chores.action.done'), pressAction: { id: 'done' } },
        { title: t('chores.action.skip'), pressAction: { id: 'skip' } },
        { title: t('chores.action.snooze'), pressAction: { id: 'snooze' } },
      ],
    },
    data: { choreId, dueAt, label, petName },
  };
}

// ---------------------------------------------------------------------------
// syncNotifications — pure scheduling logic (unit-tested)
// ---------------------------------------------------------------------------

export async function syncNotifications(): Promise<void> {
  const now = new Date();
  const from = now;
  const to = new Date(now.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Collect {choreId, dueAt} for all active chores within window
  const chores = listChores().filter((c) => c.active);

  type Entry = { choreId: string; dueAt: string; label: string; petName: string };
  const entries: Entry[] = [];

  for (const chore of chores) {
    const label = chore.title?.trim() || t(`chores.type.${chore.type}`);
    const petName = getPet(chore.petId)?.name ?? '';
    const occurrences = expandOccurrences(chore, from, to);
    for (const dueAt of occurrences) {
      entries.push({ choreId: chore.id, dueAt, label, petName });
    }
  }

  // Sort nearest-first, cap at 200
  entries.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  const scheduled = entries.slice(0, CAP);

  // Cancel existing scheduled triggers first (leaves displayed/non-trigger ones alone)
  await notifee.cancelTriggerNotifications();

  // Register each selected occurrence
  for (const entry of scheduled) {
    await notifee.createTriggerNotification(buildChoreNotification(entry), {
      type: TriggerType.TIMESTAMP,
      timestamp: new Date(entry.dueAt).getTime(),
    });
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
    notification?: { data?: { choreId?: string; dueAt?: string; label?: string; petName?: string } };
  };
}): Promise<void> {
  const { type, detail } = event;

  if (type !== EventType.ACTION_PRESS) {
    // PRESS (default body tap) and DISMISSED are handled elsewhere or ignored
    return;
  }

  const actionId = detail.pressAction?.id;
  const data = detail.notification?.data;
  const choreId = data?.choreId;
  const dueAt = data?.dueAt;

  if (!choreId || !dueAt) return;

  if (actionId === 'done') {
    logOccurrence(choreId, dueAt, 'done');
  } else if (actionId === 'skip') {
    logOccurrence(choreId, dueAt, 'skipped');
  } else if (actionId === 'snooze') {
    // ponytail: fixed +15min offset per plan; no log written on snooze
    await notifee.createTriggerNotification(buildChoreNotification({
      choreId,
      dueAt,
      label: data?.label ?? '',
      petName: data?.petName ?? '',
    }), {
      type: TriggerType.TIMESTAMP,
      timestamp: Date.now() + SNOOZE_MS,
    });
  }
}

// ---------------------------------------------------------------------------
// initChoreNotifications — call once at app start
// ---------------------------------------------------------------------------

export async function initChoreNotifications(
  navRef: NavigationContainerRef<RootTabParamList>,
): Promise<void> {
  // Create Android channel (idempotent)
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Chore Reminders',
    importance: AndroidImportance.HIGH,
  });

  // Request permission (Android 13+, iOS)
  await notifee.requestPermission();

  // Wire the store seam so mutations re-sync automatically
  setChoresSyncNotifications(syncNotifications);

  // Consolidated foreground handler: default press navigates, action buttons act.
  // Mutually exclusive — a body PRESS never falls through to the action handler.
  notifee.onForegroundEvent((event) => {
    if (event.type === EventType.PRESS && navRef.isReady()) {
      navRef.navigate('Today');
    } else if (event.type === EventType.ACTION_PRESS) {
      // fire-and-forget; handler is self-contained (db write / reschedule)
      handleNotificationEvent(event);
    }
  });

  // Handle tap from cold start
  const initial = await notifee.getInitialNotification();
  if (initial && navRef.isReady()) {
    navRef.navigate('Today');
  }

  // Initial sync after db is ready
  await syncNotifications();
}
