import { useState } from "react";
import { View, Text, Pressable, Image, StyleSheet } from "react-native";
import Icon from "./Icon";
import { photoUrl } from "../api/client";
import { colors, typography, radii, spacing } from "../theme";

// A list row from the brand board's search/directory sheets: uppercase
// title, optional uppercase subtitle ("GD1 - FLOOR 1 > ACCOUNTING"), and a
// trailing chevron (open) or × (remove). While pressed — and when
// `selected` — it fills with the brand red edge to edge, as the board's
// "once pressed, a highlight will occupy the whole row" shows.
//
//   <ListRow title="Accounting office" subtitle="GD1 - Floor 1 > Accounting"
//            onPress={open} trailing="chevron" />
//   <ListRow title="Cashier office" onPress={open} trailing="remove" onTrailingPress={forget} />
//
// dimmed: greyed out (e.g. a saved room the tour no longer lists); with no
// onPress the row itself doesn't respond, but its trailing button still does.
//
// photo: a room's photo path (its first photo, as web's directory uses).
// The row grows to web's 60px room cell and fades from the sheet's white on
// the left into the photo on the right, as web's DirectoryAccordion rows
// do. The fade is a gradient laid over the photo in the row's own colour,
// so the pressed red recolours it instead of being hidden by the photo. A
// 360 photo is shown as the middle band of itself (web flattens it to a
// set view; mobile has no flattener, and the middle band is its least
// distorted part). Until the photo loads, or if it fails, the row is a
// plain row.

// A #RRGGBB colour at full and at zero opacity, for the photo fade (a bare
// "transparent" would fade through black).
function fadeOver(color) {
  return `linear-gradient(to right, ${color} 0%, ${color} 30%, ${color}00 100%)`;
}
export default function ListRow({
  title,
  subtitle,
  onPress,
  trailing = "chevron",
  onTrailingPress,
  trailingLabel,
  selected = false,
  indent = 0,
  dimmed = false,
  photo,
}) {
  const [photoShown, setPhotoShown] = useState(false);
  const [failedPhoto, setFailedPhoto] = useState(null);
  const hasPhoto = !!photo && failedPhoto !== photo;
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole="button">
      {({ pressed }) => {
        const lit = (pressed && !!onPress) || selected;
        const withPhoto = hasPhoto && photoShown;
        return (
          <View
            style={[
              styles.row,
              { paddingLeft: spacing.xl + indent },
              hasPhoto && styles.rowPhoto,
              lit && styles.rowLit,
              dimmed && styles.rowDimmed,
            ]}
          >
            {hasPhoto && (
              <>
                <Image
                  source={{ uri: photoUrl(photo, { jpeg: true }) }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                  onLoad={() => setPhotoShown(true)}
                  onError={() => setFailedPhoto(photo)}
                />
                <View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFill,
                    withPhoto
                      ? { experimental_backgroundImage: fadeOver(lit ? colors.primary : colors.surface) }
                      : { backgroundColor: lit ? colors.primary : colors.surface },
                  ]}
                />
              </>
            )}
            <View style={[styles.text, hasPhoto && styles.textPhoto]}>
              <Text style={[styles.title, lit && styles.titleLit]} numberOfLines={2}>
                {title}
              </Text>
              {!!subtitle && (
                <Text style={[styles.subtitle, lit && styles.subtitleLit]} numberOfLines={1}>
                  {subtitle}
                </Text>
              )}
            </View>
            {trailing === "chevron" && (
              <View style={withPhoto && styles.trailingOnPhoto}>
                <Icon name="proceedNext" size={14} color={lit && !withPhoto ? colors.textOnPrimary : colors.primary} />
              </View>
            )}
            {trailing === "remove" && (
              <Pressable
                onPress={onTrailingPress}
                hitSlop={12}
                style={withPhoto && styles.trailingOnPhoto}
                accessibilityLabel={trailingLabel || `Remove ${title} from recent`}
              >
                <Icon name="terminate" size={16} color={lit && !withPhoto ? colors.textOnPrimary : colors.textSecondary} />
              </Pressable>
            )}
          </View>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingRight: spacing.xl,
    paddingVertical: spacing.md,
  },
  // Web's room cell height; overflow hidden keeps the photo inside the row.
  rowPhoto: { minHeight: 60, overflow: "hidden" },
  rowLit: { backgroundColor: colors.primary },
  rowDimmed: { opacity: 0.5 },
  text: { flex: 1 },
  // Kept on the solid part of the fade, so the photo never sits behind it.
  textPhoto: { flex: 0, width: "60%", marginRight: "auto" },
  // A trailing icon over the photo sits on a small white disc to stay legible.
  trailingOnPhoto: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  title: { ...typography.label, color: colors.textSecondary },
  titleLit: { color: colors.textOnPrimary },
  subtitle: { ...typography.sublabel, marginTop: 3, marginLeft: spacing.lg },
  subtitleLit: { color: colors.redOnRedSubtle },
});
