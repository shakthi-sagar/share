export interface ParsedTable {
  rows: string[][];
  /** Widest row, so ragged rows still line up. */
  columns: number;
  /** True when parsing stopped at `maxRows`. */
  truncated: boolean;
}

/** Picks a delimiter: tabs for .tsv, otherwise the most frequent candidate in the first line. */
export function detectDelimiter(text: string, path: string): string {
  if (/\.tsv$/iu.test(path)) return "\t";
  const firstLine = text.slice(0, 4096).split(/\r?\n/u)[0] ?? "";
  let best = ",";
  let bestCount = 0;
  for (const candidate of [",", "\t", ";", "|"]) {
    const count = firstLine.split(candidate).length - 1;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Parses delimited text following RFC 4180: quoted fields may contain delimiters, newlines, and
 * doubled quotes. Stops after `maxRows` so a large file renders quickly.
 */
export function parseDelimited(text: string, delimiter: string, maxRows: number): ParsedTable {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let columns = 0;
  let index = text.charCodeAt(0) === 0xfeff ? 1 : 0;

  const endRow = (): void => {
    row.push(field);
    field = "";
    columns = Math.max(columns, row.length);
    rows.push(row);
    row = [];
  };

  for (; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"' && field === "") {
      quoted = true;
    } else if (character === delimiter) {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      endRow();
      if (rows.length >= maxRows) {
        return { rows, columns, truncated: index + 1 < text.length };
      }
    } else {
      field += character;
    }
  }
  if (field !== "" || row.length > 0) endRow();
  return { rows, columns, truncated: false };
}
