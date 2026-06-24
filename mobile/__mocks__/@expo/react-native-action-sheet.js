// Manual mock for @expo/react-native-action-sheet.
//
// The real ActionSheetProvider calls React.Children.only and bridges to a native
// UIActionSheet — neither works in jest-expo's JS-only environment.
// This stub:
//   - ActionSheetProvider: passthrough wrapper (renders children as-is)
//   - useActionSheet: returns a jest.fn stub for showActionSheetWithOptions

const React = require('react');

const ActionSheetProvider = ({ children }) => children;

const useActionSheet = () => ({
  showActionSheetWithOptions: jest.fn(),
});

module.exports = {
  __esModule: true,
  ActionSheetProvider,
  useActionSheet,
};
