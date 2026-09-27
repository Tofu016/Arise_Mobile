import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import FormField from "./FormField";
import Button from "./Button";
import Icon from "./Icon";
import {
  DEFAULT_API_BASE_URL,
  normalizeServerAddress,
  serverHost,
  serverSettingEnabled,
  setServerAddress,
  testServerAddress,
  useServerAddress,
} from "../api/serverAddress";
import { colors, typography, radii, spacing } from "../theme";

// Which Arise_API server the app talks to — the development build only
// (see src/api/serverAddress.js); renders nothing in preview and
// production builds. Shown on the Sign in screen, so a server is only ever switched
// while signed out: a session always belongs to the server it signed in to.
// A new address is tested (Arise_API must answer) before it's used.
export default function ServerSetting({ style }) {
  const current = useServerAddress();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(current);
  const [status, setStatus] = useState(null); // { kind: "testing" | "ok" | "error", message }

  if (!serverSettingEnabled) return null;
  const isDefault = current === DEFAULT_API_BASE_URL;
  const testing = status?.kind === "testing";

  const apply = async () => {
    if (testing) return;
    let url;
    try {
      url = normalizeServerAddress(text);
    } catch (err) {
      setStatus({ kind: "error", message: err.message });
      return;
    }
    setStatus({ kind: "testing", message: `Checking ${serverHost(url)}…` });
    if (!(await testServerAddress(url))) {
      setStatus({
        kind: "error",
        message: `Arise_API didn't answer at ${url}. Check the address, that the server is running, and that this phone is on the same network.`,
      });
      return;
    }
    await setServerAddress(url);
    setText(url);
    setStatus({ kind: "ok", message: `Connected. Using ${serverHost(url)}.` });
  };

  const useDefault = async () => {
    await setServerAddress(null);
    setText(DEFAULT_API_BASE_URL);
    setStatus({ kind: "ok", message: `Back to the default server (${serverHost(DEFAULT_API_BASE_URL)}).` });
  };

  return (
    <View style={[styles.wrap, style]}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        hitSlop={8}
        style={styles.row}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Server: ${serverHost(current)}. ${open ? "Hide" : "Change"}`}
      >
        <Icon name="server" size={12} color={colors.textSubtle} />
        <Text style={styles.rowText} numberOfLines={1}>
          Server: {serverHost(current)}
        </Text>
        {!isDefault && <Text style={styles.custom}>Custom</Text>}
        <Text style={styles.change}>{open ? "Hide" : "Change"}</Text>
      </Pressable>

      {open && (
        <View style={styles.card}>
          <FormField
            label="Server address"
            icon="server"
            value={text}
            onChangeText={(v) => {
              setText(v);
              if (status?.kind !== "testing") setStatus(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="http://192.168.1.30"
            hint="An IP is enough; /Arise_API/index.php is added for you."
            returnKeyType="go"
            onSubmitEditing={apply}
            containerStyle={styles.field}
          />
          {!!status && (
            <Text
              style={[styles.status, status.kind === "error" && styles.statusError, status.kind === "ok" && styles.statusOk]}
              accessibilityLiveRegion="polite"
            >
              {status.message}
            </Text>
          )}
          <View style={styles.buttons}>
            <Button label={testing ? "Checking…" : "Test & use"} size="sm" onPress={apply} loading={testing} style={styles.button} />
            {!isDefault && <Button label="Use default" size="sm" variant="outline" onPress={useDefault} style={styles.button} />}
          </View>
          <Text style={styles.note}>Development build only. Preview and student builds always use their built-in server.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.xl },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs + 2 },
  rowText: { ...typography.caption, color: colors.textSubtle, flexShrink: 1 },
  custom: { ...typography.sublabel, fontSize: 9.5, color: colors.primary },
  change: { ...typography.label, fontSize: 11, color: colors.textLink },
  card: {
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceField,
  },
  field: { marginBottom: spacing.sm },
  status: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  statusError: { color: colors.danger },
  statusOk: { color: colors.success },
  buttons: { flexDirection: "row", gap: spacing.sm },
  button: { flex: 1 },
  note: { ...typography.caption, fontSize: 11, color: colors.textSubtle, marginTop: spacing.md },
});
