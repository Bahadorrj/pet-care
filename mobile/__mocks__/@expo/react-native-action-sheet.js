// Manual mock for @expo/react-native-action-sheet.
//
// The real ActionSheetProvider calls React.Children.only and bridges to a native
// UIActionSheet — neither works in jest-expo's JS-only environment.
// This stub:
//   - ActionSheetProvider: passthrough wrapper (renders children as-is)
//   - useActionSheet: returns a stable jest.fn stub for showActionSheetWithOptions
//     (hoisted so tests can import and assert against the same reference)

const React = require('react');

const ActionSheetProvider = ({ children }) => children;

// Hoisted so every useActionSheet() call returns the SAME fn reference —
// tests can import this mock and assert on it directly.
const showActionSheetWithOptions = jest.fn();

const useActionSheet = () => ({ showActionSheetWithOptions });

module.exports = {
  __esModule: true,
  ActionSheetProvider,
  useActionSheet,
  // Export the fn itself so tests can reference it without re-calling useActionSheet
  _showActionSheetWithOptions: showActionSheetWithOptions,
};
