// Manual mock for react-native-toast-message.
//
// The real module ships native animation code that doesn't run in jest-expo's
// JS-only environment. This stub satisfies both usage patterns:
//   import Toast from 'react-native-toast-message';  // JSX component + Toast.show/hide
//
// The component renders null so tests that mount App don't crash.

const React = require('react');

const Toast = () => null;
Toast.show = jest.fn();
Toast.hide = jest.fn();

module.exports = {
  __esModule: true,
  default: Toast,
};
