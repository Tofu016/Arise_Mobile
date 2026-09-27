import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import Icon from "./Icon";
import { colors, typography, radii, spacing } from "../theme";

// Labelled text input in the app's field style — the same filled grey,
// rounded field as the Directions sheet — with an uppercase label, an
// optional leading icon, a red outline while focused (or on an error), and
// an optional hint/error line underneath. A password field (secureTextEntry)
// gets an eye button to show or hide what's typed.
//
//   <FormField label="Email" icon="email" value={email} onChangeText={setEmail}
//     keyboardType="email-address" autoCapitalize="none" />
//
// Any TextInput prop passes straight through (returnKeyType,
// onSubmitEditing, …). `onFocus` / `onBlur` still fire for callers.

export default function FormField({
  label,
  icon,
  hint,
  error,
  containerStyle,
  inputStyle,
  inputRef,
  onFocus,
  onBlur,
  secureTextEntry,
  ...rest
}) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const isPassword = !!secureTextEntry;
  const tone = error ? colors.danger : focused ? colors.primary : colors.gray500;

  return (
    <View style={[styles.field, containerStyle]}>
      {label != null && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.box, focused && styles.boxFocused, error ? styles.boxError : null]}>
        {icon && <Icon name={icon} size={15} color={tone} />}
        <TextInput
          ref={inputRef}
          style={[styles.input, inputStyle]}
          placeholderTextColor={colors.textSubtle}
          secureTextEntry={isPassword && !revealed}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {isPassword && (
          <Pressable
            onPress={() => setRevealed((v) => !v)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={revealed ? "Hide password" : "Show password"}
          >
            <Icon name={revealed ? "hidePassword" : "showPassword"} size={16} color={colors.gray500} />
          </Pressable>
        )}
      </View>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing.lg },
  label: { ...typography.label, marginBottom: spacing.xs + 2, marginLeft: spacing.xs },
  // A transparent border at rest, so focusing doesn't shift the layout.
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 50,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: "transparent",
    backgroundColor: colors.surfaceField,
  },
  boxFocused: { borderColor: colors.primary, backgroundColor: colors.surface },
  boxError: { borderColor: colors.danger },
  input: {
    flex: 1,
    ...typography.body,
    letterSpacing: 0.6,
    color: colors.textPrimary,
    paddingVertical: spacing.md,
  },
  hint: { ...typography.caption, color: colors.textSubtle, marginTop: spacing.xs + 2, marginLeft: spacing.xs },
  error: { ...typography.caption, color: colors.danger, marginTop: spacing.xs + 2, marginLeft: spacing.xs },
});
