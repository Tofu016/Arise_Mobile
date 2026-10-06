import { useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import Constants from "expo-constants";
import BottomSheet from "./BottomSheet";
import AriseLogo from "./AriseLogo";
import ServerSetting from "./ServerSetting";
import Button from "./Button";
import FeedbackForm from "./FeedbackForm";
import { colors, typography, spacing } from "../theme";

// The About tab: the ARISE logo, what the app is, where the visitor's own
// data lives (saved and recent rooms stay on this phone — there are no
// accounts), the feedback form (behind "Send feedback"), and the version.
// The development build also gets its server-address setting here
// (ServerSetting renders nothing otherwise). Only ever as tall as its
// content (no empty space); it scrolls once the form makes it taller than
// the room left.
const LOGO_WIDTH = 190;

export default function AboutSheet({ onClose, onFeedbackSubmitted, bottomOffset, topLimit }) {
  // Measured, so the sheet fits its content exactly.
  const [contentHeight, setContentHeight] = useState(0);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const version = Constants.expoConfig?.version;

  return (
    <BottomSheet
      onClose={onClose}
      snapPoints={[0.8]}
      bottomOffset={bottomOffset}
      topLimit={topLimit}
      fitContent
      avoidKeyboard
      contentHeight={contentHeight || undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        onContentSizeChange={(_, h) => setContentHeight(h)}
        keyboardShouldPersistTaps="handled"
      >
        <AriseLogo width={LOGO_WIDTH} still style={styles.logo} />
        <Text style={styles.college}>St. Dominic College of Asia</Text>
        <Text style={styles.body}>
          A virtual tour of the campus: look around every spot in 360°, find rooms, get directions, and see places in AR.
        </Text>
        <Text style={styles.note}>Your saved and recent rooms are kept on this phone only.</Text>

        <View style={styles.feedback}>
          {feedbackOpen ? (
            <FeedbackForm onSubmitted={onFeedbackSubmitted} onCancel={() => setFeedbackOpen(false)} />
          ) : (
            <Button label="Send" variant="outline" icon="star" onPress={() => setFeedbackOpen(true)} />
          )}
        </View>

        {!!version && <Text style={styles.version}>Version {version}</Text>}
        <ServerSetting style={styles.server} />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: "center", paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.lg },
  logo: { marginBottom: spacing.md },
  college: { ...typography.label, color: colors.textMuted, textAlign: "center" },
  body: { ...typography.bodySmall, textAlign: "center", marginTop: spacing.md },
  note: { ...typography.caption, textAlign: "center", marginTop: spacing.md },
  feedback: { alignSelf: "stretch", marginTop: spacing.lg },
  version: { ...typography.caption, color: colors.textSubtle, marginTop: spacing.lg },
  server: { alignSelf: "stretch", marginTop: spacing.lg },
});
