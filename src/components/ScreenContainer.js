import { View, ScrollView, KeyboardAvoidingView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "../theme";

// The shared "front-door" screen shell (login / register / forgot-* /
// approval): white, content in a centred column no wider than a phone
// (so it doesn't sprawl on a tablet), clear of the status bar and gesture
// bar, and vertically centred when it fits.
//
//   <ScreenContainer keyboardAvoiding>   {/* login, register, forgot-password */}
//   <ScreenContainer>                    {/* forgot-email */}
//   <ScreenContainer scroll={false}>     {/* approval */}
//
// props:
//   keyboardAvoiding — shrink out of the keyboard's way (screens with
//                      inputs). "padding" on both platforms: the app is
//                      edge-to-edge, so Android no longer resizes for the
//                      keyboard on its own.
//   scroll           — content in a ScrollView (default true)
//   center           — vertically centre content (default true)

const MAX_WIDTH = 420;

export default function ScreenContainer({
  children,
  keyboardAvoiding = false,
  scroll = true,
  center = true,
  contentContainerStyle,
  style,
}) {
  const insets = useSafeAreaInsets();
  const padding = {
    paddingTop: insets.top + spacing.xl,
    paddingBottom: insets.bottom + spacing.xl,
  };
  const column = <View style={styles.column}>{children}</View>;

  const inner = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, padding, center && styles.center, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {column}
    </ScrollView>
  ) : (
    <View style={[styles.flex, styles.content, padding, center && styles.center, contentContainerStyle]}>{column}</View>
  );

  if (keyboardAvoiding) {
    return (
      <KeyboardAvoidingView style={[styles.flex, style]} behavior="padding">
        {inner}
      </KeyboardAvoidingView>
    );
  }

  return <View style={[styles.flex, style]}>{inner}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: spacing.xxl },
  center: { justifyContent: "center" },
  column: { width: "100%", maxWidth: MAX_WIDTH, alignSelf: "center" },
});
