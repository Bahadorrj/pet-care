// Manual mock for @notifee/react-native.
//
// Notifee is a native module; jest-expo has no native runtime, so importing the
// real package throws "Notifee native module not found." App.tsx imports
// src/lib/choreNotifications (→ notifee) for the launch-time sync/tap wiring, so
// every test that renders App would crash without this. No-op stubs are enough.
//
// Tests that assert on notifee calls (taskNotifications.test.ts) provide their
// own jest.mock('@notifee/react-native', ...) which takes precedence.

module.exports = {
  __esModule: true,
  default: {
    createChannel: jest.fn().mockResolvedValue('tasks'),
    requestPermission: jest.fn().mockResolvedValue({ authorizationStatus: 1 }),
    cancelTriggerNotifications: jest.fn().mockResolvedValue(undefined),
    createTriggerNotification: jest.fn().mockResolvedValue(undefined),
    onForegroundEvent: jest.fn().mockReturnValue(() => {}),
    onBackgroundEvent: jest.fn().mockReturnValue(() => {}),
    getInitialNotification: jest.fn().mockResolvedValue(null),
  },
  TriggerType: { TIMESTAMP: 0 },
  AndroidImportance: { HIGH: 4 },
  EventType: { PRESS: 1, DISMISSED: 0, ACTION_PRESS: 2 },
};
