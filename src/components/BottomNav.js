import { View, Pressable, StyleSheet } from "react-native";
import Icon from "./Icon";
import { colors, radii, spacing, shadows } from "../theme";

// The brand board's mobile nav: every menu at the bottom, in one floating
// pill ("put all the nav-menu at the bottom for easy access", "remove
// clutter at the top"). Light variant (#E0DFDF at 20%) over the panorama;
// the active tab is a red pill with a white icon.
//
//   <BottomNav active="search" onPress={(tab) => …} bottom={insets.bottom + 12} />
export const NAV_TABS = [
  { id: "location", icon: "location", label: "Directory" },
  { id: "scan", icon: "scanCode", label: "Scan a placard" },
  { id: "search", icon: "search", label: "Search" },
  { id: "building", icon: "building", label: "Choose a building" },
  { id: "about", icon: "about", label: "About" },
];

// Outer height, for callers that place things above the bar.
export const NAV_HEIGHT = 58;

export default function BottomNav({ active, onPress, bottom = 0 }) {
  return (
    <View style={[styles.bar, { bottom }]}>
      {NAV_TABS.map((tab) => {
        const isActive = active === tab.id;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onPress(tab.id)}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
            hitSlop={4}
            style={({ pressed }) => [
              styles.tab,
              isActive && styles.tabActive,
              pressed && !isActive && styles.tabPressed,
            ]}
          >
            <Icon name={tab.icon} size={17} color={isActive ? colors.textOnPrimary : colors.navIcon} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    height: NAV_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.navBar,
    ...shadows.floating,
  },
  tab: {
    flex: 1,
    height: NAV_HEIGHT - 16,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  tabActive: { backgroundColor: colors.primary },
  tabPressed: { backgroundColor: "rgba(255,255,255,0.6)" },
});
