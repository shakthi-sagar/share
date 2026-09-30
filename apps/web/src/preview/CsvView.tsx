import { useMemo } from "react";
import { detectDelimiter, parseDelimited } from "./csv";

/** Rows rendered at once. The rest of a large file stays available through Source or Download. */
const MAX_ROWS = 5000;

export function CsvView({ text, path }: { text: string; path: string }): React.JSX.Element {
  const table = useMemo(
    () => parseDelimited(text, detectDelimiter(text, path), MAX_ROWS + 1),
    [text, path],
  );
  const [header = [], ...body] = table.rows;
  const rows = body.slice(0, MAX_ROWS);
  const columns = Array.from({ length: table.columns }, (_, index) => index);

  if (table.rows.length === 0) {
    return <div className="content-state">This table is empty.</div>;
  }

  return (
    <div className="csv-view" data-scroll-sync="">
      <table>
        <thead>
          <tr>
            <th className="csv-index" scope="col">
              <span className="visually-hidden">Row</span>
            </th>
            {columns.map((column) => (
              <th key={column} scope="col" title={header[column]}>
                {header[column] ?? ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            // Rows have no identity beyond their position in the file.
            // biome-ignore lint/suspicious/noArrayIndexKey: the parsed table never reorders.
            <tr key={rowIndex}>
              <th className="csv-index" scope="row">
                {rowIndex + 1}
              </th>
              {columns.map((column) => (
                <td key={column} title={row[column]}>
                  {row[column] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="csv-summary">
        {body.length > MAX_ROWS || table.truncated
          ? `Showing the first ${MAX_ROWS.toLocaleString()} rows. Use Source or Download for the rest.`
          : `${rows.length.toLocaleString()} ${rows.length === 1 ? "row" : "rows"} · ${table.columns} ${table.columns === 1 ? "column" : "columns"}`}
      </p>
    </div>
  );
}
