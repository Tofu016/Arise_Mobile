import Fuse from "fuse.js";

// Fuzzy-matches raw OCR text (often noisy — mixed case, extra whitespace,
// extraneous words from the rest of a placard's text) against ARISE's real
// room data (from useSearchableRooms). Returns candidates sorted best-first,
// each flagged with whether it's confident enough to treat as a genuine
// match rather than just a suggestion to offer the person.
//
// threshold is Fuse's own match-strictness knob: 0 = exact match only,
// 1 = matches almost anything. 0.4 is a deliberately forgiving middle
// ground, since OCR output is rarely a clean, exact match to begin with.
const FUSE_OPTIONS = {
  keys: ["roomName"],
  includeScore: true,
  threshold: 0.4,
};

// A Fuse score below this is treated as confident enough to skip the
// suggestion step entirely (Fuse scores 0 = perfect match, 1 = no match).
const EXACT_SCORE_CUTOFF = 0.05;

export function matchRoomsFromOcr(ocrText, searchableRooms) {
  const trimmed = (ocrText || "").trim();
  if (!trimmed || searchableRooms.length === 0) return [];

  const fuse = new Fuse(searchableRooms, FUSE_OPTIONS);
  const results = fuse.search(trimmed);

  return results.map((r) => ({
    room: r.item,
    // Flipped so 1 = perfect match, matching the more intuitive
    // "higher is better" convention used elsewhere in this app (e.g. the
    // room search ranking), rather than Fuse's own 0-is-best convention.
    score: 1 - (r.score ?? 1),
    isExact: (r.score ?? 1) < EXACT_SCORE_CUTOFF,
  }));
}
