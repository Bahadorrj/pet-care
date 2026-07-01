// Native-module mocks for the test env (jsdom has no worklets/gesture runtime).
// Reanimated 4's own `/mock` still imports the worklets native module, which
// throws under Jest — so we hand-roll a minimal surface covering only what the
// screens use, and never load the real module.
import "react-native-gesture-handler/jestSetup";

jest.mock("react-native-reanimated", () => {
  const React = require("react");
  const { View } = require("react-native");
  // Strip animation-only props so the underlying RN View doesn't choke on them.
  const AnimatedView = ({ layout, entering, exiting, ...rest }) =>
    React.createElement(View, rest);
  return {
    __esModule: true,
    default: { View: AnimatedView, createAnimatedComponent: (c) => c },
    View: AnimatedView,
    useSharedValue: (v) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useReducedMotion: () => false,
    withSequence: (...a) => a[a.length - 1],
    withSpring: (v) => v,
    withTiming: (v) => v,
    FadeOut: { duration: () => ({}) },
    LinearTransition: {},
  };
});

// ReanimatedSwipeable pulls in reanimated internals; render a passthrough wrapper.
jest.mock("react-native-gesture-handler/ReanimatedSwipeable", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: ({ children }) => React.createElement(View, null, children),
  };
});

// RN's real requestIdleCallback/cancelIdleCallback are wired up by native
// InitializeCore, which the jest-expo preset doesn't run — polyfill with the
// standard setTimeout-based shim.
global.requestIdleCallback =
  global.requestIdleCallback ||
  ((cb) =>
    setTimeout(
      () => cb({ didTimeout: false, timeRemaining: () => Infinity }),
      0,
    ));
global.cancelIdleCallback =
  global.cancelIdleCallback || ((id) => clearTimeout(id));

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: "success" },
  ImpactFeedbackStyle: { Light: "light" },
}));
