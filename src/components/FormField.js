import { useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { colors, typography, radii, spacing } from "../theme";

// Labelled text input, brand-styled: uppercase Montserrat label, sunken
// field, maroon focus ring, optional error line. Replaces the
// field/label/input blocks in login, register, forgot-password, and the
// directions sheet.
//
//   <FormField label="Email" value={email} onChangeText={setEmail}
//     keyboardType="email-address" autoCapitalize="none" />
//
// Any TextInput prop passes straight through. `onFocus` / `onBlur` still
// fire for callers that need them.

export default function FormField({
  label,
  error,
  containerStyle,
  inputStyle,
  inputRef,
  onFocus,
  onBlur,
  ...rest
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.field, containerStyle]}>
      {label != null && <Text style={styles.label}>{label}</Text>}
      <TextInput
        ref={inputRef}
        style={[
          styles.input,
          focused && styles.inputFocused,
          error ? styles.inputError : null,
          inputStyle,
        ]}
        placeholderTextColor={colors.textSubtle}
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
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing.lg },
  label: { ...typography.label, marginBottom: spacing.xs + 2 },
  input: {
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.textPrimary,
  },
  inputFocused: { borderColor: colors.focusRing },
  inputError: { borderColor: colors.danger },
  error: { ...typography.caption, color: colors.danger, marginTop: spacing.xs + 2 },
});
