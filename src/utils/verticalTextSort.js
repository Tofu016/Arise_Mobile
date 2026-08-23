// Spatial post-processor for vertical / mixed-orientation text — adapted
// from a genuinely reusable piece of the original prototype's OCR service
// (verticalSorter.ts). Unlike the rest of that pipeline (which never
// actually worked — see ocrRoomMatch.js's history), this part is pure
// spatial math with no dependency on the broken ONNX pipeline, so it ports
// over directly.
//
// Some placards print text as individually stacked letters (each on its own
// line) rather than a normal rotated word — no amount of rotating the image
// fixes that, since it's not a rotated line, it's a different layout
// entirely. ML Kit reads each stacked letter as its own short "line" with no
// natural connection to the others; this groups lines that share a
// horizontal position into a column, sorts each column top-to-bottom, then
// orders columns left-to-right — reconstructing the word a human would read.

const VERTICAL_X_THRESHOLD = 0.06; // fraction of image width — how close two lines' centers must be to count as "the same column"
const SHORT_LINE_CHARS = 2; // a column whose lines average this length or less is treated as stacked single letters, not separate stacked lines of text

function centerX(line) {
  return line.frame.left + (line.frame.right - line.frame.left) / 2;
}

function centerY(line) {
  return line.frame.top + (line.frame.bottom - line.frame.top) / 2;
}

function areSameColumn(a, b, threshold) {
  return Math.abs(centerX(a) - centerX(b)) <= threshold;
}

function groupIntoColumns(lines, threshold) {
  const columns = [];
  const sortedByX = [...lines].sort((a, b) => centerX(a) - centerX(b));
  for (const line of sortedByX) {
    const column = columns.find((c) => areSameColumn(c[0], line, threshold));
    if (column) column.push(line);
    else columns.push([line]);
  }
  return columns;
}

// Normalizes ML Kit's pixel-based frame (left/top/right/bottom) to 0..1
// fractions of the cropped image's actual dimensions — needed so the
// threshold above means the same thing regardless of the source photo's
// resolution.
function normalizeLine(line, imageWidth, imageHeight) {
  return {
    text: line.text,
    frame: {
      left: line.frame.left / imageWidth,
      top: line.frame.top / imageHeight,
      right: line.frame.right / imageWidth,
      bottom: line.frame.bottom / imageHeight,
    },
  };
}

// Reconstructs a single string from an ML Kit Text result's lines, correctly
// ordered even when some of them are individually-stacked letters rather
// than normal left-to-right lines.
export function reconstructVerticalText(mlKitResult, imageWidth, imageHeight) {
  const allLines = (mlKitResult?.blocks || []).flatMap((b) => b.lines || []);
  if (allLines.length === 0) return "";

  const normalized = allLines.map((l) => normalizeLine(l, imageWidth, imageHeight));
  const columns = groupIntoColumns(normalized, VERTICAL_X_THRESHOLD);

  for (const column of columns) {
    column.sort((a, b) => centerY(a) - centerY(b));
  }
  columns.sort((a, b) => centerX(a[0]) - centerX(b[0]));

  return columns
    .map((column) => {
      const avgLength =
        column.reduce((sum, l) => sum + l.text.length, 0) / column.length;
      if (avgLength > SHORT_LINE_CHARS) {
        // Genuine separate stacked lines (not single letters) — join with
        // spaces, treating each as its own word/phrase.
        return column.map((l) => l.text).join(" ");
      }

      // A column of single letters — normally a stacked word, joined with
      // no separator. But a noticeably larger vertical gap between two
      // consecutive letters (like the blank line separating "Vertical" from
      // "Text" in the example that motivated this) signals a genuine word
      // break, not just normal letter spacing — insert a space there.
      const gaps = [];
      for (let i = 1; i < column.length; i++) {
        gaps.push(centerY(column[i]) - centerY(column[i - 1]));
      }
      const avgGap = gaps.reduce((s, g) => s + g, 0) / (gaps.length || 1);

      let word = column[0].text;
      for (let i = 1; i < column.length; i++) {
        const isWordBreak = gaps[i - 1] > avgGap * 1.8;
        word += (isWordBreak ? " " : "") + column[i].text;
      }
      return word;
    })
    .join(" ")
    .trim();
}
