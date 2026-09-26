import Fuse from "fuse.js";

// Fuzzy-matches raw OCR text (often noisy — mixed case, extra whitespace,
// extraneous words from the rest of a placard's text) against ARISE's real
// room data (from useSearchableRooms). Returns candidates sorted best-first,
// each flagged with whether it's confident enough to treat as a genuine
// match rather than just a suggestion to offer the person.
//
// Matched against the room name AND the room's OCR search terms from
// PlacardDialogs_API (search_terms): an admin-maintained list of what a
// placard may read as, stored lowercase letters/digits only ("gd1101").
// The OCR text is searched as read and also normalized the same way, so a
// placard read as "GD1 101" or "GD1101" still lands exactly on GD1-101.
//
// threshold is Fuse's own match-strictness knob: 0 = exact match only,
// 1 = matches almost anything. 0.4 is a deliberately forgiving middle
// ground, since OCR output is rarely a clean, exact match to begin with.
const FUSE_OPTIONS = {
  keys: ["roomName", "placard.ocrSearchTerms"],
  includeScore: true,
  threshold: 0.4,
};

// Same normalization the search terms are stored with.
function normalize(text) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Confident enough to skip the suggestion step only when the WHOLE read
// is the room's name or one of its search terms — not merely a high Fuse
// score, which a partial read also gets: "GD1-10" scores ~0 against both
// GD1-101 and GD1-102, and used to jump straight to whichever came first.
function isExactRead(normalizedRead, room) {
  if (!normalizedRead) return false;
  if (normalize(room.roomName) === normalizedRead) return true;
  return (room.placard?.ocrSearchTerms || []).includes(normalizedRead);
}

export function matchRoomsFromOcr(ocrText, searchableRooms) {
  const trimmed = (ocrText || "").trim();
  if (!trimmed || searchableRooms.length === 0) return [];

  const fuse = new Fuse(searchableRooms, FUSE_OPTIONS);
  const normalized = normalize(trimmed);
  const queries = [...new Set([trimmed, normalized].filter(Boolean))];

  // Best (lowest) Fuse score per room across both queries.
  const best = new Map();
  for (const query of queries) {
    for (const r of fuse.search(query)) {
      const score = r.score ?? 1;
      const seen = best.get(r.item);
      if (seen === undefined || score < seen) best.set(r.item, score);
    }
  }

  return [...best.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([room, score]) => ({
      room,
      // Flipped so 1 = perfect match, matching the more intuitive
      // "higher is better" convention used elsewhere in this app (e.g. the
      // room search ranking), rather than Fuse's own 0-is-best convention.
      score: 1 - score,
      isExact: isExactRead(normalized, room),
    }));
}
