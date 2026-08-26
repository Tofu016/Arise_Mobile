import { View, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { colors, spacing } from "../theme";

// The shared "front-door" screen shell (login / register / forgot-* /
// approval): a full-bleed brand-background surface with vertically centred,
// comfortably padded content.
//
//   <ScreenContainer keyboardAvoiding>   {/* login, register, forgot-password */}
//   <ScreenContainer>                    {/* forgot-email */}
//   <ScreenContainer scroll={false}>     {/* approval */}
//
// props:
//   keyboardAvoiding — wrap in KeyboardAvoidingView (screens with inputs)
//   scroll           — content in a ScrollView (default true)
//   center           — vertically centre content (default true)

export default function ScreenContainer({
  children,
  keyboardAvoiding = false,
  scroll = true,
  center = true,
  contentContainerStyle,
  style,
}) {
  const inner = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, center && styles.center, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, styles.content, center && styles.center, contentContainerStyle]}>{children}</View>
  );

  if (keyboardAvoiding) {
    return (
      <KeyboardAvoidingView
        style={[styles.flex, style]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {inner}
      </KeyboardAvoidingView>
    );
  }

  return <View style={[styles.flex, style]}>{inner}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, padding: spacing.xxl },
  center: { justifyContent: "center" },
});
