import React from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";
import type { MaterialTopTabBarProps } from "@react-navigation/material-top-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { colors, spacing, typography } from "../theme/theme";

// Icon per tab route. Keyed by route.name because material-top-tabs has no
// tabBarIcon option (unlike bottom-tabs) — the bar owns the icon mapping.
const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Pets: "paw-outline",
  Tasks: "today-outline",
  Profile: "person-outline",
};

/**
 * Custom bottom tab bar for the swipeable (material-top-tabs) root navigator.
 * Replicates the flat "Quiet Garden" look the old bottom-tabs bar gave for free:
 * Warm Paper canvas, no top border/shadow, emerald active tint, Ionicons outline.
 */
export default function BottomTabBar({
  state,
  descriptors,
  navigation,
}: MaterialTopTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const { options } = descriptors[route.key];
        const label =
          typeof options.title === "string" ? options.title : route.name;
        const color = focused ? colors.primary : colors.inkMuted;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={styles.tab}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
          >
            <Ionicons name={ICONS[route.name]} size={24} color={color} />
            <Text style={[styles.label, { color }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: colors.bg,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  label: {
    ...typography.caption,
  },
});
