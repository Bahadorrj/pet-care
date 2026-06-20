/**
 * choreNotifications.ts
 * Local notification scheduling via @notifee/react-native.
 *
 * Public API:
 *   initChoreNotifications(navRef)  — call once at app start (channel + seam + tap handler)
 *   syncNotifications()             — cancel-all then re-register triggers for next 60 days
 */

import notifee, { TriggerType, AndroidImportance, EventType } from '@notifee/react-native';
import type { NavigationContainerRef } from '@react-navigation/native';

import { listChores } from '../db/chores';
import { expandOccurrences } from './choreSchedule';
import { setChoresSyncNotifications } from '../store/choresStore';
import type { RootTabParamList } from '../navigation/RootNavigator';

// ponytail: fixed constants, no config object needed
const CHANNEL_ID = 'chores';
const WINDOW_DAYS = 60;
const CAP = 200;

// ---------------------------------------------------------------------------
// syncNotifications — pure scheduling logic (unit-tested)
// ---------------------------------------------------------------------------

export async function syncNotifications(): Promise<void> {
  const now = new Date();
  const from = now;
  const to = new Date(now.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Collect {choreId, dueAt} for all active chores within window
  const chores = listChores().filter((c) => c.active);

  type Entry = { choreId: string; dueAt: string };
  const entries: Entry[] = [];

  for (const chore of chores) {
    const occurrences = expandOccurrences(chore, from, to);
    for (const dueAt of occurrences) {
      entries.push({ choreId: chore.id, dueAt });
    }
  }

  // Sort nearest-first, cap at 200
  entries.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  const scheduled = entries.slice(0, CAP);

  // Cancel existing scheduled triggers first (leaves displayed/non-trigger ones alone)
  await notifee.cancelTriggerNotifications();

  // Register each selected occurrence
  for (const { choreId, dueAt } of scheduled) {
    await notifee.createTriggerNotification(
      {
        title: 'PetCare',
        body: 'یادآوری مراقبت از حیوان خانگی',
        android: {
          channelId: CHANNEL_ID,
          pressAction: { id: 'default' },
        },
        data: { choreId, dueAt },
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: new Date(dueAt).getTime(),
      },
    );
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

  // Handle tap when app is already open (foreground)
  notifee.onForegroundEvent(({ type }) => {
    if (type === EventType.PRESS && navRef.isReady()) {
      navRef.navigate('Today');
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
