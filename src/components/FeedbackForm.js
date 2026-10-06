import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import FormField from "./FormField";
import Button from "./Button";
import Icon from "./Icon";
import { apiRequest } from "../api/client";
import { getVisitorId } from "../utils/visitorId";
import { colors, typography, spacing } from "../theme";

// The feedback form in the About sheet — the mobile counterpart of the web
// app's FeedbackPanel, sending to the same Feedback_API/submit, so it lands
// in the admin's Feedback page with everything else. A 1-5 star rating is
// required; comment, name and email are optional. visitor_id is what the
// server's one-per-30-seconds limit counts against (see utils/visitorId).
//
//   <FeedbackForm onSubmitted={(feedback) => …} onCancel={…} />
//
// onSubmitted gets the server's { id, rating } once it's stored; the form
// then shows a thank-you in place of itself.
const STARS = [1, 2, 3, 4, 5];
const RATING_WORDS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

export default function FeedbackForm({ onSubmitted, onCancel }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState({ kind: "idle", message: "" }); // idle | sending | sent | error

  const sending = status.kind === "sending";

  const submit = async () => {
    if (sending) return;
    if (rating < 1) {
      setStatus({ kind: "error", message: "Please select a rating." });
      return;
    }
    setStatus({ kind: "sending", message: "" });
    try {
      const { feedback } = await apiRequest("Feedback_API/submit", {
        method: "POST",
        body: {
          rating,
          comment: comment.trim() || undefined,
          name: name.trim() || undefined,
          email: email.trim() || undefined,
          visitor_id: await getVisitorId(),
        },
      });
      setStatus({ kind: "sent", message: "" });
      onSubmitted?.(feedback);
    } catch (err) {
      setStatus({ kind: "error", message: err.message || "Couldn't send your feedback. Try again." });
    }
  };

  if (status.kind === "sent") {
    return (
      <View style={styles.thanks} accessibilityLiveRegion="polite">
        <Icon name="done" size={28} color={colors.success} />
        <Text style={styles.thanksTitle}>Thank you!</Text>
        <Text style={styles.thanksText}>Your feedback helps us make the tour better.</Text>
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <Text style={styles.title}>Rate your experience</Text>

      <View style={styles.stars} accessibilityRole="radiogroup" accessibilityLabel="Rating">
        {STARS.map((star) => (
          <Pressable
            key={star}
            onPress={() => {
              setRating(star);
              if (status.kind === "error") setStatus({ kind: "idle", message: "" });
            }}
            hitSlop={4}
            style={({ pressed }) => [styles.star, pressed && styles.starPressed]}
            accessibilityRole="radio"
            accessibilityState={{ checked: rating === star }}
            accessibilityLabel={`${star} out of 5, ${RATING_WORDS[star]}`}
          >
            <Icon name={star <= rating ? "star" : "starOutline"} size={34} color={star <= rating ? colors.gold : colors.gray500} />
          </Pressable>
        ))}
      </View>
      <Text style={styles.ratingWord}>{rating ? RATING_WORDS[rating] : "Tap a star"}</Text>

      <FormField
        label="Comment (optional)"
        value={comment}
        onChangeText={setComment}
        placeholder="What did you like, or what could be better?"
        multiline
        maxLength={2000}
        inputStyle={styles.comment}
        containerStyle={styles.field}
      />
      <FormField
        label="Name (optional)"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        maxLength={255}
        containerStyle={styles.field}
      />
      <FormField
        label="Email (optional)"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={255}
        containerStyle={styles.field}
      />

      {status.kind === "error" && (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {status.message}
        </Text>
      )}

      <View style={styles.buttons}>
        <Button label={sending ? "Sending…" : "Send feedback"} onPress={submit} loading={sending} style={styles.button} />
        {onCancel && <Button label="Cancel" variant="outline" onPress={onCancel} disabled={sending} style={styles.button} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { alignSelf: "stretch" },
  title: { ...typography.eyebrow, textAlign: "center" },
  stars: { flexDirection: "row", justifyContent: "center", gap: spacing.xs, marginTop: spacing.md },
  star: { padding: 2 },
  starPressed: { opacity: 0.6 },
  ratingWord: { ...typography.caption, textAlign: "center", marginTop: spacing.xs, marginBottom: spacing.md },
  field: { marginBottom: spacing.md },
  comment: { minHeight: 72, textAlignVertical: "top" },
  error: { ...typography.caption, color: colors.danger, marginBottom: spacing.sm, textAlign: "center" },
  buttons: { flexDirection: "row", gap: spacing.sm },
  button: { flex: 1 },
  thanks: { alignItems: "center", gap: spacing.xs, paddingVertical: spacing.md },
  thanksTitle: { ...typography.h3 },
  thanksText: { ...typography.bodySmall, textAlign: "center" },
});
